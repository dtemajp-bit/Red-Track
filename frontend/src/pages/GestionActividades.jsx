import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import EstadoActividad from '../ui/EstadoActividad';
import Modal, { Etiqueta, estiloBotonPrimario, estiloBotonSecundario, estiloCampo } from '../ui/Modal';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import cliente from '../api/cliente';
import { avisar, confirmar } from '../lib/avisos';
import { ESTADOS, hoyLocal, mensajeError, ventana } from '../lib/actividades';

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '10px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)', verticalAlign: 'middle' };
const Tabla = ({ children }) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></div>;
const Acciones = ({ onEditar, onEliminar, onVer }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
    {onVer && <button type="button" onClick={onVer} style={{ ...estiloBotonSecundario, padding: '5px 10px', fontSize: 12.5 }}>Ver</button>}
    <button type="button" className="rt-btn-icono" aria-label="Editar" onClick={onEditar}><IconEdit size={15} /></button>
    <button type="button" className="rt-btn-icono" aria-label="Eliminar" onClick={onEliminar}><IconTrash size={15} /></button>
  </div>
);

// ------------------------------------------------------------------ Actividades
const FORM_VACIO = { orden_trabajo: '', tipo: '', caja_terminal: '', id_tecnico: '', fecha_programada: hoyLocal(), ventana_inicio: '', ventana_fin: '', cliente: '', telefono: '', direccion: '', descripcion: '' };

function FormActividad({ inicial, tecnicos, onGuardado, onCerrar }) {
  const [f, setF] = useState(inicial ? { ...FORM_VACIO, ...Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, v ?? ''])), id_tecnico: String(inicial.id_tecnico) } : FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const campo = (k, etiqueta, extra = {}) => (
    <div style={{ flex: '1 1 200px' }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <input value={f[k]} onChange={cambiar(k)} style={estiloCampo} {...extra} />
    </div>
  );
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const cuerpo = { ...f, id_tecnico: Number(f.id_tecnico) };
      const r = inicial ? await cliente.put(`/actividades/${inicial.id_actividad}`, cuerpo) : await cliente.post('/actividades', cuerpo);
      avisar(r.data.mensaje, 'exito');
      onGuardado();
    } catch (err) {
      avisar(mensajeError(err, 'No se pudo guardar la actividad'), 'error');
    } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={inicial ? 'Editar actividad' : 'Nueva actividad'} onCerrar={onCerrar} ancho={640}>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {campo('orden_trabajo', 'Orden de trabajo *', { required: true, maxLength: 60, autoFocus: true })}
          {campo('tipo', 'Tipo (ej. Instalación)', { maxLength: 60 })}
          {campo('caja_terminal', 'Caja terminal', { maxLength: 60 })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Etiqueta>Técnico responsable *</Etiqueta>
            <select required value={f.id_tecnico} onChange={cambiar('id_tecnico')} style={estiloCampo}>
              <option value="">Elige un técnico…</option>
              {tecnicos.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
            </select>
          </div>
          {campo('fecha_programada', 'Fecha *', { type: 'date', required: true })}
          {campo('ventana_inicio', 'Ventana desde', { type: 'time' })}
          {campo('ventana_fin', 'Ventana hasta', { type: 'time' })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {campo('cliente', 'Cliente', { maxLength: 150 })}
          {campo('telefono', 'Teléfono', { maxLength: 30 })}
          {campo('direccion', 'Dirección', { maxLength: 255 })}
        </div>
        <div>
          <Etiqueta>Lo que debe hacer el técnico</Etiqueta>
          <textarea rows={4} value={f.descripcion} onChange={cambiar('descripcion')} style={{ ...estiloCampo, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={estiloBotonPrimario}>{inicial ? 'Guardar cambios' : 'Crear actividad'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TabActividades({ tecnicos }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState({ fecha: '', id_tecnico: '', estado: '' });
  const [filas, setFilas] = useState(undefined);
  const [form, setForm] = useState(null); // null cerrado, {} nueva, actividad = editar

  const cargar = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filtro).filter(([, v]) => v));
      const { data } = await cliente.get('/actividades', { params });
      setFilas(data);
    } catch {
      setFilas([]);
      avisar('No se pudieron cargar las actividades', 'error');
    }
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(a) {
    const si = await confirmar({ titulo: 'Eliminar actividad', mensaje: `¿Eliminar la actividad ${a.orden_trabajo}? El material instalado volverá a las existencias del técnico.`, textoConfirmar: 'Eliminar', peligro: true });
    if (!si) return;
    try {
      const { data } = await cliente.delete(`/actividades/${a.id_actividad}`);
      avisar(data.mensaje, 'exito');
      cargar();
    } catch (err) { avisar(mensajeError(err, 'No se pudo eliminar'), 'error'); }
  }

  return (
    <Card
      title="Actividades" subtitle="Órdenes de trabajo asignadas a los técnicos"
      action={<button type="button" onClick={() => setForm({})} style={{ ...estiloBotonPrimario, display: 'inline-flex', gap: 6, alignItems: 'center' }}><IconPlus size={15} /> Nueva actividad</button>}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="date" value={filtro.fecha} onChange={(e) => setFiltro({ ...filtro, fecha: e.target.value })} style={{ ...estiloCampo, width: 170 }} aria-label="Fecha" />
        <select value={filtro.id_tecnico} onChange={(e) => setFiltro({ ...filtro, id_tecnico: e.target.value })} style={{ ...estiloCampo, width: 200 }} aria-label="Técnico">
          <option value="">Todos los técnicos</option>
          {tecnicos.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
        </select>
        <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} style={{ ...estiloCampo, width: 160 }} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.etiqueta}</option>)}
        </select>
        {filtro.fecha && <button type="button" onClick={() => setFiltro({ ...filtro, fecha: '' })} style={estiloBotonSecundario}>Quitar fecha</button>}
      </div>
      {filas === undefined ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</p> : filas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay actividades con estos filtros.</p>
      ) : (
        <Tabla>
          <thead><tr><th style={th}>Orden</th><th style={th}>Fecha</th><th style={th}>Ventana</th><th style={th}>Técnico</th><th style={th}>Cliente</th><th style={th}>Estado</th><th style={th} /></tr></thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.id_actividad}>
                <td style={{ ...td, fontWeight: 600 }}>{a.orden_trabajo}</td>
                <td style={td}>{a.fecha_programada}</td>
                <td style={td}>{ventana(a)}</td>
                <td style={td}>{a.tecnico}</td>
                <td style={td}>{a.cliente || '—'}</td>
                <td style={td}><EstadoActividad estado={a.estado} /></td>
                <td style={td}><Acciones onVer={() => navigate(`/actividad/${a.id_actividad}`)} onEditar={() => setForm(a)} onEliminar={() => eliminar(a)} /></td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      {form && <FormActividad inicial={form.id_actividad ? form : null} tecnicos={tecnicos} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar(); }} />}
    </Card>
  );
}

// ------------------------------------------------------------------ Catálogos
function FormCatalogo({ titulo, inicial, ruta, conSerie, onGuardado, onCerrar }) {
  const [f, setF] = useState({ codigo: inicial?.codigo || '', descripcion: inicial?.descripcion || '', unidad: inicial?.unidad || 'UND', activo: inicial ? !!inicial.activo : true, con_serie: !!inicial?.con_serie });
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = inicial ? await cliente.put(`${ruta}/${inicial.id}`, f) : await cliente.post(ruta, f);
      avisar(r.data.mensaje, 'exito');
      onGuardado();
    } catch (err) { avisar(mensajeError(err, 'No se pudo guardar'), 'error'); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={inicial ? `Editar ${titulo}` : `Nuevo ${titulo}`} onCerrar={onCerrar} ancho={480}>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><Etiqueta>Código *</Etiqueta><input required maxLength={60} autoFocus value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} style={estiloCampo} /></div>
        <div><Etiqueta>Descripción *</Etiqueta><input required maxLength={255} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} style={estiloCampo} /></div>
        <div><Etiqueta>Unidad (UND, M, etc.)</Etiqueta><input maxLength={20} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} style={estiloCampo} /></div>
        {conSerie && (
          <label style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.con_serie} onChange={(e) => setF({ ...f, con_serie: e.target.checked })} /> Cada unidad tiene número de serie (ONT, aparatos)
          </label>
        )}
        {inicial && (
          <label style={{ fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo (visible para los técnicos)
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={estiloBotonPrimario}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

function TabCatalogo({ titulo, plural, ruta, id, extra, conSerie }) {
  const [filas, setFilas] = useState(undefined);
  const [form, setForm] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const { data } = await cliente.get(ruta, { params: { todos: 1 } });
      setFilas(data);
    } catch { setFilas([]); avisar('No se pudo cargar el catálogo', 'error'); }
  }, [ruta]);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(fila) {
    const si = await confirmar({ titulo: 'Eliminar', mensaje: `¿Eliminar "${fila.descripcion}" del catálogo?`, textoConfirmar: 'Eliminar', peligro: true });
    if (!si) return;
    try {
      const { data } = await cliente.delete(`${ruta}/${fila[id]}`);
      avisar(data.mensaje, data.desactivado ? 'info' : 'exito');
      cargar();
    } catch (err) { avisar(mensajeError(err, 'No se pudo eliminar'), 'error'); }
  }

  return (
    <>
      <Card
        title={`Catálogo de ${plural}`} subtitle="Los técnicos eligen de esta lista"
        action={<button type="button" onClick={() => setForm({})} style={{ ...estiloBotonPrimario, display: 'inline-flex', gap: 6, alignItems: 'center' }}><IconPlus size={15} /> Nuevo</button>}
      >
        {filas === undefined ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</p> : filas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay registros. Agrega el primero con "Nuevo".</p>
        ) : (
          <Tabla>
            <thead><tr><th style={th}>Código</th><th style={th}>Descripción</th><th style={th}>Unidad</th>{conSerie && <th style={th}>Control</th>}<th style={th}>Estado</th><th style={th} /></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f[id]}>
                  <td style={{ ...td, fontWeight: 600 }}>{f.codigo}</td>
                  <td style={td}>{f.descripcion}</td>
                  <td style={td}>{f.unidad}</td>
                  {conSerie && <td style={td}>{f.con_serie ? 'Por serie' : 'Por cantidad'}</td>}
                  <td style={td}>{f.activo ? 'Activo' : 'Inactivo'}</td>
                  <td style={td}><Acciones onEditar={() => setForm({ ...f, id: f[id] })} onEliminar={() => eliminar(f)} /></td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
        {form && <FormCatalogo titulo={titulo} inicial={form.id ? form : null} ruta={ruta} conSerie={conSerie} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar(); }} />}
      </Card>
      {extra && extra(filas)}
    </>
  );
}

// Series (unidades con número de serie) de un material que tiene el técnico.
function PanelSeries({ fila, idTecnico, onCambio }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function agregar() {
    setEnviando(true);
    try {
      const { data } = await cliente.post(`/actividades/inventario/${idTecnico}/series`, { id_material: fila.id_material, series: texto });
      avisar(data.mensaje, 'exito');
      setTexto('');
      onCambio();
    } catch (err) { avisar(mensajeError(err, 'No se pudieron agregar las series'), 'error'); } finally { setEnviando(false); }
  }
  async function quitar(s) {
    const si = await confirmar({ titulo: 'Eliminar serie', mensaje: `¿Eliminar la serie ${s.serie}?`, textoConfirmar: 'Eliminar', peligro: true });
    if (!si) return;
    try {
      const { data } = await cliente.delete(`/actividades/inventario/series/${s.id_serie}`);
      avisar(data.mensaje, 'exito');
      onCambio();
    } catch (err) { avisar(mensajeError(err, 'No se pudo eliminar la serie'), 'error'); }
  }
  return (
    <div style={{ padding: '8px 4px 14px' }}>
      <Etiqueta>Agregar series (una por línea)</Etiqueta>
      <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'48575443CCDF08B9\n48575443CCE43DB9'} style={{ ...estiloCampo, resize: 'vertical', fontFamily: 'monospace' }} />
      <button type="button" onClick={agregar} disabled={enviando || !texto.trim()} style={{ ...estiloBotonPrimario, marginTop: 8 }}>Agregar series</button>
      {fila.series.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {fila.series.map((s) => (
            <div key={s.id_serie} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.serie}</span>
              {s.id_actividad
                ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Instalada en {s.orden_trabajo}</span>
                : <button type="button" className="rt-btn-icono" aria-label="Eliminar serie" onClick={() => quitar(s)}><IconTrash size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Existencias de material que tiene cada técnico (lo que verá en "Recurso").
function Existencias({ tecnicos, version }) {
  const [idTecnico, setIdTecnico] = useState('');
  const [filas, setFilas] = useState([]);
  const [valores, setValores] = useState({});

  const cargar = useCallback(async () => {
    if (!idTecnico) { setFilas([]); return; }
    try {
      const { data } = await cliente.get(`/actividades/inventario/${idTecnico}`);
      setFilas(data);
      setValores(Object.fromEntries(data.map((f) => [f.id_material, String(f.cantidad)])));
    } catch { avisar('No se pudieron cargar las existencias', 'error'); }
  }, [idTecnico]);
  useEffect(() => { cargar(); }, [cargar, version]);

  async function guardar(f) {
    try {
      const { data } = await cliente.put(`/actividades/inventario/${idTecnico}`, { id_material: f.id_material, cantidad: Number(valores[f.id_material]) });
      avisar(data.mensaje, 'exito');
      cargar();
    } catch (err) { avisar(mensajeError(err, 'No se pudo guardar'), 'error'); }
  }

  return (
    <Card title="Existencias por técnico" subtitle="Cantidad de cada material que tiene el técnico (se descuenta al instalar)">
      <div style={{ maxWidth: 320, marginBottom: 12 }}>
        <select value={idTecnico} onChange={(e) => setIdTecnico(e.target.value)} style={estiloCampo} aria-label="Técnico">
          <option value="">Elige un técnico…</option>
          {tecnicos.map((t) => <option key={t.id_usuario} value={t.id_usuario}>{t.nombre_completo}</option>)}
        </select>
      </div>
      {idTecnico && filas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Primero agrega materiales al catálogo.</p>}
      {filas.length > 0 && (
        <Tabla>
          <thead><tr><th style={th}>Material</th><th style={th}>Existencias</th><th style={th} /></tr></thead>
          <tbody>
            {filas.map((f) => f.con_serie ? (
              <tr key={f.id_material}>
                <td style={td} colSpan={3}>
                  <details>
                    <summary style={{ cursor: 'pointer' }}>
                      <strong>{f.descripcion}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> · {f.codigo} · {f.cantidad} disponible(s) de {f.series.length} serie(s)</span>
                    </summary>
                    <PanelSeries fila={f} idTecnico={idTecnico} onCambio={cargar} />
                  </details>
                </td>
              </tr>
            ) : (
              <tr key={f.id_material}>
                <td style={td}><strong>{f.descripcion}</strong><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.codigo} · {f.unidad}</span></td>
                <td style={td}>
                  <input type="number" min="0" step="0.01" value={valores[f.id_material] ?? ''} onChange={(e) => setValores({ ...valores, [f.id_material]: e.target.value })} style={{ ...estiloCampo, width: 110 }} aria-label={`Existencias de ${f.descripcion}`} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button type="button" onClick={() => guardar(f)} disabled={String(f.cantidad) === valores[f.id_material]} style={{ ...estiloBotonPrimario, padding: '6px 12px' }}>Guardar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ Página
export default function GestionActividades() {
  const [pestana, setPestana] = useState('actividades');
  const [tecnicos, setTecnicos] = useState([]);

  useEffect(() => {
    cliente.get('/actividades/tecnicos').then((r) => setTecnicos(r.data)).catch(() => avisar('No se pudo cargar la lista de técnicos', 'error'));
  }, []);

  const pestanas = [['actividades', 'Actividades'], ['materiales', 'Materiales e inventario'], ['mano_obra', 'Mano de obra']];
  return (
    <AppLayout title="Gestionar actividades">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pestanas.map(([k, t]) => (
            <button key={k} type="button" onClick={() => setPestana(k)}
              style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${pestana === k ? 'var(--navy)' : 'var(--border)'}`, background: pestana === k ? 'var(--navy)' : '#fff', color: pestana === k ? '#fff' : 'var(--text)' }}>
              {t}
            </button>
          ))}
        </div>
        {pestana === 'actividades' && <TabActividades tecnicos={tecnicos} />}
        {pestana === 'materiales' && (
          <TabCatalogo titulo="material" plural="materiales" ruta="/actividades/catalogos/materiales" id="id_material" conSerie
            extra={(filas) => <Existencias tecnicos={tecnicos} version={filas ? filas.length : 0} />} />
        )}
        {pestana === 'mano_obra' && <TabCatalogo titulo="mano de obra" plural="mano de obra" ruta="/actividades/catalogos/mano-obra" id="id_mano_obra" />}
      </div>
    </AppLayout>
  );
}
