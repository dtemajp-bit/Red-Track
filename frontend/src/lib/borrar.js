import cliente from '../api/cliente';
import { confirmar } from './avisos';

// Elimina un registro pidiendo confirmación. Si el servidor avisa que tiene datos
// asociados (409 + requiereForzar), pregunta de nuevo y lo borra junto con ellos.
// Devuelve true si se eliminó, false si la persona canceló. Lanza error si falla.
export async function eliminarConConfirmacion(ruta, mensajeConfirmar, mensajeForzar) {
  const quiere = await confirmar({
    titulo: 'Confirmar eliminación',
    mensaje: mensajeConfirmar,
    textoConfirmar: 'Eliminar',
    peligro: true,
  });
  if (!quiere) return false;
  try {
    await cliente.delete(ruta);
    return true;
  } catch (err) {
    if (err.response?.status === 409 && err.response.data?.requiereForzar) {
      const detalle = err.response.data.mensaje || '';
      const forzar = await confirmar({
        titulo: 'Hay datos asociados',
        mensaje: `${detalle}\n\n${mensajeForzar}`,
        textoConfirmar: 'Eliminar de todos modos',
        peligro: true,
      });
      if (!forzar) return false;
      await cliente.delete(`${ruta}${ruta.includes('?') ? '&' : '?'}forzar=true`);
      return true;
    }
    throw err;
  }
}
