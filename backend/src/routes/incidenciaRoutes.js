const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');
const {
  listarIncidencias,
  crearIncidencia,
  actualizarEstadoIncidencia
} = require('../controllers/incidenciaController');

router.use(verificarToken);

router.get('/', listarIncidencias);
router.post('/', crearIncidencia);
router.put('/:id/estado', actualizarEstadoIncidencia);

module.exports = router;
