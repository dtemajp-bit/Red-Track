// Etiqueta de estado. El color se decide por el texto, siguiendo la
// convención del DERCAS: verde = completado/activo, celeste = en progreso,
// naranja = pendiente, rojo = dañado/crítico.

const MAPA_TONO = {
  completada: 'verde',
  completado: 'verde',
  activo: 'verde',
  active: 'verde',
  resuelta: 'verde',
  'en progreso': 'celeste',
  'en_progreso': 'celeste',
  en_atencion: 'celeste',
  pendiente: 'naranja',
  abierta: 'naranja',
  'en revisión': 'naranja',
  en_revision: 'naranja',
  mantenimiento: 'naranja',
  dañado: 'rojo',
  danado: 'rojo',
  inactivo: 'rojo',
  critica: 'rojo',
};

const ESTILOS = {
  verde: { color: 'var(--green)', background: 'var(--green-bg)' },
  celeste: { color: 'var(--celeste-dark)', background: 'var(--celeste-bg)' },
  naranja: { color: 'var(--orange)', background: 'var(--orange-bg)' },
  rojo: { color: 'var(--red)', background: 'var(--red-bg)' },
  neutro: { color: 'var(--text-muted)', background: '#eef0f4' },
};

export default function Badge({ children, tono }) {
  const clave = (tono || String(children)).toLowerCase().trim();
  const estilo = ESTILOS[MAPA_TONO[clave] || 'neutro'];
  return (
    <span
      style={{
        ...estilo,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
