import cliente from '../api/cliente';

// Elimina un registro pidiendo confirmación. Si el servidor avisa que tiene datos
// asociados (409 + requiereForzar), pregunta de nuevo y lo borra junto con ellos.
// Devuelve true si se eliminó, false si la persona canceló. Lanza error si falla.
export async function eliminarConConfirmacion(ruta, mensajeConfirmar, mensajeForzar) {
  if (!window.confirm(mensajeConfirmar)) return false;
  try {
    await cliente.delete(ruta);
    return true;
  } catch (err) {
    if (err.response?.status === 409 && err.response.data?.requiereForzar) {
      const detalle = err.response.data.mensaje || '';
      if (!window.confirm(`${detalle}\n\n${mensajeForzar}`)) return false;
      await cliente.delete(`${ruta}${ruta.includes('?') ? '&' : '?'}forzar=true`);
      return true;
    }
    throw err;
  }
}
