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

module.exports = { listarZonas, listarRoles, crearZona };
