const express = require('express');
const router = express.Router();
const { verificarToken, verificarAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const {
  actualizarMiFotoPerfil,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  restablecerContrasena,
  eliminarUsuario,
} = require('../controllers/usuarioController');

router.use(verificarToken);

router.put('/perfil/foto', upload.single('foto'), actualizarMiFotoPerfil);

// Gestión de usuarios: solo administradores
router.get('/', verificarAdmin, listarUsuarios);
router.post('/', verificarAdmin, crearUsuario);
router.put('/:id', verificarAdmin, actualizarUsuario);
router.put('/:id/estado', verificarAdmin, cambiarEstadoUsuario);
router.put('/:id/contrasena', verificarAdmin, restablecerContrasena);
router.delete('/:id', verificarAdmin, eliminarUsuario);

module.exports = router;
