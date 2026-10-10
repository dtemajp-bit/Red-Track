const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

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
    next();
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

module.exports = { verificarToken, verificarAdmin };
