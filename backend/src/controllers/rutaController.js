const pool = require('../config/db');

// Devuelve la ruta activa (pendiente o en_progreso) más próxima del técnico
// autenticado, junto con sus puntos (nodos) en orden.
async function obtenerMiRuta(req, res) {
  try {
    const [rutas] = await pool.query(
      `SELECT id_ruta, nombre, fecha_programada, estado
       FROM rutas
       WHERE id_tecnico = ? AND estado IN ('pendiente', 'en_progreso')
       ORDER BY fecha_programada ASC, id_ruta ASC
       LIMIT 1`,
      [req.usuario.id_usuario]
    );

    if (rutas.length === 0) {
      return res.json(null);
    }

    const ruta = rutas[0];
    const [puntos] = await pool.query(
      `SELECT rn.id_ruta_nodo, rn.orden, rn.visitado,
              n.id_nodo, n.codigo, n.tipo, n.estado AS estado_nodo, n.latitud, n.longitud,
              z.nombre AS zona
       FROM ruta_nodos rn
       JOIN nodos n ON rn.id_nodo = n.id_nodo
       LEFT JOIN zonas z ON n.id_zona = z.id_zona
       WHERE rn.id_ruta = ?
       ORDER BY rn.orden ASC`,
      [ruta.id_ruta]
    );

    res.json({ ...ruta, puntos });
  } catch (error) {
    console.error('Error al obtener ruta del técnico:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Marca (o desmarca) un punto de ruta como visitado. Solo el técnico dueño de
// la ruta (o un administrador) puede hacerlo. El estado de la ruta se recalcula:
// ninguno visitado = pendiente, algunos = en_progreso, todos = completada.
async function marcarPuntoVisitado(req, res) {
  const { visitado } = req.body;
  if (typeof visitado !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo visitado debe ser true o false' });
  }

  try {
    const [[puntoActual]] = await pool.query(
      `SELECT rn.id_ruta, r.id_tecnico
       FROM ruta_nodos rn
       JOIN rutas r ON rn.id_ruta = r.id_ruta
       WHERE rn.id_ruta_nodo = ?`,
      [req.params.id]
    );
    if (!puntoActual) {
      return res.status(404).json({ mensaje: 'Punto de ruta no encontrado' });
    }
    if (puntoActual.id_tecnico !== req.usuario.id_usuario && req.usuario.rol !== 'administrador') {
      return res.status(403).json({ mensaje: 'Esta ruta no está asignada a tu usuario' });
    }

    await pool.query('UPDATE ruta_nodos SET visitado = ? WHERE id_ruta_nodo = ?', [visitado, req.params.id]);

    const [[{ total, visitados }]] = await pool.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(visitado), 0) AS visitados FROM ruta_nodos WHERE id_ruta = ?`,
      [puntoActual.id_ruta]
    );

    let nuevoEstado = 'en_progreso';
    if (Number(visitados) === Number(total)) nuevoEstado = 'completada';
    else if (Number(visitados) === 0) nuevoEstado = 'pendiente';

    await pool.query('UPDATE rutas SET estado = ? WHERE id_ruta = ?', [nuevoEstado, puntoActual.id_ruta]);

    res.json({ mensaje: 'Punto actualizado', estado_ruta: nuevoEstado });
  } catch (error) {
    console.error('Error al actualizar punto de ruta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Lista todas las rutas con su técnico y avance (uso de administración).
async function listarRutas(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT r.id_ruta, r.nombre, r.id_tecnico, r.fecha_programada, r.estado,
              u.nombre_completo AS tecnico,
              COUNT(rn.id_ruta_nodo) AS puntos,
              COALESCE(SUM(rn.visitado), 0) AS visitados
       FROM rutas r
       JOIN usuarios u ON r.id_tecnico = u.id_usuario
       LEFT JOIN ruta_nodos rn ON rn.id_ruta = r.id_ruta
       GROUP BY r.id_ruta, r.nombre, r.id_tecnico, r.fecha_programada, r.estado, u.nombre_completo
       ORDER BY r.fecha_programada DESC, r.id_ruta DESC`
    );
    res.json(filas);
  } catch (error) {
    console.error('Error al listar rutas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Crea una ruta con sus puntos (uso de administración/supervisión).
async function crearRuta(req, res) {
  const { nombre, id_tecnico, fecha_programada, nodos } = req.body;

  if (!nombre || !id_tecnico || !fecha_programada || !Array.isArray(nodos) || nodos.length === 0) {
    return res
      .status(400)
      .json({ mensaje: 'nombre, id_tecnico, fecha_programada y una lista de nodos son requeridos' });
  }

  const idsNodos = [...new Set(nodos.map(Number))];
  if (idsNodos.some((n) => !Number.isInteger(n) || n <= 0)) {
    return res.status(400).json({ mensaje: 'La lista de nodos contiene valores inválidos' });
  }

  const conexion = await pool.getConnection();
  try {
    const [tecnico] = await conexion.query(
      `SELECT 1 FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND r.nombre = 'tecnico' AND u.activo = TRUE`,
      [id_tecnico]
    );
    if (tecnico.length === 0) {
      return res.status(400).json({ mensaje: 'El usuario elegido no es un técnico activo' });
    }

    const [existentes] = await conexion.query('SELECT id_nodo FROM nodos WHERE id_nodo IN (?)', [idsNodos]);
    if (existentes.length !== idsNodos.length) {
      return res.status(400).json({ mensaje: 'Alguno de los puntos elegidos no existe' });
    }

    await conexion.beginTransaction();
    const [resultado] = await conexion.query(
      'INSERT INTO rutas (nombre, id_tecnico, fecha_programada) VALUES (?, ?, ?)',
      [nombre, id_tecnico, fecha_programada]
    );
    const idRuta = resultado.insertId;

    for (let i = 0; i < idsNodos.length; i++) {
      await conexion.query('INSERT INTO ruta_nodos (id_ruta, id_nodo, orden) VALUES (?, ?, ?)', [
        idRuta,
        idsNodos[i],
        i + 1,
      ]);
    }

    await conexion.commit();
    res.status(201).json({ id_ruta: idRuta, mensaje: 'Ruta creada correctamente' });
  } catch (error) {
    await conexion.rollback().catch(() => {});
    console.error('Error al crear ruta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    conexion.release();
  }
}

// Detalle de una ruta con sus puntos (para editarla desde Administración).
async function obtenerRuta(req, res) {
  try {
    const [[ruta]] = await pool.query(
      'SELECT id_ruta, nombre, id_tecnico, fecha_programada, estado FROM rutas WHERE id_ruta = ?',
      [req.params.id]
    );
    if (!ruta) return res.status(404).json({ mensaje: 'Ruta no encontrada' });
    const [puntos] = await pool.query(
      `SELECT rn.id_nodo, rn.orden, rn.visitado, n.codigo
       FROM ruta_nodos rn JOIN nodos n ON rn.id_nodo = n.id_nodo
       WHERE rn.id_ruta = ? ORDER BY rn.orden`,
      [req.params.id]
    );
    res.json({ ...ruta, puntos });
  } catch (error) {
    console.error('Error al obtener ruta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Edita nombre, técnico, fecha y puntos de una ruta. Los puntos que ya estaban
// conservan su estado "visitado"; el estado de la ruta se recalcula.
async function actualizarRuta(req, res) {
  const { nombre, id_tecnico, fecha_programada, nodos } = req.body;

  if (!nombre || !String(nombre).trim() || !id_tecnico || !fecha_programada || !Array.isArray(nodos) || nodos.length === 0) {
    return res
      .status(400)
      .json({ mensaje: 'nombre, id_tecnico, fecha_programada y una lista de nodos son requeridos' });
  }
  const idsNodos = [...new Set(nodos.map(Number))];
  if (idsNodos.some((n) => !Number.isInteger(n) || n <= 0)) {
    return res.status(400).json({ mensaje: 'La lista de nodos contiene valores inválidos' });
  }

  const conexion = await pool.getConnection();
  try {
    const [[ruta]] = await conexion.query('SELECT id_ruta FROM rutas WHERE id_ruta = ?', [req.params.id]);
    if (!ruta) return res.status(404).json({ mensaje: 'Ruta no encontrada' });

    const [tecnico] = await conexion.query(
      `SELECT 1 FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ? AND r.nombre = 'tecnico'`,
      [id_tecnico]
    );
    if (tecnico.length === 0) return res.status(400).json({ mensaje: 'El usuario elegido no es un técnico' });

    const [existentes] = await conexion.query('SELECT id_nodo FROM nodos WHERE id_nodo IN (?)', [idsNodos]);
    if (existentes.length !== idsNodos.length) {
      return res.status(400).json({ mensaje: 'Alguno de los puntos elegidos no existe' });
    }

    const [previos] = await conexion.query('SELECT id_nodo, visitado FROM ruta_nodos WHERE id_ruta = ?', [req.params.id]);
    const visitadoPrevio = new Map(previos.map((p) => [p.id_nodo, p.visitado]));

    await conexion.beginTransaction();
    await conexion.query('UPDATE rutas SET nombre = ?, id_tecnico = ?, fecha_programada = ? WHERE id_ruta = ?', [
      String(nombre).trim(),
      id_tecnico,
      fecha_programada,
      req.params.id,
    ]);
    await conexion.query('DELETE FROM ruta_nodos WHERE id_ruta = ?', [req.params.id]);
    let visitados = 0;
    for (let i = 0; i < idsNodos.length; i++) {
      const v = visitadoPrevio.get(idsNodos[i]) ? 1 : 0;
      visitados += v;
      await conexion.query('INSERT INTO ruta_nodos (id_ruta, id_nodo, orden, visitado) VALUES (?, ?, ?, ?)', [
        req.params.id,
        idsNodos[i],
        i + 1,
        v,
      ]);
    }
    const estado = visitados === idsNodos.length ? 'completada' : visitados === 0 ? 'pendiente' : 'en_progreso';
    await conexion.query('UPDATE rutas SET estado = ? WHERE id_ruta = ?', [estado, req.params.id]);
    await conexion.commit();

    res.json({ mensaje: 'Ruta actualizada correctamente', estado });
  } catch (error) {
    await conexion.rollback().catch(() => {});
    console.error('Error al actualizar ruta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    conexion.release();
  }
}

async function eliminarRuta(req, res) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('DELETE FROM ruta_nodos WHERE id_ruta = ?', [req.params.id]);
    const [resultado] = await conexion.query('DELETE FROM rutas WHERE id_ruta = ?', [req.params.id]);
    if (resultado.affectedRows === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'Ruta no encontrada' });
    }
    await conexion.commit();
    res.json({ mensaje: 'Ruta eliminada correctamente' });
  } catch (error) {
    await conexion.rollback().catch(() => {});
    console.error('Error al eliminar ruta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    conexion.release();
  }
}

module.exports = { obtenerMiRuta, marcarPuntoVisitado, listarRutas, crearRuta, obtenerRuta, actualizarRuta, eliminarRuta };
