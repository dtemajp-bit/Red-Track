const pool = require('../config/db');

async function listarZonas(req, res) {
  try {
    const [zonas] = await pool.query('SELECT id_zona, nombre, descripcion FROM zonas ORDER BY nombre');
    res.json(zonas);
  } catch (error) {
    console.error('Error al listar zonas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function listarRoles(req, res) {
  try {
    const [roles] = await pool.query('SELECT id_rol, nombre FROM roles ORDER BY nombre');
    res.json(roles);
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function crearZona(req, res) {
  const { nombre, descripcion } = req.body;
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ mensaje: 'El nombre de la zona es requerido' });
  }
  try {
    const [resultado] = await pool.query('INSERT INTO zonas (nombre, descripcion) VALUES (?, ?)', [
      String(nombre).trim(),
      descripcion ? String(descripcion).trim() : null,
    ]);
    res.status(201).json({ id_zona: resultado.insertId, mensaje: 'Zona creada correctamente' });
  } catch (error) {
    console.error('Error al crear zona:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function actualizarZona(req, res) {
  const { nombre, descripcion } = req.body;
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ mensaje: 'El nombre de la zona es requerido' });
  }
  try {
    const [resultado] = await pool.query('UPDATE zonas SET nombre = ?, descripcion = ? WHERE id_zona = ?', [
      String(nombre).trim(),
      descripcion ? String(descripcion).trim() : null,
      req.params.id,
    ]);
    if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Zona no encontrada' });
    res.json({ mensaje: 'Zona actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar zona:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function eliminarZona(req, res) {
  const forzar = req.query.forzar === 'true';
  try {
    if (forzar) {
      // Los usuarios y puntos de la zona quedan "sin zona"; no se borran.
      await pool.query('UPDATE usuarios SET id_zona = NULL WHERE id_zona = ?', [req.params.id]);
      await pool.query('UPDATE nodos SET id_zona = NULL WHERE id_zona = ?', [req.params.id]);
    }
    const [resultado] = await pool.query('DELETE FROM zonas WHERE id_zona = ?', [req.params.id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ mensaje: 'Zona no encontrada' });
    res.json({ mensaje: 'Zona eliminada correctamente' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        mensaje: 'Hay usuarios o puntos de infraestructura en esta zona.',
        requiereForzar: true,
      });
    }
    console.error('Error al eliminar zona:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listarZonas, listarRoles, crearZona, actualizarZona, eliminarZona };
