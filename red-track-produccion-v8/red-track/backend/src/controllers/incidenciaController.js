const pool = require('../config/db');

function fechaCaptura(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

const PRIORIDADES_VALIDAS = ['baja', 'media', 'alta', 'critica'];

async function listarIncidencias(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT i.id_incidencia, i.id_nodo, i.descripcion, i.prioridad, i.estado,
              i.creado_en, i.resuelto_en, i.capturado_en,
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
  const { descripcion, prioridad, id_nodo, id_cable, uuid_cliente, capturado_en } = req.body;

  if (!descripcion || !descripcion.trim()) {
    return res.status(400).json({ mensaje: 'La descripción es requerida' });
  }

  const prioridadFinal = prioridad || 'media';
  if (!PRIORIDADES_VALIDAS.includes(prioridadFinal)) {
    return res.status(400).json({ mensaje: `Prioridad inválida. Use una de: ${PRIORIDADES_VALIDAS.join(', ')}` });
  }

  const uuid = uuid_cliente ? String(uuid_cliente).slice(0, 64) : null;

  try {
    if (uuid) {
      const [[previa]] = await pool.query('SELECT id_incidencia FROM incidencias WHERE uuid_cliente = ?', [uuid]);
      if (previa) {
        return res.json({ id_incidencia: previa.id_incidencia, duplicado: true, mensaje: 'Esta incidencia ya estaba sincronizada' });
      }
    }
    const [resultado] = await pool.query(
      `INSERT INTO incidencias (id_nodo, id_cable, id_usuario_reporta, descripcion, prioridad, capturado_en, uuid_cliente)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_nodo || null, id_cable || null, req.usuario.id_usuario, descripcion.trim(), prioridadFinal, fechaCaptura(capturado_en), uuid]
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

// Administrador: corrige descripción, prioridad, estado o punto asociado.
async function actualizarIncidencia(req, res) {
  const { descripcion, prioridad, estado, id_nodo } = req.body;

  if (!descripcion || !String(descripcion).trim()) {
    return res.status(400).json({ mensaje: 'La descripción es requerida' });
  }
  if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
    return res.status(400).json({ mensaje: `Prioridad inválida. Use una de: ${PRIORIDADES_VALIDAS.join(', ')}` });
  }
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ mensaje: `Estado inválido. Use uno de: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    const [[actual]] = await pool.query('SELECT estado, resuelto_en FROM incidencias WHERE id_incidencia = ?', [req.params.id]);
    if (!actual) return res.status(404).json({ mensaje: 'Incidencia no encontrada' });

    const cerrada = ['resuelta', 'cerrada'].includes(estado);
    const resuelto_en = cerrada ? actual.resuelto_en || new Date() : null;

    await pool.query(
      `UPDATE incidencias SET descripcion = ?, prioridad = ?, estado = ?, id_nodo = ?, resuelto_en = ?
       WHERE id_incidencia = ?`,
      [String(descripcion).trim(), prioridad, estado, id_nodo || null, resuelto_en, req.params.id]
    );
    res.json({ mensaje: 'Incidencia actualizada correctamente' });
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ mensaje: 'El punto elegido no existe' });
    }
    console.error('Error al actualizar incidencia:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function eliminarIncidencia(req, res) {
  try {
    const [resultado] = await pool.query('DELETE FROM incidencias WHERE id_incidencia = ?', [req.params.id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Incidencia no encontrada' });
    res.json({ mensaje: 'Incidencia eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar incidencia:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listarIncidencias, crearIncidencia, actualizarEstadoIncidencia, actualizarIncidencia, eliminarIncidencia };
