// Cola de registros guardados en el navegador cuando no hay conexión.
// Se envían después desde la pantalla Sincronización (o solos al volver la señal).
import cliente from '../api/cliente';

const CLAVE = 'cola_pendientes_web_v1';

function leerTodo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '[]');
  } catch {
    return [];
  }
}

function escribirTodo(lista) {
  localStorage.setItem(CLAVE, JSON.stringify(lista));
  window.dispatchEvent(new Event('cola-sync-cambio'));
}

// Solo se ven los registros del usuario con sesión (varios técnicos pueden compartir equipo).
export function obtenerCola(idUsuario) {
  return leerTodo().filter((r) => r.id_usuario === idUsuario);
}

export function nuevoId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

// Las fotos no caben en localStorage: si el registro tiene foto se guarda como
// data URL reducida; si aun así no cabe, se guarda sin foto y se avisa.
export function agregarACola(registro) {
  const todo = leerTodo();
  const nuevo = { ...registro, idLocal: nuevoId(), creadoEn: new Date().toISOString() };
  todo.push(nuevo);
  try {
    escribirTodo(todo);
  } catch {
    if (nuevo.foto) {
      nuevo.foto = null;
      nuevo.fotoOmitida = true;
      escribirTodo(todo);
    } else {
      throw new Error('No hay espacio para guardar el registro en este navegador');
    }
  }
  return nuevo;
}

export function quitarDeCola(idLocal) {
  escribirTodo(leerTodo().filter((r) => r.idLocal !== idLocal));
}

function dataUrlABlob(dataUrl) {
  const [cabecera, base64] = dataUrl.split(',');
  const tipo = /data:(.*?);base64/.exec(cabecera)?.[1] || 'image/jpeg';
  const bytes = atob(base64);
  const arreglo = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arreglo[i] = bytes.charCodeAt(i);
  return new Blob([arreglo], { type: tipo });
}

// Convierte una foto elegida en un data URL pequeño (máx. 1280 px) para poder guardarla en la cola.
export function reducirFoto(archivo, maximo = 1280, calidad = 0.7) {
  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve(lienzo.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => resolve(null);
      img.src = lector.result;
    };
    lector.onerror = () => resolve(null);
    lector.readAsDataURL(archivo);
  });
}

// Envía un registro al servidor. Lanza el error de axios si falla
// (err.response === undefined cuando el problema es de conexión).
export async function enviarRegistro(registro) {
  if (registro.tipo === 'nodo') {
    const datos = new FormData();
    Object.entries(registro.datos).forEach(([k, v]) => datos.append(k, v ?? ''));
    datos.append('uuid_cliente', registro.idLocal);
    datos.append('capturado_en', registro.creadoEn);
    if (registro.foto) datos.append('foto', dataUrlABlob(registro.foto), 'foto.jpg');
    await cliente.post('/nodos', datos);
  } else if (registro.tipo === 'incidencia') {
    await cliente.post('/incidencias', {
      ...registro.datos,
      uuid_cliente: registro.idLocal,
      capturado_en: registro.creadoEn,
    });
  }
}

export function esErrorDeRed(err) {
  return !err.response;
}
