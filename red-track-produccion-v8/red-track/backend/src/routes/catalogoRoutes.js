const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const { listarZonas, listarRoles, crearZona, actualizarZona, eliminarZona } = require('../controllers/catalogoController');

router.use(verificarToken);

router.get('/zonas', listarZonas);
router.get('/roles', listarRoles);
router.post('/zonas', verificarAdmin, crearZona);
router.put('/zonas/:id', verificarAdmin, actualizarZona);
router.delete('/zonas/:id', verificarAdmin, eliminarZona);

module.exports = router;
