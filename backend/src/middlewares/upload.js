const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

// Las fotos se guardan en la base de datos (tabla "fotos"), no en el disco, para
// que no se pierdan cuando el servidor se reinicia o se vuelve a desplegar
// (en Render y Railway el disco es temporal).
// carpetaDestino se conserva solo para servir fotos antiguas guardadas en disco.
const carpetaDestino = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

// Motor de almacenamiento de multer: junta el archivo en memoria y lo inserta en la tabla fotos.
const almacenamiento = {
  _handleFile(req, file, cb) {
    const partes = [];
    file.stream.on('data', (parte) => partes.push(parte));
    file.stream.on('error', cb);
    file.stream.on('end', async () => {
      try {
        const datos = Buffer.concat(partes);
        const sufijo = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const nombre = `nodo-${sufijo}${path.extname(file.originalname) || '.jpg'}`.slice(0, 120);
        await pool.query('INSERT INTO fotos (nombre, tipo, datos) VALUES (?, ?, ?)', [
          nombre,
          file.mimetype,
          datos,
        ]);
        cb(null, { filename: nombre, size: datos.length });
      } catch (error) {
        cb(error);
      }
    });
  },
  _removeFile(req, file, cb) {
    pool.query('DELETE FROM fotos WHERE nombre = ?', [file.filename]).then(() => cb(null), cb);
  },
};

function filtroArchivo(req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'));
  }
}

const upload = multer({
  storage: almacenamiento,
  fileFilter: filtroArchivo,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Borra una foto subida cuando la petición se rechaza (evita fotos huérfanas).
function descartarArchivo(file) {
  if (!file) return;
  if (file.filename) pool.query('DELETE FROM fotos WHERE nombre = ?', [file.filename]).catch(() => {});
  if (file.path) fs.unlink(file.path, () => {});
}

module.exports = upload;
module.exports.carpetaDestino = carpetaDestino;
module.exports.descartarArchivo = descartarArchivo;
