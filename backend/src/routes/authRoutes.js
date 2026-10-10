const express = require('express');
const router = express.Router();
const limitarLogin = require('../middlewares/limitarLogin');
const { login } = require('../controllers/authController');

router.post('/login', limitarLogin, login);

module.exports = router;
