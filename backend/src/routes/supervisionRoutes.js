const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin, verificarGestor } = require('../middlewares/auth');
const c = require('../controllers/supervisionController');

router.use(verificarToken, verificarGestor);

// Check list (antes de /:id)
router.get('/items', c.listarItems);
router.post('/items', verificarAdmin, c.crearItem);
router.put('/items/:id', verificarAdmin, c.actualizarItem);
router.delete('/items/:id', verificarAdmin, c.eliminarItem);
router.get('/supervisores', verificarAdmin, c.supervisores);

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id/calificar', c.calificar);
router.delete('/:id', c.quitar);

module.exports = router;
