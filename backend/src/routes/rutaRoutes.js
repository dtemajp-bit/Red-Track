const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const { obtenerMiRuta, marcarPuntoVisitado, listarRutas, crearRuta } = require('../controllers/rutaController');

router.use(verificarToken);

router.get('/mia', obtenerMiRuta);
router.put('/puntos/:id', marcarPuntoVisitado);
router.get('/', verificarAdmin, listarRutas);
router.post('/', verificarAdmin, crearRuta);

module.exports = router;
