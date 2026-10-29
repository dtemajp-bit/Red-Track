import { ESTADOS } from '../lib/actividades';

// Etiqueta del estado de una actividad: Pendiente (amarillo), En ruta (verde), Cerrado (celeste).
export default function EstadoActividad({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span
      style={{
        background: e.fondo, color: e.texto, display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: e.cuadro }} />
      {e.etiqueta}
    </span>
  );
}
