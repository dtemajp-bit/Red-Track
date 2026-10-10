const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');
const { infraestructuraPorZona, incidenciasPorZona, rutasPorTecnico } = require('../controllers/reporteController');

router.use(verificarToken);

router.get('/infraestructura-por-zona', infraestructuraPorZona);
router.get('/incidencias-por-zona', incidenciasPorZona);
router.get('/rutas-por-tecnico', rutasPorTecnico);

module.exports = router;
