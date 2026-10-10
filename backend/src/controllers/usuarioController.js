const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function listarUsuarios(req, res) {
  try {
    const [usuarios] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.correo, u.activo, u.foto_perfil,
              r.id_rol, r.nombre AS rol,
              z.id_zona, z.nombre AS zona
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       LEFT JOIN zonas z ON u.id_zona = z.id_zona
       ORDER BY u.nombre_completo`
    );
    res.json(usuarios);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function crearUsuario(req, res) {
  const { nombre_completo, correo, contrasena, id_rol, id_zona } = req.body;

  if (!nombre_completo || !correo || !contrasena || !id_rol) {
    return res.status(400).json({ mensaje: 'nombre_completo, correo, contrasena e id_rol son requeridos' });
  }
  if (!/^\S+@\S+\.\S+$/.test(correo)) {
    return res.status(400).json({ mensaje: 'El correo no tiene un formato válido' });
  }
  if (String(contrasena).length < 8) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const hash = await bcrypt.hash(contrasena, 10);
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, id_rol, id_zona)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre_completo.trim(), correo.trim(), hash, id_rol, id_zona || null]
    );
    res.status(201).json({ id_usuario: resultado.insertId, mensaje: 'Usuario creado correctamente' });
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ mensaje: 'El rol o la zona elegidos no existen' });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo' });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function actualizarUsuario(req, res) {
  const { nombre_completo, id_rol, id_zona } = req.body;
  try {
    const [resultado] = await pool.query(
      `UPDATE usuarios SET nombre_completo = ?, id_rol = ?, id_zona = ? WHERE id_usuario = ?`,
      [nombre_completo, id_rol, id_zona || null, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Activa/desactiva un usuario en vez de borrarlo, ya que hay tablas
// (nodos, incidencias, rutas) que referencian id_usuario.
async function cambiarEstadoUsuario(req, res) {
  const { activo } = req.body;
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo activo debe ser true o false' });
  }
  if (!activo && Number(req.params.id) === req.usuario.id_usuario) {
    return res.status(400).json({ mensaje: 'No puedes desactivar tu propio usuario' });
  }
  try {
    const [resultado] = await pool.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [
      activo,
      req.params.id,
    ]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// El usuario solo puede cambiar SU PROPIA foto (toma el id del token, nunca de la URL/body).
async function actualizarMiFotoPerfil(req, res) {
  if (!req.file) {
    return res.status(400).json({ mensaje: 'No se recibió ninguna imagen' });
  }

  const foto_perfil = `/uploads/${req.file.filename}`;
  const id_usuario = req.usuario.id_usuario;

  try {
    await pool.query('UPDATE usuarios SET foto_perfil = ? WHERE id_usuario = ?', [
      foto_perfil,
      id_usuario,
    ]);
    res.json({ foto_perfil, mensaje: 'Foto de perfil actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar foto de perfil:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = {
  actualizarMiFotoPerfil,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};
