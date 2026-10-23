import axios from 'axios';

// La URL del backend se define con la variable VITE_API_URL (en Vercel o en un
// archivo .env). Ejemplo: https://red-track-api.up.railway.app/api
// Si no existe, se usa el backend local de desarrollo.
const URL_API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

// Origen del servidor (sin /api): sirve para armar las URLs de las fotos.
export const ORIGEN_ARCHIVOS = URL_API.replace(/\/api$/, '');

const cliente = axios.create({
  baseURL: URL_API,
});

cliente.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si la sesión venció (el token dura 8 horas), se limpia y se vuelve al login.
cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const esLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !esLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default cliente;
