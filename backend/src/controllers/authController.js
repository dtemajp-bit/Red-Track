const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../config/jwt');

async function login(req, res) {
  const correo = typeof req.body.correo === 'string' ? req.body.correo.trim() : '';
  const contrasena = req.body.contrasena;

  if (!correo || !contrasena) {
    return res.status(400).json({ mensaje: 'Correo y contrasena son requeridos' });
  }

  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.correo, u.contrasena_hash,
              r.nombre AS rol, u.id_zona, u.activo, u.estado_cuenta, u.foto_perfil
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.correo = ?`,
      [correo]
    );

    if (filas.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales invalidas' });
    }

    const usuario = filas[0];

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: usuario.estado_cuenta === 'suspendido'
          ? 'Cuenta suspendida, contacte al administrador'
          : 'Usuario inactivo, contacte al administrador',
      });
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!coincide) {
      return res.status(401).json({ mensaje: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol,
        id_zona: usuario.id_zona,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre_completo: usuario.nombre_completo,
        correo: usuario.correo,
        rol: usuario.rol,
        id_zona: usuario.id_zona,
        foto_perfil: usuario.foto_perfil
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { login };
