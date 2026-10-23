import { useEffect, useState } from 'react';
import cliente from '../api/cliente';
import Badge from '../ui/Badge';
import Modal, { Etiqueta, estiloCampo, estiloBotonPrimario, estiloBotonSecundario, estiloBotonPeligro } from '../ui/Modal';

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '10px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };

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

// Pestaña "Incidencias" de Administración: corregir o eliminar incidencias reportadas.
export default function AdminIncidencias() {
  const [incidencias, setIncidencias] = useState([]);
  const [nodos, setNodos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargar() {
    try {
      const [resInc, resNodos] = await Promise.all([cliente.get('/incidencias'), cliente.get('/nodos')]);
      setIncidencias(resInc.data);
      setNodos(resNodos.data);
      setError('');
    } catch {
      setError('No se pudieron cargar las incidencias');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await cliente.put(`/incidencias/${editando.id_incidencia}`, {
        descripcion: editando.descripcion,
        prioridad: editando.prioridad,
        estado: editando.estado,
        id_nodo: editando.id_nodo ? Number(editando.id_nodo) : null,
      });
      setEditando(null);
      setMensaje('Incidencia actualizada correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo actualizar la incidencia');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(inc) {
    const codigo = `INC-${String(inc.id_incidencia).padStart(4, '0')}`;
    if (!window.confirm(`¿Eliminar la incidencia ${codigo}? Esta acción no se puede deshacer.`)) return;
    setError('');
    setMensaje('');
    try {
      await cliente.delete(`/incidencias/${inc.id_incidencia}`);
      setMensaje('Incidencia eliminada');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar la incidencia');
    }
  }

  return (
    <div>
      {error && !editando && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
      {mensaje && <p style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 10 }}>{mensaje}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Descripción</th>
              <th style={th}>Prioridad</th>
              <th style={th}>Estado</th>
              <th style={th}>Reportada por</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {incidencias.map((inc) => (
              <tr key={inc.id_incidencia}>
                <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>INC-{String(inc.id_incidencia).padStart(4, '0')}</td>
                <td style={{ ...td, maxWidth: 320 }}>{inc.descripcion}</td>
                <td style={td}>
                  <Badge tono={inc.prioridad}>{inc.prioridad}</Badge>
                </td>
                <td style={td}>
                  <Badge>{inc.estado.replace('_', ' ')}</Badge>
                </td>
                <td style={td}>{inc.reportado_por}</td>
                <td style={{ ...td, display: 'flex', gap: 6 }}>
                  <button
                    onClick={() =>
                      setEditando({
                        id_incidencia: inc.id_incidencia,
                        descripcion: inc.descripcion,
                        prioridad: inc.prioridad,
                        estado: inc.estado,
                        id_nodo: inc.id_nodo || '',
                      })
                    }
                    style={{ ...estiloBotonSecundario, padding: '5px 12px', fontSize: 12.5 }}
                  >
                    Editar
                  </button>
                  <button onClick={() => eliminar(inc)} style={{ ...estiloBotonPeligro, padding: '5px 12px', fontSize: 12.5 }}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {incidencias.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={6}>
                  No hay incidencias registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal
          titulo={`Editar INC-${String(editando.id_incidencia).padStart(4, '0')}`}
          onCerrar={() => setEditando(null)}
        >
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Etiqueta>Descripción</Etiqueta>
              <textarea
                required
                rows={4}
                value={editando.descripcion}
                onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                style={{ ...estiloCampo, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Etiqueta>Prioridad</Etiqueta>
                <select value={editando.prioridad} onChange={(e) => setEditando({ ...editando, prioridad: e.target.value })} style={estiloCampo}>
                  {PRIORIDADES.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Estado</Etiqueta>
                <select value={editando.estado} onChange={(e) => setEditando({ ...editando, estado: e.target.value })} style={estiloCampo}>
                  {ESTADOS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Etiqueta>Punto de infraestructura asociado</Etiqueta>
              <select value={editando.id_nodo} onChange={(e) => setEditando({ ...editando, id_nodo: e.target.value })} style={estiloCampo}>
                <option value="">Ninguno</option>
                {nodos.map((n) => (
                  <option key={n.id_nodo} value={n.id_nodo}>
                    {n.codigo} · {String(n.tipo).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            {error && <p style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditando(null)} style={estiloBotonSecundario}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando} style={estiloBotonPrimario}>
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
