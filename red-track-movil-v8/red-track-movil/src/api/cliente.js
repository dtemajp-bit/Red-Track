import AsyncStorage from '@react-native-async-storage/async-storage';

// URL del backend. Se define con la variable EXPO_PUBLIC_API_URL:
//  - Al compilar el APK: en eas.json (perfil "preview"/"production").
//  - En desarrollo: en un archivo .env (ver .env.example) o se usa el valor por defecto.
// Ejemplo en producción: https://red-track-api.up.railway.app/api
const URL_API = (process.env.EXPO_PUBLIC_API_URL || 'http://10.74.65.107:4000/api').replace(/\/$/, '');

// Origen del servidor (sin /api): sirve para armar las URLs de las fotos.
export const ORIGEN_ARCHIVOS = URL_API.replace(/\/api$/, '');

// Cuando el servidor responde 401 (sesión vencida) se limpia la sesión y se
// vuelve al login. AuthContext registra aquí la función que lo hace.
let alSesionVencida = null;
export function registrarSesionVencida(funcion) {
  alSesionVencida = funcion;
}

// Cliente HTTP hecho con fetch nativo (no axios): en este entorno de
// Expo/React Native + Android, axios daba "Network Error" genéricos que no
// dejaban ver la causa real. fetch es el que trae React Native y funciona
// de forma confiable aquí. La forma de uso (cliente.get/post/put, .data,
// err.response.data.mensaje) se mantiene igual a como estaba con axios para
// no tener que tocar las pantallas.
async function peticion(metodo, ruta, cuerpo, config = {}) {
  const token = await AsyncStorage.getItem('token');
  const esFormData = typeof FormData !== 'undefined' && cuerpo instanceof FormData;

  const headers = { ...(config.headers || {}) };
  // Con FormData NO se fija Content-Type: fetch agrega el "boundary" correcto.
  delete headers['Content-Type'];
  if (!esFormData && cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // Sin tiempo límite, con mala señal la app se queda cargando para siempre.
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), esFormData ? 60000 : 25000);

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : esFormData ? cuerpo : JSON.stringify(cuerpo),
      signal: controlador.signal,
    });
  } catch (error) {
    // Error de red real: sin conexión, tiempo agotado o backend caído.
    const errorRed = new Error('No se pudo conectar con el servidor');
    errorRed.response = null;
    throw errorRed;
  } finally {
    clearTimeout(temporizador);
  }

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && !ruta.startsWith('/auth/login')) {
      await AsyncStorage.multiRemove(['token', 'usuario']);
      if (alSesionVencida) alSesionVencida();
    }
    const error = new Error((datos && datos.mensaje) || `Error ${respuesta.status}`);
    error.response = { status: respuesta.status, data: datos };
    throw error;
  }

  return { data: datos, status: respuesta.status };
}

const cliente = {
  defaults: { baseURL: URL_API },
  get: (ruta, config) => peticion('GET', ruta, undefined, config),
  post: (ruta, cuerpo, config) => peticion('POST', ruta, cuerpo, config),
  put: (ruta, cuerpo, config) => peticion('PUT', ruta, cuerpo, config),
  delete: (ruta, config) => peticion('DELETE', ruta, undefined, config),
};

export default cliente;
