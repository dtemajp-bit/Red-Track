const pool = require('../config/db');
const { descartarArchivo } = require('../middlewares/upload');

const TIPOS = ['poste', 'nodo_central', 'caja_distribucion'];
const ESTADOS = ['activo', 'inactivo', 'mantenimiento'];

async function listarNodos(req, res) {
  try {
    const [nodos] = await pool.query(
      `SELECT n.*, z.nombre AS nombre_zona
       FROM nodos n
       LEFT JOIN zonas z ON n.id_zona = z.id_zona
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

async function crearNodo(req, res) {
  const { codigo, tipo, latitud, longitud, estado, observaciones, id_zona } = req.body;

  const errorValidacion = validarNodo(req.body);
  if (errorValidacion) {
    descartarArchivo(req.file);
    return res.status(400).json({ mensaje: errorValidacion });
  }

  const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
  // Si no se indica zona, el punto queda en la zona del técnico que lo registra.
  const zona = id_zona || req.usuario.id_zona || null;

  try {
    const [resultado] = await pool.query(
      `INSERT INTO nodos (codigo, tipo, latitud, longitud, estado, observaciones, foto_url, id_zona)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [String(codigo).trim(), tipo, latitud, longitud, estado || 'activo', observaciones || null, foto_url, zona]
    );
    res.status(201).json({ id_nodo: resultado.insertId, foto_url, mensaje: 'Nodo creado correctamente' });
  } catch (error) {
    descartarArchivo(req.file);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un nodo con ese codigo' });
    }
    console.error('Error al crear nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function actualizarNodo(req, res) {
  const { codigo, tipo, latitud, longitud, estado, observaciones, id_zona } = req.body;

  const errorValidacion = validarNodo(req.body);
  if (errorValidacion) {
    return res.status(400).json({ mensaje: errorValidacion });
  }

  try {
    const [resultado] = await pool.query(
      `UPDATE nodos SET codigo = ?, tipo = ?, latitud = ?, longitud = ?, estado = ?,
              observaciones = ?, id_zona = ?
       WHERE id_nodo = ?`,
      [String(codigo).trim(), tipo, latitud, longitud, estado || 'activo', observaciones || null, id_zona || null, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Nodo no encontrado' });
    }
    res.json({ mensaje: 'Nodo actualizado correctamente' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un nodo con ese codigo' });
    }
    console.error('Error al actualizar nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function eliminarNodo(req, res) {
  try {
    const [resultado] = await pool.query('DELETE FROM nodos WHERE id_nodo = ?', [req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Nodo no encontrado' });
    }
    res.json({ mensaje: 'Nodo eliminado correctamente' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res
        .status(409)
        .json({ mensaje: 'No se puede eliminar: el nodo tiene rutas, incidencias o cables asociados. Márcalo como inactivo.' });
    }
    console.error('Error al eliminar nodo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listarNodos, obtenerNodo, crearNodo, actualizarNodo, eliminarNodo, validarNodo };
