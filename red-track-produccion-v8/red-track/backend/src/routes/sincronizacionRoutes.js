const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const { listarPendientes, crearPendiente, sincronizarUno, historial, resumenPorTecnico } = require('../controllers/sincronizacionController');

router.use(verificarToken);

router.get('/pendientes', listarPendientes);
router.get('/historial', historial);
router.get('/resumen', verificarAdmin, resumenPorTecnico);
router.post('/', crearPendiente);
router.put('/:id/sincronizar', sincronizarUno);

module.exports = router;
