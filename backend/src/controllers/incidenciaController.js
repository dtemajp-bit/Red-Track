const pool = require('../config/db');

const PRIORIDADES_VALIDAS = ['baja', 'media', 'alta', 'critica'];

async function listarIncidencias(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT i.id_incidencia, i.descripcion, i.prioridad, i.estado,
              i.creado_en, i.resuelto_en,
              n.codigo AS codigo_nodo,
              u.nombre_completo AS reportado_por
       FROM incidencias i
       LEFT JOIN nodos n ON i.id_nodo = n.id_nodo
       JOIN usuarios u ON i.id_usuario_reporta = u.id_usuario
       ORDER BY i.creado_en DESC`
    );
    res.json(filas);
  } catch (error) {
    console.error('Error al listar incidencias:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function crearIncidencia(req, res) {
  const { descripcion, prioridad, id_nodo, id_cable } = req.body;

  if (!descripcion || !descripcion.trim()) {
    return res.status(400).json({ mensaje: 'La descripción es requerida' });
  }

  const prioridadFinal = prioridad || 'media';
  if (!PRIORIDADES_VALIDAS.includes(prioridadFinal)) {
    return res.status(400).json({ mensaje: `Prioridad inválida. Use una de: ${PRIORIDADES_VALIDAS.join(', ')}` });
  }

  try {
    const [resultado] = await pool.query(
      `INSERT INTO incidencias (id_nodo, id_cable, id_usuario_reporta, descripcion, prioridad)
       VALUES (?, ?, ?, ?, ?)`,
      [id_nodo || null, id_cable || null, req.usuario.id_usuario, descripcion.trim(), prioridadFinal]
    );
    res.status(201).json({ id_incidencia: resultado.insertId, mensaje: 'Incidencia registrada correctamente' });
  } catch (error) {
    console.error('Error al crear incidencia:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

const ESTADOS_VALIDOS = ['abierta', 'en_atencion', 'resuelta', 'cerrada'];

async function actualizarEstadoIncidencia(req, res) {
  const { estado } = req.body;

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ mensaje: `Estado inválido. Use uno de: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  const resuelto_en = ['resuelta', 'cerrada'].includes(estado) ? new Date() : null;

  try {
    const [resultado] = await pool.query(
      'UPDATE incidencias SET estado = ?, resuelto_en = ? WHERE id_incidencia = ?',
      [estado, resuelto_en, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Incidencia no encontrada' });
    }
    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar incidencia:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listarIncidencias, crearIncidencia, actualizarEstadoIncidencia };
