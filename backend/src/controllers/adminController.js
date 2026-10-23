const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { carpetaDestino } = require('../middlewares/upload');

// Borra del disco las fotos de los puntos eliminados (después de confirmar la transacción).
function borrarFotos(urls) {
  urls.filter(Boolean).forEach((url) => {
    fs.unlink(path.join(carpetaDestino, path.basename(url)), () => {});
  });
}

// Elimina puntos de infraestructura junto con todo lo que depende de ellos:
// incidencias, cables y paradas de ruta. Las rutas que se quedan sin puntos se
// eliminan; las demás recalculan su estado. Debe llamarse dentro de una transacción.
async function borrarNodosEnCascada(conexion, ids) {
  const [fotos] = await conexion.query('SELECT foto_url FROM nodos WHERE id_nodo IN (?)', [ids]);
  const [rutas] = await conexion.query('SELECT DISTINCT id_ruta FROM ruta_nodos WHERE id_nodo IN (?)', [ids]);
  const [cables] = await conexion.query(
    'SELECT id_cable FROM cables WHERE id_nodo_origen IN (?) OR id_nodo_destino IN (?)',
    [ids, ids]
  );
  const idsCables = cables.map((c) => c.id_cable);

  await conexion.query('DELETE FROM incidencias WHERE id_nodo IN (?)', [ids]);
  if (idsCables.length > 0) {
    await conexion.query('DELETE FROM incidencias WHERE id_cable IN (?)', [idsCables]);
    await conexion.query('DELETE FROM cables WHERE id_cable IN (?)', [idsCables]);
  }
  await conexion.query('DELETE FROM ruta_nodos WHERE id_nodo IN (?)', [ids]);

  for (const { id_ruta } of rutas) {
    const [[{ total, visitados }]] = await conexion.query(
      'SELECT COUNT(*) AS total, COALESCE(SUM(visitado), 0) AS visitados FROM ruta_nodos WHERE id_ruta = ?',
      [id_ruta]
    );
    if (Number(total) === 0) {
      await conexion.query('DELETE FROM rutas WHERE id_ruta = ?', [id_ruta]);
    } else {
      const estado = Number(visitados) === Number(total) ? 'completada' : Number(visitados) === 0 ? 'pendiente' : 'en_progreso';
      await conexion.query('UPDATE rutas SET estado = ? WHERE id_ruta = ?', [estado, id_ruta]);
    }
  }

  const [resultado] = await conexion.query('DELETE FROM nodos WHERE id_nodo IN (?)', [ids]);
  return { eliminados: resultado.affectedRows, fotos: fotos.map((f) => f.foto_url) };
}

// Elimina un usuario con sus rutas, incidencias reportadas y pendientes de sincronización.
// Los puntos de infraestructura que registró se conservan (quedan "sin registrar").
async function borrarUsuarioEnCascada(conexion, id) {
  await conexion.query('DELETE FROM incidencias WHERE id_usuario_reporta = ?', [id]);
  await conexion.query('DELETE rn FROM ruta_nodos rn JOIN rutas r ON rn.id_ruta = r.id_ruta WHERE r.id_tecnico = ?', [id]);
  await conexion.query('DELETE FROM rutas WHERE id_tecnico = ?', [id]);
  await conexion.query('DELETE FROM registros_pendientes_sync WHERE id_usuario = ?', [id]);
  await conexion.query('UPDATE nodos SET id_usuario_registra = NULL WHERE id_usuario_registra = ?', [id]);
  const [resultado] = await conexion.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
  return resultado.affectedRows;
}

// Borra TODOS los datos operativos (para sacar los datos de prueba antes de usar
// el sistema de verdad). Conserva usuarios, roles y zonas.
async function limpiarDatosOperativos(req, res) {
  if (req.body.confirmacion !== 'BORRAR') {
    return res.status(400).json({ mensaje: 'Escribe BORRAR para confirmar' });
  }
  const conexion = await pool.getConnection();
  try {
    const [fotos] = await conexion.query('SELECT foto_url FROM nodos');
    await conexion.beginTransaction();
    const conteo = {};
    for (const [clave, tabla] of [
      ['incidencias', 'incidencias'],
      ['paradas_de_ruta', 'ruta_nodos'],
      ['rutas', 'rutas'],
      ['cables', 'cables'],
      ['pendientes_de_sincronizacion', 'registros_pendientes_sync'],
      ['infraestructura', 'nodos'],
    ]) {
      const [r] = await conexion.query(`DELETE FROM ${tabla}`);
      conteo[clave] = r.affectedRows;
    }
    await conexion.commit();
    borrarFotos(fotos.map((f) => f.foto_url));
    res.json({ mensaje: 'Datos de prueba eliminados', eliminados: conteo });
  } catch (error) {
    await conexion.rollback().catch(() => {});
    console.error('Error al limpiar datos:', error);
    res.status(500).json({ mensaje: 'No se pudieron borrar los datos' });
  } finally {
    conexion.release();
  }
}

module.exports = { borrarNodosEnCascada, borrarUsuarioEnCascada, borrarFotos, limpiarDatosOperativos };
