const pool = require('../config/db');
const { descartarArchivo } = require('../middlewares/upload');
const { borrarNodosEnCascada, borrarFotos } = require('./adminController');

const TIPOS = ['poste', 'nodo_central', 'caja_distribucion'];
const ESTADOS = ['activo', 'inactivo', 'mantenimiento'];

async function listarNodos(req, res) {
  try {
    const [nodos] = await pool.query(
      `SELECT n.*, z.nombre AS nombre_zona, u.nombre_completo AS registrado_por
       FROM nodos n
       LEFT JOIN zonas z ON n.id_zona = z.id_zona
       LEFT JOIN usuarios u ON n.id_usuario_registra = u.id_usuario
       ORDER BY n.creado_en DESC`
    );
    res.json(nodos);
  } catch (error) {
    console.error('Error al listar nodos:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function obtenerNodo(req, res) {
  try {
    const [filas] = await pool.query('SELECT * FROM nodos WHERE id_nodo = ?', [req.params.id]);
    if (filas.length === 0) {
      return res.status(404).json({ mensaje: 'Nodo no encontrado' });
    }
    res.json(filas[0]);
  } catch (error) {
    console.error('Error al obtener nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Valida los datos de un nodo. Devuelve un mensaje de error o null si todo está bien.
function validarNodo({ codigo, tipo, latitud, longitud, estado }) {
  if (!codigo || !String(codigo).trim() || !tipo || latitud === undefined || latitud === '' || longitud === undefined || longitud === '') {
    return 'codigo, tipo, latitud y longitud son requeridos';
  }
  if (!TIPOS.includes(tipo)) return `tipo inválido. Use uno de: ${TIPOS.join(', ')}`;
  if (estado && !ESTADOS.includes(estado)) return `estado inválido. Use uno de: ${ESTADOS.join(', ')}`;
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'latitud inválida';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'longitud inválida';
  return null;
}

// Convierte la fecha de captura enviada por el cliente (ISO) a un DATETIME válido.
function fechaCaptura(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

async function crearNodo(req, res) {
  const { codigo, tipo, latitud, longitud, estado, observaciones, id_zona, uuid_cliente, capturado_en } = req.body;

  const errorValidacion = validarNodo(req.body);
  if (errorValidacion) {
    descartarArchivo(req.file);
    return res.status(400).json({ mensaje: errorValidacion });
  }

  const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
  // Si no se indica zona, el punto queda en la zona del técnico que lo registra.
  const zona = id_zona || req.usuario.id_zona || null;
  const uuid = uuid_cliente ? String(uuid_cliente).slice(0, 64) : null;

  try {
    // Reintento de un envío que sí llegó (la respuesta se perdió): no se duplica.
    if (uuid) {
      const [[previo]] = await pool.query('SELECT id_nodo FROM nodos WHERE uuid_cliente = ?', [uuid]);
      if (previo) {
        descartarArchivo(req.file);
        return res.json({ id_nodo: previo.id_nodo, duplicado: true, mensaje: 'Este registro ya estaba sincronizado' });
      }
    }

    const [resultado] = await pool.query(
      `INSERT INTO nodos (codigo, tipo, latitud, longitud, estado, observaciones, foto_url, id_zona,
                          id_usuario_registra, capturado_en, uuid_cliente)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(codigo).trim(),
        tipo,
        latitud,
        longitud,
        estado || 'activo',
        observaciones || null,
        foto_url,
        zona,
        req.usuario.id_usuario,
        fechaCaptura(capturado_en),
        uuid,
      ]
    );
    res.status(201).json({ id_nodo: resultado.insertId, foto_url, mensaje: 'Nodo creado correctamente' });
  } catch (error) {
    descartarArchivo(req.file);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un nodo con ese código' });
    }
    console.error('Error al crear nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function actualizarNodo(req, res) {
  const { codigo, tipo, latitud, longitud, estado, observaciones, id_zona, quitar_foto } = req.body;

  const errorValidacion = validarNodo(req.body);
  if (errorValidacion) {
    descartarArchivo(req.file);
    return res.status(400).json({ mensaje: errorValidacion });
  }

  try {
    const [[actual]] = await pool.query('SELECT foto_url, estado, id_zona FROM nodos WHERE id_nodo = ?', [req.params.id]);
    if (!actual) {
      descartarArchivo(req.file);
      return res.status(404).json({ mensaje: 'Nodo no encontrado' });
    }

    // Foto: una nueva reemplaza a la anterior; "quitar_foto" la elimina; si no se envía nada se conserva.
    let fotoUrl = actual.foto_url;
    if (req.file) fotoUrl = `/uploads/${req.file.filename}`;
    else if (quitar_foto === 'true' || quitar_foto === true) fotoUrl = null;

    // Campos opcionales: si no vienen en la petición, se conserva el valor actual.
    const zona = id_zona === undefined ? actual.id_zona : id_zona || null;
    const estadoFinal = estado || actual.estado || 'activo';

    await pool.query(
      `UPDATE nodos SET codigo = ?, tipo = ?, latitud = ?, longitud = ?, estado = ?,
              observaciones = ?, id_zona = ?, foto_url = ?
       WHERE id_nodo = ?`,
      [String(codigo).trim(), tipo, latitud, longitud, estadoFinal, observaciones || null, zona, fotoUrl, req.params.id]
    );

    if (actual.foto_url && actual.foto_url !== fotoUrl) borrarFotos([actual.foto_url]);
    res.json({ mensaje: 'Nodo actualizado correctamente', foto_url: fotoUrl });
  } catch (error) {
    descartarArchivo(req.file);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un nodo con ese código' });
    }
    console.error('Error al actualizar nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function eliminarNodo(req, res) {
  const forzar = req.query.forzar === 'true';

  if (forzar) {
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const { eliminados, fotos } = await borrarNodosEnCascada(conexion, [Number(req.params.id)]);
      if (eliminados === 0) {
        await conexion.rollback();
        return res.status(404).json({ mensaje: 'Nodo no encontrado' });
      }
      await conexion.commit();
      borrarFotos(fotos);
      return res.json({ mensaje: 'Nodo eliminado junto con sus rutas, incidencias y cables asociados' });
    } catch (error) {
      await conexion.rollback().catch(() => {});
      console.error('Error al eliminar nodo en cascada:', error);
      return res.status(500).json({ mensaje: 'Error interno del servidor' });
    } finally {
      conexion.release();
    }
  }

  try {
    const [[previo]] = await pool.query('SELECT foto_url FROM nodos WHERE id_nodo = ?', [req.params.id]);
    const [resultado] = await pool.query('DELETE FROM nodos WHERE id_nodo = ?', [req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Nodo no encontrado' });
    }
    if (previo) borrarFotos([previo.foto_url]);
    res.json({ mensaje: 'Nodo eliminado correctamente' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        mensaje: 'El punto tiene rutas, incidencias o cables asociados.',
        requiereForzar: true,
      });
    }
    console.error('Error al eliminar nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { fechaCaptura, listarNodos, obtenerNodo, crearNodo, actualizarNodo, eliminarNodo, validarNodo };
