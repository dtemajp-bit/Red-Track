const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const {
  listarNodos,
  obtenerNodo,
  crearNodo,
  actualizarNodo,
  eliminarNodo
} = require('../controllers/nodoController');

router.use(verificarToken);

router.get('/', listarNodos);
router.get('/:id', obtenerNodo);
router.post('/', upload.single('foto'), crearNodo);
router.put('/:id', verificarAdmin, actualizarNodo);
router.delete('/:id', verificarAdmin, eliminarNodo);

module.exports = router;
