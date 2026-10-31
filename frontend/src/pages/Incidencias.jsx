import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import cliente from '../api/cliente';
import { IconAlert } from '../ui/Icons';
import { useAuth } from '../context/AuthContext';
import { agregarACola, esErrorDeRed } from '../lib/cola';

const PRIORIDADES = [
  { valor: 'baja', etiqueta: 'Baja' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'critica', etiqueta: 'Crítica' },
];

const ESTADOS = [
  { valor: 'abierta', etiqueta: 'Abierta' },
  { valor: 'en_atencion', etiqueta: 'En atención' },
  { valor: 'resuelta', etiqueta: 'Resuelta' },
  { valor: 'cerrada', etiqueta: 'Cerrada' },
];

const campo = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13.7,
};

export default function Incidencias() {
  const { usuario } = useAuth();
  const [aviso, setAviso] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [incidencias, setIncidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function cargarIncidencias() {
    setCargando(true);
    try {
      const respuesta = await cliente.get('/incidencias');
      setIncidencias(respuesta.data);
      setError('');
    } catch {
      setError('No se pudieron cargar las incidencias');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarIncidencias();
  }, []);

  async function registrar(evento) {
    evento.preventDefault();
    if (!descripcion.trim()) return;
    setEnviando(true);
    setAviso('');
    try {
      await cliente.post('/incidencias', { descripcion, prioridad });
      setDescripcion('');
      setPrioridad('media');
      await cargarIncidencias();
    } catch (err) {
      if (esErrorDeRed(err)) {
        agregarACola({ tipo: 'incidencia', id_usuario: usuario.id_usuario, datos: { descripcion, prioridad } });
        setDescripcion('');
        setPrioridad('media');
        setError('');
        setAviso('Sin conexión: la incidencia quedó guardada en este equipo. Envíala desde Sincronización.');
      } else {
        setError(err.response?.data?.mensaje || 'No se pudo registrar la incidencia');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(id, nuevoEstado) {
    try {
      await cliente.put(`/incidencias/${id}/estado`, { estado: nuevoEstado });
      setIncidencias((prev) =>
        prev.map((inc) => (inc.id_incidencia === id ? { ...inc, estado: nuevoEstado } : inc))
      );
    } catch {
      setError('No se pudo actualizar el estado');
    }
  }

  return (
    <AppLayout title="Incidencias">
      <div className="rt-colapsa" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card title="Reportar incidencia">
          <form onSubmit={registrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Prioridad</label>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} style={campo}>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe lo encontrado…"
                rows={4}
                required
                style={{ ...campo, resize: 'vertical' }}
              />
            </div>

            {error && <p style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</p>}
            {aviso && <p style={{ fontSize: 12.5, color: 'var(--orange)' }}>{aviso}</p>}

            <button
              type="submit"
              disabled={enviando}
              style={{
                alignSelf: 'flex-start',
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--navy)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13.7,
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? 'Registrando…' : '+ Registrar incidencia'}
            </button>
          </form>
        </Card>

        <Card title="Incidencias recientes" subtitle={cargando ? 'Cargando…' : `${incidencias.length} en total`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 480, overflowY: 'auto' }}>
            {!cargando && incidencias.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay incidencias registradas.</p>
            )}
            {incidencias.map((inc) => (
              <div
                key={inc.id_incidencia}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '11px 4px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconAlert size={16} color="var(--red)" />
                  <div>
                    <p style={{ fontSize: 13.7, fontWeight: 600 }}>{inc.descripcion}</p>
                    <p style={{ fontSize: 12.3, color: 'var(--text-muted)' }}>
                      INC-{String(inc.id_incidencia).padStart(4, '0')}
                      {inc.codigo_nodo ? ` · ${inc.codigo_nodo}` : ''} · {inc.reportado_por}
                    </p>
                  </div>
                </div>
                <select
                  value={inc.estado}
                  onChange={(e) => cambiarEstado(inc.id_incidencia, e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: 12.5 }}
                >
                  {ESTADOS.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.etiqueta}
                    </option>
                  ))}
                </select>
                <Badge>{inc.estado.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
