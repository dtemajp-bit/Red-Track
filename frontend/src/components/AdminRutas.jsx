import { useEffect, useState } from 'react';
import cliente from '../api/cliente';
import Badge from '../ui/Badge';

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '11px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };
const campo = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13.5,
};

const hoy = () => new Date().toISOString().slice(0, 10);

// Pestaña "Rutas" de Administración: el administrador asigna a cada técnico
// la ruta (lista ordenada de puntos) que verá en su Panel del técnico.
export default function AdminRutas({ tecnicos, mostrarForm, onCerrarForm }) {
  const [rutas, setRutas] = useState([]);
  const [nodos, setNodos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ nombre: '', id_tecnico: '', fecha_programada: hoy() });
  const [seleccion, setSeleccion] = useState([]); // ids de nodos, en el orden elegido

  async function cargar() {
    try {
      const [resRutas, resNodos] = await Promise.all([cliente.get('/rutas'), cliente.get('/nodos')]);
      setRutas(resRutas.data);
      setNodos(resNodos.data);
      setError('');
    } catch {
      setError('No se pudieron cargar las rutas');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function alternarNodo(id) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (seleccion.length === 0) {
      setError('Elige al menos un punto para la ruta');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await cliente.post('/rutas', {
        nombre: form.nombre,
        id_tecnico: Number(form.id_tecnico),
        fecha_programada: form.fecha_programada,
        nodos: seleccion,
      });
      setForm({ nombre: '', id_tecnico: '', fecha_programada: hoy() });
      setSeleccion([]);
      onCerrarForm();
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear la ruta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

      {mostrarForm && (
        <form
          onSubmit={guardar}
          style={{ padding: 14, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input
              required
              placeholder="Nombre de la ruta"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              style={campo}
            />
            <select
              required
              value={form.id_tecnico}
              onChange={(e) => setForm({ ...form, id_tecnico: e.target.value })}
              style={campo}
            >
              <option value="">Técnico…</option>
              {tecnicos.map((t) => (
                <option key={t.id_usuario} value={t.id_usuario}>
                  {t.nombre_completo}
                </option>
              ))}
            </select>
            <input
              required
              type="date"
              value={form.fecha_programada}
              onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })}
              style={campo}
            />
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
            Puntos de la ruta (se visitan en el orden en que los marques): {seleccion.length} elegidos
          </p>
          <div
            style={{
              maxHeight: 190,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {nodos.length === 0 && (
              <p style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Aún no hay infraestructura registrada.
              </p>
            )}
            {nodos.map((n) => {
              const posicion = seleccion.indexOf(n.id_nodo);
              return (
                <label
                  key={n.id_nodo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    fontSize: 13.5,
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: posicion >= 0 ? 'var(--celeste-bg)' : 'transparent',
                  }}
                >
                  <input type="checkbox" checked={posicion >= 0} onChange={() => alternarNodo(n.id_nodo)} />
                  <span style={{ fontWeight: 600 }}>{n.codigo}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {String(n.tipo).replace('_', ' ')} · {n.nombre_zona || 'Sin zona'}
                  </span>
                  {posicion >= 0 && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>#{posicion + 1}</span>}
                </label>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={enviando}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--navy)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            {enviando ? 'Guardando…' : 'Guardar ruta'}
          </button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Ruta</th>
            <th style={th}>Técnico</th>
            <th style={th}>Fecha</th>
            <th style={th}>Avance</th>
            <th style={th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rutas.map((r) => (
            <tr key={r.id_ruta}>
              <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
              <td style={td}>{r.tecnico}</td>
              <td style={td}>{String(r.fecha_programada).slice(0, 10)}</td>
              <td style={td}>
                {r.visitados}/{r.puntos} puntos
              </td>
              <td style={td}>
                <Badge>{r.estado}</Badge>
              </td>
            </tr>
          ))}
          {rutas.length === 0 && (
            <tr>
              <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={5}>
                Todavía no hay rutas. Crea una con el botón "Nueva ruta".
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
