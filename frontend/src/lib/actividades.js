// Utilidades compartidas por las pantallas de actividades (orden de trabajo del técnico).

export const esGestor = (rol) => ['administrador', 'supervisor'].includes(rol);
export const esAdmin = (rol) => rol === 'administrador';

// pendiente (amarillo, barra roja) -> en ruta (verde) -> cerrado (celeste)
export const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', cuadro: '#f2b705', barra: '#e5484d', fondo: '#fdf1dd', texto: '#a8680c' },
  en_ruta: { etiqueta: 'En ruta', cuadro: '#17a35a', barra: '#17a35a', fondo: '#e3f7ec', texto: '#0f7a42' },
  cerrado: { etiqueta: 'Cerrado', cuadro: '#2f8fd8', barra: '#2f8fd8', fondo: '#e4f1fc', texto: '#1f6fae' },
};
export const ORDEN_ESTADOS = ['pendiente', 'en_ruta', 'cerrado'];

const dos = (n) => String(n).padStart(2, '0');

export function formatoFecha(d) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
export const hoyLocal = () => formatoFecha(new Date());

export function moverDia(fecha, delta) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return formatoFecha(d);
}

export function fechaLegible(fecha) {
  if (!fecha) return '—';
  return new Date(`${String(fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function horaLegible(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function duracion(inicio, fin) {
  if (!inicio || !fin) return '—';
  const min = Math.max(0, Math.round((new Date(fin) - new Date(inicio)) / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

// "14:05" -> "2:05 PM"
export function hora12(valor) {
  if (!valor) return '';
  const [hh, mm] = String(valor).split(':').map(Number);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

export const ventana = (a) =>
  a.ventana_inicio && a.ventana_fin ? `${hora12(a.ventana_inicio)} - ${hora12(a.ventana_fin)}` : hora12(a.ventana_inicio) || '—';

export const mensajeError = (err, porDefecto) => err?.response?.data?.mensaje || porDefecto;
