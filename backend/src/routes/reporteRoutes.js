const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');
const {
  infraestructuraPorZona,
  incidenciasPorZona,
  rutasPorTecnico,
  desempenoPorTecnico,
  exportarExcel,
} = require('../controllers/reporteController');

router.use(verificarToken);

// Filtros opcionales en todos: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&id_zona=&id_tecnico=
router.get('/infraestructura-por-zona', infraestructuraPorZona);
router.get('/incidencias-por-zona', incidenciasPorZona);
router.get('/desempeno-por-tecnico', desempenoPorTecnico);
router.get('/rutas-por-tecnico', rutasPorTecnico); // se conserva por compatibilidad con la app móvil
router.get('/exportar/excel', exportarExcel);

module.exports = router;
