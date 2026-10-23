const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const { limpiarDatosOperativos } = require('../controllers/adminController');

router.use(verificarToken, verificarAdmin);

router.post('/limpiar-datos', limpiarDatosOperativos);

module.exports = router;
