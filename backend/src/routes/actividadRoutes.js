const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin, verificarGestor } = require('../middlewares/auth');
const c = require('../controllers/actividadController');

router.use(verificarToken);

// Catálogos, técnicos e inventario (antes de /:id para que no se confundan)
// Administrador: crea y gestiona. Supervisor: solo supervisa (ver) y trabaja en lo que se le asigne.
router.get('/tecnicos', verificarGestor, c.listarTecnicos);
router.get('/catalogos/materiales', verificarAdmin, c.listarMateriales);
router.post('/catalogos/materiales', verificarAdmin, c.crearMaterial);
router.put('/catalogos/materiales/:id', verificarAdmin, c.actualizarMaterial);
router.delete('/catalogos/materiales/:id', verificarAdmin, c.eliminarMaterial);
router.get('/catalogos/mano-obra', verificarAdmin, c.listarManoObra);
router.post('/catalogos/mano-obra', verificarAdmin, c.crearManoObra);
router.put('/catalogos/mano-obra/:id', verificarAdmin, c.actualizarManoObra);
router.delete('/catalogos/mano-obra/:id', verificarAdmin, c.eliminarManoObra);
router.get('/inventario/:idTecnico', c.verInventarioTecnico);
router.put('/inventario/:idTecnico', verificarAdmin, c.fijarInventarioTecnico);
router.post('/inventario/:idTecnico/series', verificarAdmin, c.agregarSeriesTecnico);
router.delete('/inventario/series/:idSerie', verificarAdmin, c.eliminarSerie);

// Actividades
router.get('/', c.listarActividades);
router.post('/', verificarAdmin, c.crearActividad);
router.get('/:id', c.obtenerActividad);
router.put('/:id', verificarAdmin, c.actualizarActividad);
router.delete('/:id', verificarAdmin, c.eliminarActividad);
router.put('/:id/iniciar', c.iniciarActividad);
router.put('/:id/cerrar', c.cerrarActividad);
router.put('/:id/reabrir', verificarAdmin, c.reabrirActividad);

// Mano de obra e inventario usados en la actividad
router.post('/:id/mano-obra', c.agregarManoObra);
router.put('/:id/mano-obra/:idLinea', c.cambiarManoObra);
router.delete('/:id/mano-obra/:idLinea', c.quitarManoObra);
router.post('/:id/series', c.usarSeries);
router.delete('/:id/series/:idSerie', c.quitarSerie);
router.post('/:id/materiales', c.agregarMaterial);
router.put('/:id/materiales/:idLinea', c.cambiarMaterial);
router.delete('/:id/materiales/:idLinea', c.quitarMaterial);

module.exports = router;
