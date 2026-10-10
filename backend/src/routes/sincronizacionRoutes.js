const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');
const { listarPendientes, crearPendiente, sincronizarUno } = require('../controllers/sincronizacionController');

router.use(verificarToken);

router.get('/pendientes', listarPendientes);
router.post('/', crearPendiente);
router.put('/:id/sincronizar', sincronizarUno);

module.exports = router;
