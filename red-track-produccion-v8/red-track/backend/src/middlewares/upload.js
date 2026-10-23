const multer = require('multer');
const path = require('path');
const fs = require('fs');

// En Railway el disco se borra en cada despliegue. Para conservar las fotos hay
// que montar un Volume (por ejemplo en /data) y definir UPLOADS_DIR=/data/uploads.
const carpetaDestino = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(carpetaDestino)) {
  fs.mkdirSync(carpetaDestino, { recursive: true });
}

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, carpetaDestino),
  filename: (req, file, cb) => {
    const sufijo = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `nodo-${sufijo}${path.extname(file.originalname) || '.jpg'}`);
  },
});

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

// Borra una foto subida cuando la petición se rechaza (evita archivos huérfanos).
function descartarArchivo(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

module.exports = upload;
module.exports.carpetaDestino = carpetaDestino;
module.exports.descartarArchivo = descartarArchivo;
