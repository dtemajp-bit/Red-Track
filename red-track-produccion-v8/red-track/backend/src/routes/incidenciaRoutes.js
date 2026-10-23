const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const {
  listarIncidencias,
  crearIncidencia,
  actualizarEstadoIncidencia,
  actualizarIncidencia,
  eliminarIncidencia
} = require('../controllers/incidenciaController');

router.use(verificarToken);

router.get('/', listarIncidencias);
router.post('/', crearIncidencia);
router.put('/:id/estado', actualizarEstadoIncidencia);
router.put('/:id', verificarAdmin, actualizarIncidencia);
router.delete('/:id', verificarAdmin, eliminarIncidencia);

module.exports = router;
