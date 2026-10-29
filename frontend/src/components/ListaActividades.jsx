import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { avisar } from '../lib/avisos';
import { ESTADOS, ORDEN_ESTADOS, esGestor, fechaLegible, hoyLocal, moverDia, ventana } from '../lib/actividades';

const botonDia = {
  border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '6px 11px',
  fontSize: 13.5, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
};

// "Mi ruta": lista de actividades del día agrupadas en Pendiente / En ruta / Cerrado.
export default function ListaActividades() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const gestor = esGestor(usuario?.rol);
  const [fecha, setFecha] = useState(hoyLocal());
  const [filas, setFilas] = useState(undefined); // undefined = cargando
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnico, setTecnico] = useState('');

  useEffect(() => {
    if (gestor) cliente.get('/actividades/tecnicos').then((r) => setTecnicos(r.data)).catch(() => {});
  }, [gestor]);

  useEffect(() => {
    let vigente = true;
    setFilas(undefined);
    cliente
      .get('/actividades', { params: { fecha, ...(tecnico ? { id_tecnico: tecnico } : {}) } })
      .then((res) => vigente && setFilas(res.data))
      .catch(() => {
        if (!vigente) return;
        setFilas([]);
        avisar('No se pudo cargar la lista de actividades', 'error');
      });
    return () => { vigente = false; };
  }, [fecha, tecnico]);

  const abrir = (id) => navigate(`/actividad/${id}`);

  return (
    <Card
      title={gestor ? 'Actividades del día' : 'Mi ruta'}
      subtitle="Lista de actividades"
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" style={botonDia} onClick={() => setFecha(moverDia(fecha, -1))} aria-label="Día anterior">‹</button>
          <input
            type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)}
            style={{ ...botonDia, fontWeight: 500 }} aria-label="Fecha"
          />
          <button type="button" style={botonDia} onClick={() => setFecha(moverDia(fecha, 1))} aria-label="Día siguiente">›</button>
          <button type="button" style={botonDia} onClick={() => setFecha(hoyLocal())}>Hoy</button>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{fechaLegible(fecha)}</p>
        {gestor && (
          <select value={tecnico} onChange={(e) => setTecnico(e.target.value)} style={{ ...botonDia, fontWeight: 500 }} aria-label="Técnico">
            <option value="">Todos los técnicos</option>
            {tecnicos.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
          </select>
        )}
      </div>

      {filas === undefined && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</p>}
      {filas && filas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay actividades programadas para este día.</p>
      )}

      {filas && filas.length > 0 && ORDEN_ESTADOS.map((estado) => {
        const grupo = filas.filter((f) => f.estado === estado);
        if (grupo.length === 0) return null;
        const meta = ESTADOS[estado];
        return (
          <div key={estado} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: meta.cuadro }} />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{meta.etiqueta}</h3>
              <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>({grupo.length})</span>
            </div>
            {grupo.map((a) => (
              <div
                key={a.id_actividad} role="button" tabIndex={0}
                onClick={() => abrir(a.id_actividad)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && abrir(a.id_actividad)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer',
                  borderLeft: `4px solid ${meta.barra}`, borderBottom: '1px solid var(--border)', padding: '10px 12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {a.orden_trabajo}{a.tipo ? ` · ${a.tipo}` : ''}
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                    {ventana(a)}{a.cliente ? ` · ${a.cliente}` : ''}{a.direccion ? ` · ${a.direccion}` : ''}
                  </p>
                  {gestor && <p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Técnico: {a.tecnico}</p>}
                </div>
                <span style={{ fontSize: 20, color: 'var(--text-soft)' }}>›</span>
              </div>
            ))}
          </div>
        );
      })}
    </Card>
  );
}
