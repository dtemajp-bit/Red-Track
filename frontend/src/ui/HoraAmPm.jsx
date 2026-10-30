import { estiloCampo } from './Modal';

// Hora con selector de AM/PM. Recibe y devuelve "HH:MM" en 24 horas ('' si no hay hora).
function descomponer(valor) {
  if (!valor) return { h: '', m: '00', p: 'AM' };
  const [hh, mm] = String(valor).split(':').map(Number);
  return { h: String(hh % 12 === 0 ? 12 : hh % 12), m: String(mm).padStart(2, '0'), p: hh >= 12 ? 'PM' : 'AM' };
}
function componer({ h, m, p }) {
  if (!h) return '';
  const base = Number(h) % 12;
  return `${String(p === 'PM' ? base + 12 : base).padStart(2, '0')}:${m}`;
}

export default function HoraAmPm({ valor, onChange, etiqueta }) {
  const t = descomponer(valor);
  const minutos = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  if (!minutos.includes(t.m)) minutos.push(t.m);
  const cambiar = (parte) => (e) => {
    const nuevo = { ...t, [parte]: e.target.value };
    onChange(componer(nuevo));
  };
  const corto = { ...estiloCampo, padding: '10px 8px' };
  return (
    <div style={{ display: 'flex', gap: 6 }} role="group" aria-label={etiqueta}>
      <select value={t.h} onChange={cambiar('h')} style={corto} aria-label={`${etiqueta}: hora`}>
        <option value="">--</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select value={t.m} onChange={cambiar('m')} disabled={!t.h} style={corto} aria-label={`${etiqueta}: minutos`}>
        {minutos.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={t.p} onChange={cambiar('p')} disabled={!t.h} style={corto} aria-label={`${etiqueta}: AM o PM`}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
