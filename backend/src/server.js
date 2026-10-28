const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const { carpetaDestino } = require('./middlewares/upload');
const { inicializarConReintentos } = require('./db/init');

const authRoutes = require('./routes/authRoutes');
const nodoRoutes = require('./routes/nodoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const incidenciaRoutes = require('./routes/incidenciaRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');
const rutaRoutes = require('./routes/rutaRoutes');
const sincronizacionRoutes = require('./routes/sincronizacionRoutes');
const reporteRoutes = require('./routes/reporteRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Railway pone un proxy delante: necesario para ver la IP real del cliente.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// CORS_ORIGINS = lista separada por comas de las URLs del frontend permitidas
// (ej. https://red-track.vercel.app). Vacío = permitir todas (solo desarrollo).
// La app móvil no envía "Origin", por eso siempre se permite.
const origenesPermitidos = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origen, callback) => {
      if (!origen || origenesPermitidos.length === 0 || origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    },
  })
);
app.use(express.json());

// Fotos guardadas en la base de datos; si no está ahí, se busca en el disco (fotos antiguas).
app.get('/uploads/:nombre', async (req, res, next) => {
  try {
    const [filas] = await pool.query('SELECT tipo, datos FROM fotos WHERE nombre = ?', [req.params.nombre]);
    if (filas.length === 0) return next();
    res.set('Content-Type', filas[0].tipo);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(filas[0].datos);
  } catch (error) {
    return next(error);
  }
});
app.use('/uploads', express.static(carpetaDestino));

app.get('/', (req, res) => {
  res.json({ servicio: 'Red-Track API', estado: 'ok' });
});

app.get('/api/salud', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ estado: 'ok', mensaje: 'API Red-Track funcionando', baseDeDatos: 'conectada' });
  } catch (error) {
    res.status(503).json({ estado: 'error', mensaje: 'Sin conexión a la base de datos' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/nodos', nodoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/incidencias', incidenciaRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/sincronizacion', sincronizacionRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Errores de subida de archivos (tamaño, tipo) y de CORS: respuesta JSON clara.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ mensaje: 'La imagen supera el máximo de 8 MB' });
  }
  if (err && (err.name === 'MulterError' || err.message === 'Solo se permiten imágenes')) {
    return res.status(400).json({ mensaje: err.message });
  }
  if (err && err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ mensaje: err.message });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;

inicializarConReintentos()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor Red-Track corriendo en el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo preparar la base de datos:', error.message);
    process.exit(1);
  });
