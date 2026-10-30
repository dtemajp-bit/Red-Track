const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const pool = require('../config/db');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // 401 = sesión vencida o inválida: el cliente debe volver al login.
      return res.status(401).json({ mensaje: 'Sesión vencida. Inicia sesión de nuevo.' });
    }
    req.usuario = decoded;
    // Una cuenta suspendida o inactiva pierde el acceso aunque su sesión siga abierta.
    pool.query('SELECT activo, estado_cuenta FROM usuarios WHERE id_usuario = ?', [decoded.id_usuario])
      .then(([filas]) => {
        if (filas.length === 0 || !filas[0].activo) {
          const suspendida = filas.length > 0 && filas[0].estado_cuenta === 'suspendido';
          return res.status(401).json({ mensaje: suspendida ? 'Tu cuenta está suspendida. Contacta al administrador.' : 'Tu usuario está inactivo. Contacta al administrador.' });
        }
        next();
      })
      .catch(() => res.status(500).json({ mensaje: 'Error interno del servidor' }));
  });
}

// Requiere que el usuario autenticado tenga rol "administrador".
// Debe usarse siempre después de verificarToken.
function verificarAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'administrador') {
    return res.status(403).json({ mensaje: 'Acceso restringido a administradores' });
  }
  next();
}

// Administrador o supervisor (los que gestionan actividades, catálogos e inventario).
function verificarGestor(req, res, next) {
  if (!req.usuario || !['administrador', 'supervisor'].includes(req.usuario.rol)) {
    return res.status(403).json({ mensaje: 'Acceso restringido a administradores y supervisores' });
  }
  next();
}

module.exports = { verificarToken, verificarAdmin, verificarGestor };
