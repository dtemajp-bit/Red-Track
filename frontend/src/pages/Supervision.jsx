import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import EstadoActividad from '../ui/EstadoActividad';
import Modal, { Etiqueta, estiloBotonPrimario, estiloBotonSecundario, estiloCampo } from '../ui/Modal';
import { IconPlus, IconTrash } from '../ui/Icons';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { avisar, confirmar } from '../lib/avisos';
import { esAdmin, fechaLegible, hoyLocal, mensajeError, moverDia, ventana } from '../lib/actividades';

const botonDia = {
  border: '1px solid var(--border)', background: '#fff', borderRadius: 8, padding: '6px 11px',
  fontSize: 13.5, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
};

// Agrega una visita a la ruta de supervisión: se elige la orden (y, si es el administrador, el supervisor).
function ModalVisita({ fechaInicial, admin, supervisores, onListo, onCerrar }) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [ordenes, setOrdenes] = useState(undefined);
  const [idActividad, setIdActividad] = useState('');
  const [idSupervisor, setIdSupervisor] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setOrdenes(undefined);
    setIdActividad('');
    cliente.get('/actividades', { params: { fecha } })
      .then((r) => vigente && setOrdenes(r.data))
      .catch(() => vigente && setOrdenes([]));
    return () => { vigente = false; };
  }, [fecha]);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const cuerpo = { id_actividad: Number(idActividad), fecha, ...(admin ? { id_supervisor: Number(idSupervisor) } : {}) };
      const { data } = await cliente.post('/supervision', cuerpo);
      avisar(data.mensaje, data.existente ? 'info' : 'exito');
      onListo();
    } catch (err) { avisar(mensajeError(err, 'No se pudo agregar la visita'), 'error'); } finally { setEnviando(false); }
  }

  return (
    <Modal titulo="Agregar visita de supervisión" onCerrar={onCerrar} ancho={520}>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Etiqueta>Fecha de la orden</Etiqueta>
          <input type="date" required value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} style={estiloCampo} />
        </div>
        <div>
          <Etiqueta>Orden a supervisar *</Etiqueta>
          <select required value={idActividad} onChange={(e) => setIdActividad(e.target.value)} style={estiloCampo} aria-label="Orden a supervisar">
            <option value="">{ordenes === undefined ? 'Cargando…' : ordenes.length === 0 ? 'No hay órdenes en esta fecha' : 'Elige una orden…'}</option>
            {(ordenes || []).map((o) => <option key={o.id_actividad} value={o.id_actividad}>{o.orden_trabajo} · {o.tecnico}{o.cliente ? ` · ${o.cliente}` : ''}</option>)}
          </select>
        </div>
        {admin && (
          <div>
            <Etiqueta>Supervisor que hará la visita *</Etiqueta>
            <select required value={idSupervisor} onChange={(e) => setIdSupervisor(e.target.value)} style={estiloCampo} aria-label="Supervisor">
              <option value="">Elige un supervisor…</option>
              {supervisores.map((s) => <option key={s.id_usuario} value={s.id_usuario}>{s.nombre_completo}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando || !idActividad} style={estiloBotonPrimario}>Agregar a la ruta</button>
        </div>
      </form>
    </Modal>
  );
}

// Ruta de supervisión: las visitas del supervisor para ir a ver al técnico en campo y calificar la orden.
export default function Supervision() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const admin = esAdmin(usuario?.rol);
  const [fecha, setFecha] = useState(hoyLocal());
  const [filas, setFilas] = useState(undefined);
  const [supervisores, setSupervisores] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [agregando, setAgregando] = useState(false);

  useEffect(() => {
    if (admin) cliente.get('/supervision/supervisores').then((r) => setSupervisores(r.data)).catch(() => {});
  }, [admin]);

  const cargar = useCallback(async () => {
    try {
      const { data } = await cliente.get('/supervision', { params: { fecha, ...(filtro ? { id_supervisor: filtro } : {}) } });
      setFilas(data);
    } catch {
      setFilas([]);
      avisar('No se pudo cargar la ruta de supervisión', 'error');
    }
  }, [fecha, filtro]);
  useEffect(() => { setFilas(undefined); cargar(); }, [cargar]);

  async function quitar(v) {
    const si = await confirmar({ titulo: 'Quitar visita', mensaje: `¿Quitar la visita a la orden ${v.orden_trabajo} de la ruta?`, textoConfirmar: 'Quitar', peligro: true });
    if (!si) return;
    try {
      const { data } = await cliente.delete(`/supervision/${v.id_supervision}`);
      avisar(data.mensaje, 'exito');
      cargar();
    } catch (err) { avisar(mensajeError(err, 'No se pudo quitar la visita'), 'error'); }
  }

  const grupos = [['pendiente', 'Por visitar', '#f2b705'], ['completada', 'Calificadas', '#2f8fd8']];
  return (
    <AppLayout eyebrow="SUPERVISIÓN" title="Ruta de supervisión">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <Card
          title={admin ? 'Visitas de supervisión' : 'Mi ruta de supervisión'}
          subtitle="Órdenes que se visitan en campo para calificar al técnico con el check list"
          action={<button type="button" onClick={() => setAgregando(true)} style={{ ...estiloBotonPrimario, display: 'inline-flex', gap: 6, alignItems: 'center' }}><IconPlus size={15} /> Agregar visita</button>}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <button type="button" style={botonDia} onClick={() => setFecha(moverDia(fecha, -1))} aria-label="Día anterior">‹</button>
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} style={{ ...botonDia, fontWeight: 500 }} aria-label="Fecha" />
            <button type="button" style={botonDia} onClick={() => setFecha(moverDia(fecha, 1))} aria-label="Día siguiente">›</button>
            <button type="button" style={botonDia} onClick={() => setFecha(hoyLocal())}>Hoy</button>
            {admin && (
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...botonDia, fontWeight: 500 }} aria-label="Filtrar por supervisor">
                <option value="">Todos los supervisores</option>
                {supervisores.map((s) => <option key={s.id_usuario} value={s.id_usuario}>{s.nombre_completo}</option>)}
              </select>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'capitalize' }}>{fechaLegible(fecha)}</p>

          {filas === undefined && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</p>}
          {filas && filas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay visitas de supervisión para este día. Agrega una con "Agregar visita".</p>}

          {filas && grupos.map(([estado, titulo, color]) => {
            const grupo = filas.filter((f) => f.estado === estado);
            if (grupo.length === 0) return null;
            return (
              <div key={estado} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 13, height: 13, borderRadius: 3, background: color }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</h3>
                  <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>({grupo.length})</span>
                </div>
                {grupo.map((v) => (
                  <div key={v.id_supervision} style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: `4px solid ${color}`, borderBottom: '1px solid var(--border)', padding: '10px 12px' }}>
                    <div role="button" tabIndex={0} onClick={() => navigate(`/supervision/${v.id_supervision}`)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/supervision/${v.id_supervision}`)}
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>{v.orden_trabajo}{v.tipo ? ` · ${v.tipo}` : ''}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                        Técnico: {v.tecnico} · {ventana(v)}{v.cliente ? ` · ${v.cliente}` : ''}{v.direccion ? ` · ${v.direccion}` : ''}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <EstadoActividad estado={v.estado_actividad} />
                        {admin && <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Supervisor: {v.supervisor}</span>}
                      </div>
                    </div>
                    {v.estado === 'completada' && <strong style={{ fontSize: 18 }}>{v.puntaje}%</strong>}
                    <button type="button" className="rt-btn-icono" aria-label="Quitar visita" onClick={() => quitar(v)}><IconTrash size={15} /></button>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      </div>
      {agregando && <ModalVisita fechaInicial={fecha} admin={admin} supervisores={supervisores} onCerrar={() => setAgregando(false)} onListo={() => { setAgregando(false); cargar(); }} />}
    </AppLayout>
  );
}
