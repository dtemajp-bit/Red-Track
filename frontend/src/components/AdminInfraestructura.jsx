import { useEffect, useMemo, useState } from 'react';
import cliente from '../api/cliente';
import { eliminarConConfirmacion } from '../lib/borrar';
import { avisar, confirmar } from '../lib/avisos';
import Badge from '../ui/Badge';
import Modal, { Etiqueta, estiloCampo, estiloBotonPrimario, estiloBotonSecundario, estiloBotonPeligro } from '../ui/Modal';

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '10px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };

const TIPOS = [
  { valor: 'poste', etiqueta: 'Poste' },
  { valor: 'nodo_central', etiqueta: 'Nodo central' },
  { valor: 'caja_distribucion', etiqueta: 'Caja de distribución' },
];
const ESTADOS = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'mantenimiento', etiqueta: 'En mantenimiento' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
];

// Pestaña "Infraestructura" de Administración: el administrador corrige o elimina
// los puntos registrados por los técnicos.
export default function AdminInfraestructura({ zonas }) {
  const [nodos, setNodos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null);
  const [seleccion, setSeleccion] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargar() {
    try {
      const res = await cliente.get('/nodos');
      setNodos(res.data);
      setError('');
    } catch {
      setError('No se pudo cargar la infraestructura');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return nodos;
    return nodos.filter((n) =>
      [n.codigo, n.nombre_zona, n.registrado_por, n.tipo].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [nodos, busqueda]);

  async function guardar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await cliente.put(`/nodos/${editando.id_nodo}`, {
        codigo: editando.codigo,
        tipo: editando.tipo,
        latitud: editando.latitud,
        longitud: editando.longitud,
        estado: editando.estado,
        observaciones: editando.observaciones,
        id_zona: editando.id_zona ? Number(editando.id_zona) : null,
      });
      setEditando(null);
      setMensaje('Punto actualizado correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo actualizar el punto');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(nodo) {
    setError('');
    setMensaje('');
    try {
      const hecho = await eliminarConConfirmacion(
        `/nodos/${nodo.id_nodo}`,
        `¿Eliminar el punto "${nodo.codigo}"? Esta acción no se puede deshacer.`,
        'Si continúas se borrarán también sus incidencias, cables y paradas de ruta. ¿Eliminar de todos modos?'
      );
      if (hecho) {
        setMensaje('Punto eliminado');
        avisar('Punto eliminado');
        await cargar();
      }
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar el punto');
    }
  }

  function alternar(id) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function eliminarSeleccionados() {
    const quiere = await confirmar({
      titulo: 'Eliminar puntos',
      mensaje: `Se eliminarán ${seleccion.length} punto(s) junto con sus incidencias, cables y paradas de ruta. Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!quiere) return;
    setError('');
    setMensaje('');
    let fallidos = 0;
    for (const id of seleccion) {
      try {
        await cliente.delete(`/nodos/${id}?forzar=true`);
      } catch {
        fallidos += 1;
      }
    }
    setSeleccion([]);
    setMensaje(`${seleccion.length - fallidos} punto(s) eliminado(s)`);
    if (fallidos) setError(`${fallidos} no se pudieron eliminar`);
    await cargar();
  }

  return (
    <div>
      <input
        placeholder="Buscar por código, zona o técnico…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ ...estiloCampo, maxWidth: 340, marginBottom: 14 }}
      />
      {seleccion.length > 0 && (
        <button onClick={eliminarSeleccionados} style={{ ...estiloBotonPeligro, marginBottom: 12, marginLeft: 10 }}>
          Eliminar seleccionados ({seleccion.length})
        </button>
      )}
      {error && !editando && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
      {mensaje && <p style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 10 }}>{mensaje}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={visibles.length > 0 && visibles.every((n) => seleccion.includes(n.id_nodo))}
                  onChange={(e) => setSeleccion(e.target.checked ? visibles.map((n) => n.id_nodo) : [])}
                />
              </th>
              <th style={th}>Código</th>
              <th style={th}>Tipo</th>
              <th style={th}>Estado</th>
              <th style={th}>Zona</th>
              <th style={th}>Registrado por</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((n) => (
              <tr key={n.id_nodo}>
                <td style={td}>
                  <input type="checkbox" checked={seleccion.includes(n.id_nodo)} onChange={() => alternar(n.id_nodo)} />
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{n.codigo}</td>
                <td style={td}>{String(n.tipo).replace('_', ' ')}</td>
                <td style={td}>
                  <Badge>{n.estado}</Badge>
                </td>
                <td style={td}>{n.nombre_zona || '—'}</td>
                <td style={td}>{n.registrado_por || '—'}</td>
                <td style={{ ...td, display: 'flex', gap: 6 }}>
                  <button
                    onClick={() =>
                      setEditando({
                        id_nodo: n.id_nodo,
                        codigo: n.codigo,
                        tipo: n.tipo,
                        latitud: n.latitud,
                        longitud: n.longitud,
                        estado: n.estado,
                        observaciones: n.observaciones || '',
                        id_zona: n.id_zona || '',
                      })
                    }
                    style={{ ...estiloBotonSecundario, padding: '5px 12px', fontSize: 12.5 }}
                  >
                    Editar
                  </button>
                  <button onClick={() => eliminar(n)} style={{ ...estiloBotonPeligro, padding: '5px 12px', fontSize: 12.5 }}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={7}>
                  No hay puntos de infraestructura{busqueda ? ' que coincidan con la búsqueda' : ' registrados todavía'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={`Editar ${editando.codigo}`} onCerrar={() => setEditando(null)}>
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Etiqueta>Código</Etiqueta>
                <input required value={editando.codigo} onChange={(e) => setEditando({ ...editando, codigo: e.target.value })} style={estiloCampo} />
              </div>
              <div>
                <Etiqueta>Tipo</Etiqueta>
                <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value })} style={estiloCampo}>
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Latitud</Etiqueta>
                <input required type="number" step="any" value={editando.latitud} onChange={(e) => setEditando({ ...editando, latitud: e.target.value })} style={estiloCampo} />
              </div>
              <div>
                <Etiqueta>Longitud</Etiqueta>
                <input required type="number" step="any" value={editando.longitud} onChange={(e) => setEditando({ ...editando, longitud: e.target.value })} style={estiloCampo} />
              </div>
              <div>
                <Etiqueta>Estado</Etiqueta>
                <select value={editando.estado} onChange={(e) => setEditando({ ...editando, estado: e.target.value })} style={estiloCampo}>
                  {ESTADOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Zona</Etiqueta>
                <select value={editando.id_zona} onChange={(e) => setEditando({ ...editando, id_zona: e.target.value })} style={estiloCampo}>
                  <option value="">Sin zona</option>
                  {zonas.map((z) => (
                    <option key={z.id_zona} value={z.id_zona}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Etiqueta>Observaciones</Etiqueta>
              <textarea
                rows={3}
                value={editando.observaciones}
                onChange={(e) => setEditando({ ...editando, observaciones: e.target.value })}
                style={{ ...estiloCampo, resize: 'vertical' }}
              />
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
