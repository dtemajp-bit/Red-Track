// Avisos (toasts) y confirmaciones propias de la app. Funcionan desde cualquier
// archivo, sin hooks: emiten un evento que escucha <Avisos /> (montado en App).

// Muestra un aviso temporal. tipo: 'exito' | 'error' | 'info' | 'alerta'
export function avisar(texto, tipo = 'exito') {
  window.dispatchEvent(new CustomEvent('rt-aviso', { detail: { texto, tipo } }));
}

// Pide confirmación. Acepta un texto o { titulo, mensaje, textoConfirmar, peligro }.
// Devuelve una promesa con true (confirmó) o false (canceló).
export function confirmar(opciones) {
  const o = typeof opciones === 'string' ? { mensaje: opciones } : opciones;
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent('rt-confirmar', {
        detail: {
          titulo: 'Confirmar acción',
          textoConfirmar: 'Confirmar',
          peligro: false,
          ...o,
          resolve,
        },
      })
    );
  });
}
