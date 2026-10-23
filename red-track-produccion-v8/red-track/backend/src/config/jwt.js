require('dotenv').config();

// En producción es obligatorio definir JWT_SECRET: si no, cualquiera que lea
// el código podría fabricar tokens válidos.
const SECRETO_LOCAL = 'clave_secreta_red_track_local';

function obtenerSecreto() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('FALTA la variable JWT_SECRET en producción. Defínela en Railway.');
    process.exit(1);
  }
  return SECRETO_LOCAL;
}

module.exports = { JWT_SECRET: obtenerSecreto() };
