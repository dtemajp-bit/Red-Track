// Cola de registros guardados en el teléfono cuando no hay señal.
// Los técnicos trabajan en campo, donde la cobertura falla: en vez de perder el
// registro, se guarda aquí y se envía después desde la pantalla Sincronización.
import AsyncStorage from '@react-native-async-storage/async-storage';
import cliente from '../api/cliente';

const CLAVE = 'cola_pendientes_v1';

async function leerTodo() {
  try {
    const texto = await AsyncStorage.getItem(CLAVE);
    return texto ? JSON.parse(texto) : [];
  } catch {
    return [];
  }
}

async function escribirTodo(lista) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(lista));
}

// Solo se ven los registros del usuario que inició sesión (varios técnicos
// pueden compartir un mismo teléfono).
export async function obtenerCola(idUsuario) {
  const todo = await leerTodo();
  return todo.filter((r) => r.id_usuario === idUsuario);
}

// Identificador único de un registro: se asigna al crearlo (antes del primer
// intento de envío) para que, si la respuesta se pierde y se reintenta desde la
// cola, el servidor reconozca que ya lo recibió y no lo duplique.
export function nuevoIdLocal() {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export async function agregarACola(registro) {
  const todo = await leerTodo();
  const nuevo = {
    ...registro,
    idLocal: registro.idLocal || nuevoIdLocal(),
    creadoEn: registro.creadoEn || new Date().toISOString(),
    desdeCola: true,
  };
  todo.push(nuevo);
  await escribirTodo(todo);
  return nuevo;
}

export async function quitarDeCola(idLocal) {
  const todo = await leerTodo();
  await escribirTodo(todo.filter((r) => r.idLocal !== idLocal));
}

// Envía un registro al servidor. Lanza error si falla (con err.response = null
// cuando el problema es de conexión).
export async function enviarRegistro(registro) {
  if (registro.tipo === 'nodo') {
    const datos = new FormData();
    Object.entries(registro.datos).forEach(([clave, valor]) => {
      datos.append(clave, valor === undefined || valor === null ? '' : String(valor));
    });
    // El servidor usa estos dos datos para no duplicar un reintento y para saber
    // cuándo se capturó el registro realmente (si se guardó sin señal).
    if (registro.idLocal) datos.append('uuid_cliente', registro.idLocal);
    if (registro.desdeCola && registro.creadoEn) datos.append('capturado_en', registro.creadoEn);
    if (registro.foto) {
      datos.append('foto', {
        uri: registro.foto.uri,
        name: registro.foto.name || 'foto.jpg',
        type: registro.foto.type || 'image/jpeg',
      });
    }
    await cliente.post('/nodos', datos);
  } else if (registro.tipo === 'incidencia') {
    await cliente.post('/incidencias', {
      ...registro.datos,
      ...(registro.idLocal ? { uuid_cliente: registro.idLocal } : {}),
      ...(registro.desdeCola && registro.creadoEn ? { capturado_en: registro.creadoEn } : {}),
    });
  }
}
