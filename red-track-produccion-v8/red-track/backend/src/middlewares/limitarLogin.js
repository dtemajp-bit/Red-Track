// Limitador simple en memoria: máximo 10 intentos fallidos de login por IP
// cada 15 minutos. Protege contra adivinar contraseñas una vez publicado en internet.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 10;
const intentos = new Map(); // ip -> { fallos, desde }

function limpiarVencidos() {
  const ahora = Date.now();
  for (const [ip, dato] of intentos) {
    if (ahora - dato.desde > VENTANA_MS) intentos.delete(ip);
  }
}
setInterval(limpiarVencidos, VENTANA_MS).unref();

function limitarLogin(req, res, next) {
  const dato = intentos.get(req.ip);
  if (dato && Date.now() - dato.desde <= VENTANA_MS && dato.fallos >= MAX_FALLOS) {
    return res.status(429).json({ mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
  }

  res.on('finish', () => {
    if (res.statusCode === 401) {
      const actual = intentos.get(req.ip);
      if (!actual || Date.now() - actual.desde > VENTANA_MS) {
        intentos.set(req.ip, { fallos: 1, desde: Date.now() });
      } else {
        actual.fallos += 1;
      }
    } else if (res.statusCode === 200) {
      intentos.delete(req.ip);
    }
  });
  next();
}

module.exports = limitarLogin;
