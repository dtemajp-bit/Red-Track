import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import EstadoActividad from '../ui/EstadoActividad';
import Modal, { Etiqueta, estiloBotonPrimario, estiloBotonSecundario, estiloCampo } from '../ui/Modal';
import { IconEdit, IconTrash } from '../ui/Icons';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { avisar, confirmar } from '../lib/avisos';
import { ESTADOS, duracion, esAdmin, esEntero, esGestor, fechaLegible, horaLegible, mensajeError, ventana } from '../lib/actividades';

const bloquearDecimales = (e) => ['.', ',', 'e', 'E', '-', '+'].includes(e.key) && e.preventDefault();

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 2 }}>{etiqueta}</p>
      <p style={{ fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere' }}>{valor || '—'}</p>
    </div>
  );
}

// Datos de la orden (se usan en Detalles y en el reporte del administrador).
function DatosOrden({ act, tecnico }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
      <Dato etiqueta="Orden de trabajo" valor={act.orden_trabajo} />
      {tecnico && <Dato etiqueta="Técnico" valor={act.tecnico} />}
      <Dato etiqueta="Tipo" valor={act.tipo} />
      <Dato etiqueta="Caja terminal" valor={act.caja_terminal} />
      <Dato etiqueta="Fecha programada" valor={fechaLegible(act.fecha_programada)} />
      <Dato etiqueta="Ventana de entrega" valor={ventana(act)} />
      <Dato etiqueta="Cliente" valor={act.cliente} />
      <Dato etiqueta="Teléfono" valor={act.telefono} />
      <Dato etiqueta="Dirección" valor={act.direccion} />
      <Dato etiqueta="En ruta desde" valor={horaLegible(act.en_ruta_en)} />
      <Dato etiqueta="Inicio de la actividad" valor={horaLegible(act.iniciado_en)} />
      <Dato etiqueta="Completada" valor={horaLegible(act.cerrado_en)} />
      <Dato etiqueta="Duración del trabajo" valor={duracion(act.iniciado_en, act.cerrado_en)} />
    </div>
  );
}

// Pide una cantidad ENTERA (usar material, cambiar cantidad).
function ModalCantidad({ titulo, ayuda, inicial = '1', max, onGuardar, onCerrar }) {
  const [valor, setValor] = useState(String(inicial));
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    if (!esEntero(valor) || Number(valor) < 1) return avisar('La cantidad debe ser un número entero mayor a 0', 'error');
    setEnviando(true);
    try { await onGuardar(Number(valor)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho={380}>
      <form onSubmit={enviar}>
        {ayuda && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{ayuda}</p>}
        <Etiqueta>Cantidad (número entero)</Etiqueta>
        <input type="number" inputMode="numeric" min="1" step="1" max={max} required autoFocus value={valor}
          onKeyDown={bloquearDecimales} onChange={(e) => setValor(e.target.value)} style={estiloCampo} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={estiloBotonPrimario}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCompletar({ onGuardar, onCerrar }) {
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try { await onGuardar(notas); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo="Completar orden" onCerrar={onCerrar} ancho={420}>
      <form onSubmit={enviar}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Antes de completar, revisa que la mano de obra y el inventario estén completos.
        </p>
        <Etiqueta>Notas de cierre (opcional)</Etiqueta>
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} style={{ ...estiloCampo, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={{ ...estiloBotonPrimario, background: ESTADOS.completada.cuadro }}>Completar orden</button>
        </div>
      </form>
    </Modal>
  );
}

const fila = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--border)' };
const subtitulo = { fontSize: 14, fontWeight: 700, margin: '18px 0 4px' };

export default function ActividadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const gestor = esGestor(usuario?.rol);
  const admin = esAdmin(usuario?.rol);
  const [act, setAct] = useState(undefined); // undefined = cargando, null = no disponible
  const [errorCarga, setErrorCarga] = useState('');
  const [pestana, setPestana] = useState('detalles');
  const [modal, setModal] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [nuevoMO, setNuevoMO] = useState({ id_mano_obra: '', cantidad: '1' });
  const [escaneo, setEscaneo] = useState('');
  const [visitas, setVisitas] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const { data } = await cliente.get(`/actividades/${id}`);
      setAct(data);
    } catch (err) {
      setErrorCarga(mensajeError(err, 'No se pudo cargar la actividad'));
      setAct(null);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (gestor) cliente.get(`/supervision/actividad/${id}`).then((r) => setVisitas(r.data)).catch(() => setVisitas([]));
  }, [gestor, id]);

  async function ejecutar(promesa, exito) {
    try {
      const { data } = await promesa;
      avisar(exito || data.mensaje, 'exito');
      await cargar();
      return true;
    } catch (err) {
      avisar(mensajeError(err, 'No se pudo completar la acción'), 'error');
      return false;
    }
  }

  async function avanzar(paso, exito) {
    setTrabajando(true);
    await ejecutar(cliente.put(`/actividades/${id}/${paso}`), exito);
    setTrabajando(false);
  }
  async function completar(notas) {
    if (await ejecutar(cliente.put(`/actividades/${id}/completar`, { notas_cierre: notas }))) setModal(null);
  }
  async function reabrir() {
    const si = await confirmar({ titulo: 'Reabrir orden', mensaje: 'La actividad volverá a estar iniciada para que el técnico la corrija. ¿Continuar?', textoConfirmar: 'Reabrir' });
    if (si) await ejecutar(cliente.put(`/actividades/${id}/reabrir`));
  }
  async function supervisar() {
    try {
      const { data } = await cliente.post('/supervision', { id_actividad: Number(id) });
      navigate(`/supervision/${data.id_supervision}`);
    } catch (err) { avisar(mensajeError(err, 'No se pudo agregar la visita de supervisión'), 'error'); }
  }
  async function agregarMO(e) {
    e.preventDefault();
    if (!esEntero(nuevoMO.cantidad) || Number(nuevoMO.cantidad) < 1) return avisar('La cantidad debe ser un número entero mayor a 0', 'error');
    const ok = await ejecutar(cliente.post(`/actividades/${id}/mano-obra`, { id_mano_obra: Number(nuevoMO.id_mano_obra), cantidad: Number(nuevoMO.cantidad) }));
    if (ok) setNuevoMO({ id_mano_obra: '', cantidad: '1' });
  }
  const usarSerie = (idSerie) => ejecutar(cliente.post(`/actividades/${id}/series`, { ids: [idSerie] }));
  async function quitar(ruta, texto) {
    const si = await confirmar({ titulo: 'Quitar', mensaje: texto, textoConfirmar: 'Quitar', peligro: true });
    if (si) await ejecutar(cliente.delete(ruta));
  }
  async function guardarCantidad(cantidad) {
    const m = modal;
    const ok = m.tipo === 'usar'
      ? await ejecutar(cliente.post(`/actividades/${id}/materiales`, { id_material: m.fila.id_material, cantidad }))
      : await ejecutar(cliente.put(`/actividades/${id}/${m.tipo === 'editar-mat' ? 'materiales' : 'mano-obra'}/${m.fila.id_linea}`, { cantidad }));
    if (ok) setModal(null);
  }
  // Escáner de mano: escribe la serie y presiona Enter solo; se registra como usada si está en el inventario.
  async function escanear(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const codigo = escaneo.trim().toUpperCase();
    if (!codigo) return;
    const serie = act.recurso.flatMap((r) => r.series || []).find((s) => s.serie.toUpperCase() === codigo);
    setEscaneo('');
    if (!serie) return avisar(`La serie ${codigo} no está en el inventario de este técnico`, 'error');
    await usarSerie(serie.id_serie);
  }

  if (act === undefined || act === null) {
    return (
      <AppLayout title="Detalle de actividad">
        <Card>
          <p style={{ fontSize: 13.5, color: act === null ? 'var(--red)' : 'var(--text-muted)' }}>{act === null ? errorCarga : 'Cargando…'}</p>
          <button type="button" onClick={() => navigate('/panel')} style={{ ...estiloBotonSecundario, marginTop: 12 }}>Volver al panel</button>
        </Card>
      </AppLayout>
    );
  }

  const meta = ESTADOS[act.estado];
  // El administrador (y el supervisor en órdenes ajenas) ven el reporte; el técnico trabaja la orden.
  const lectura = admin || !act.puede_operar;
  const puedeEditar = act.puede_editar_lineas && !lectura;
  const pasos = { pendiente: 0, en_ruta: 1, iniciada: 2, completada: 3 }[act.estado];
  const totalInstalado = act.materiales.length + act.series_instaladas.length;
  const motivo = lectura
    ? 'Vista de reporte: solo el técnico responsable registra mano de obra e inventario.'
    : act.estado === 'completada'
      ? 'La orden está completada; solo el administrador puede reabrirla.'
      : 'Inicia la actividad en el domicilio del cliente para registrar mano de obra e inventario.';
  const pestanas = lectura
    ? [['detalles', 'Detalles'], ['mano', 'Reporte'], ['inventario', `Inventario (${totalInstalado})`]]
    : [['detalles', 'Detalles'], ['mano', `Mano de obra (${act.mano_obra.length})`], ['inventario', `Inventario (${totalInstalado})`]];

  const accionLinea = (tipo, f, texto, ruta) => puedeEditar && (
    <div style={{ display: 'flex', gap: 6 }}>
      <button type="button" className="rt-btn-icono" aria-label="Cambiar cantidad" onClick={() => setModal({ tipo, fila: f })}><IconEdit size={15} /></button>
      <button type="button" className="rt-btn-icono" aria-label="Quitar" onClick={() => quitar(ruta, texto)}><IconTrash size={15} /></button>
    </div>
  );

  const lineasMaterial = (
    <>
      {act.materiales.map((l) => (
        <div key={`m${l.id_linea}`} style={fila}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.descripcion}</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{l.codigo} · {l.cantidad} {l.unidad}</p>
          </div>
          {accionLinea('editar-mat', l, `¿Quitar "${l.descripcion}"? Se devolverá a las existencias del técnico.`, `/actividades/${id}/materiales/${l.id_linea}`)}
        </div>
      ))}
      {act.series_instaladas.map((l) => (
        <div key={`s${l.id_serie}`} style={fila}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13.7, overflowWrap: 'anywhere' }}>{l.descripcion}</p>
            <p style={{ fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{l.serie}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 18 }}>1</strong>
            {puedeEditar && (
              <button type="button" className="rt-btn-icono" aria-label="Quitar" onClick={() => quitar(`/actividades/${id}/series/${l.id_serie}`, `¿Quitar la serie ${l.serie}? Volverá a las existencias del técnico.`)}><IconTrash size={15} /></button>
            )}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <AppLayout title="Detalle de actividad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <button type="button" onClick={() => navigate(-1)} style={{ ...estiloBotonSecundario, alignSelf: 'flex-start' }}>‹ Volver</button>

        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: `5px solid ${meta.barra}`, borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Orden de trabajo</p>
              <h2 style={{ fontSize: 20, overflowWrap: 'anywhere' }}>{act.orden_trabajo}</h2>
              {gestor && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Técnico: {act.tecnico}</p>}
            </div>
            <EstadoActividad estado={act.estado} />
          </div>

          <div style={{ background: 'var(--navy)', color: '#e6ecf5', borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
            <p style={{ fontSize: 12.5, marginBottom: 8 }}>Flujo de trabajo de esta actividad · Pasos {pasos}/3</p>
            {[
              ['En ruta: avisa que te diriges al domicilio del cliente.', 1],
              ['Iniciar actividad: ya estás en el domicilio; comienza el trabajo y registra mano de obra e inventario.', 2],
              ['Completar orden: al terminar, con todo registrado.', 3],
            ].map(([t, n]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '3px 0' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '2px solid #9fb0c8', background: pasos >= n ? '#17a35a' : 'transparent', borderColor: pasos >= n ? '#17a35a' : '#9fb0c8' }} />
                <span style={{ opacity: pasos >= n ? 0.7 : 1 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!lectura && act.estado === 'pendiente' && (
              <button type="button" disabled={trabajando} onClick={() => avanzar('en-ruta', 'Estás en ruta hacia el cliente')} style={{ ...estiloBotonPrimario, width: '100%', padding: '13px 16px', fontSize: 15, background: ESTADOS.en_ruta.cuadro }}>En ruta</button>
            )}
            {!lectura && act.estado === 'en_ruta' && (
              <button type="button" disabled={trabajando} onClick={() => avanzar('iniciar', 'Actividad iniciada en el domicilio del cliente')} style={{ ...estiloBotonPrimario, width: '100%', padding: '13px 16px', fontSize: 15, background: ESTADOS.iniciada.cuadro }}>Iniciar actividad</button>
            )}
            {!lectura && act.estado === 'iniciada' && (
              <button type="button" onClick={() => setModal({ tipo: 'completar' })} style={{ ...estiloBotonPrimario, width: '100%', padding: '13px 16px', fontSize: 15, background: ESTADOS.completada.cuadro }}>Completar orden</button>
            )}
            {!lectura && act.estado === 'completada' && (
              <p style={{ fontSize: 13.5, color: ESTADOS.completada.texto, fontWeight: 600, textAlign: 'center' }}>Orden completada</p>
            )}
            {admin && act.estado === 'completada' && (
              <button type="button" onClick={reabrir} style={{ ...estiloBotonSecundario, width: '100%', padding: '12px 16px' }}>Reabrir orden</button>
            )}
            {lectura && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                {admin ? 'Vista de reporte: el técnico responsable avanza la orden y registra su trabajo.' : 'Modo supervisión: puedes ver esta actividad, pero solo el técnico responsable la modifica.'}
              </p>
            )}
            {gestor && !admin && lectura && (
              <button type="button" onClick={supervisar} style={{ ...estiloBotonPrimario, width: '100%', padding: '12px 16px' }}>Supervisar esta orden</button>
            )}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pestanas.map(([clave, texto]) => (
            <button key={clave} type="button" onClick={() => setPestana(clave)}
              style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${pestana === clave ? 'var(--navy)' : 'var(--border)'}`,
                background: pestana === clave ? 'var(--navy)' : '#fff', color: pestana === clave ? '#fff' : 'var(--text)' }}>
              {texto}
            </button>
          ))}
        </div>

        {pestana === 'detalles' && (
          <Card title="Detalles de la actividad">
            <DatosOrden act={act} />
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>Lo que debes hacer</p>
              <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{act.descripcion || 'El administrador no agregó instrucciones.'}</p>
            </div>
            {act.notas_cierre && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>Notas de cierre</p>
                <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{act.notas_cierre}</p>
              </div>
            )}
          </Card>
        )}

        {pestana === 'mano' && lectura && (
          <>
            <Card title="Reporte de la orden" subtitle="Datos de la orden con la mano de obra y el material utilizados">
              <DatosOrden act={act} tecnico />
              <h4 style={subtitulo}>Mano de obra utilizada</h4>
              {act.mano_obra.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No se registró mano de obra.</p>}
              {act.mano_obra.map((l) => (
                <div key={l.id_linea} style={fila}>
                  <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.codigo} · {l.descripcion}</p>
                  <strong style={{ fontSize: 16 }}>{l.cantidad}</strong>
                </div>
              ))}
              <h4 style={subtitulo}>Material utilizado</h4>
              {totalInstalado === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No se registró material.</p>}
              {lineasMaterial}
              {act.notas_cierre && (
                <>
                  <h4 style={subtitulo}>Notas de cierre</h4>
                  <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{act.notas_cierre}</p>
                </>
              )}
            </Card>
            {visitas.length > 0 && (
              <Card title="Supervisión de la orden" subtitle="Calificaciones con el check list">
                {visitas.map((v) => (
                  <div key={v.id_supervision} style={fila}>
                    <div>
                      <p style={{ fontSize: 13.7, fontWeight: 600 }}>{v.supervisor}</p>
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{v.fecha} · {v.estado === 'completada' ? `Calificación ${v.puntaje}%` : 'Visita pendiente'}</p>
                    </div>
                    {v.estado === 'completada' && <strong style={{ fontSize: 18 }}>{v.puntaje}%</strong>}
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {pestana === 'mano' && !lectura && (
          <Card title="Mano de obra" subtitle="Trabajo realizado en esta actividad">
            {act.mano_obra.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no se registró mano de obra.</p>}
            {act.mano_obra.map((l) => (
              <div key={l.id_linea} style={fila}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.codigo} · {l.descripcion}</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Cantidad: {l.cantidad} {l.unidad}</p>
                </div>
                {accionLinea('editar-mo', l, `¿Quitar "${l.descripcion}" de la mano de obra?`, `/actividades/${id}/mano-obra/${l.id_linea}`)}
              </div>
            ))}
            {puedeEditar ? (
              act.catalogo_mano_obra.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>El administrador aún no cargó el catálogo de mano de obra.</p>
              ) : (
                <form onSubmit={agregarMO} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <Etiqueta>Mano de obra</Etiqueta>
                    <select required value={nuevoMO.id_mano_obra} onChange={(e) => setNuevoMO({ ...nuevoMO, id_mano_obra: e.target.value })} style={estiloCampo}>
                      <option value="">Elige del catálogo…</option>
                      {act.catalogo_mano_obra.map((m) => <option key={m.id_mano_obra} value={m.id_mano_obra}>{m.codigo} · {m.descripcion}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 110 }}>
                    <Etiqueta>Cantidad</Etiqueta>
                    <input type="number" inputMode="numeric" min="1" step="1" required value={nuevoMO.cantidad} onKeyDown={bloquearDecimales}
                      onChange={(e) => setNuevoMO({ ...nuevoMO, cantidad: e.target.value })} style={estiloCampo} />
                  </div>
                  <button type="submit" style={estiloBotonPrimario}>Agregar</button>
                </form>
              )
            ) : (
              <p style={{ fontSize: 13, color: 'var(--orange)', marginTop: 12 }}>{motivo}</p>
            )}
          </Card>
        )}

        {pestana === 'inventario' && (
          <>
            <Card title={`Instalado (${totalInstalado})`} subtitle={lectura ? 'Material usado junto con los datos de la orden' : 'Material usado en esta actividad'}>
              {lectura && (
                <div style={{ marginBottom: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                    <Dato etiqueta="Orden de trabajo" valor={act.orden_trabajo} />
                    <Dato etiqueta="Técnico" valor={act.tecnico} />
                    <Dato etiqueta="Cliente" valor={act.cliente} />
                    <Dato etiqueta="Fecha" valor={fechaLegible(act.fecha_programada)} />
                  </div>
                </div>
              )}
              {totalInstalado === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no se instaló material.</p>}
              {lineasMaterial}
              {!puedeEditar && !lectura && <p style={{ fontSize: 13, color: 'var(--orange)', marginTop: 12 }}>{motivo}</p>}
            </Card>

            <Card title={`Recurso (${act.recurso.length})`} subtitle={act.estado === 'pendiente' ? 'Todo el material disponible del técnico' : 'Material disponible del técnico'}>
              {puedeEditar && act.recurso.some((r) => r.con_serie) && (
                <div style={{ marginBottom: 12 }}>
                  <Etiqueta>Escanear serie (escáner de mano) o escribirla y pulsar Enter</Etiqueta>
                  <input value={escaneo} onChange={(e) => setEscaneo(e.target.value)} onKeyDown={escanear} placeholder="Escanea el código del equipo"
                    autoComplete="off" style={{ ...estiloCampo, fontFamily: 'monospace' }} aria-label="Escanear serie" />
                </div>
              )}
              {act.recurso.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  No hay existencias asignadas a este técnico. El administrador las carga en Gestionar actividades → Materiales e inventario.
                </p>
              )}
              {act.recurso.map((r) => r.con_serie ? (
                <details key={r.id_material} style={{ borderBottom: '1px solid var(--border)' }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 2px', display: 'flex', justifyContent: 'space-between', gap: 10, listStyle: 'none' }}>
                    <span style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>▸ {r.descripcion}</span>
                    <strong style={{ fontSize: 18 }}>{r.cantidad}</strong>
                  </summary>
                  {r.series.map((s) => (
                    <div key={s.id_serie} style={{ ...fila, background: '#f6f7f9', paddingLeft: 12, paddingRight: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{r.descripcion}</p>
                        <p style={{ fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{s.serie}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 18 }}>1</strong>
                        {puedeEditar && <button type="button" onClick={() => usarSerie(s.id_serie)} style={{ ...estiloBotonSecundario, padding: '6px 12px' }}>Usar</button>}
                      </div>
                    </div>
                  ))}
                </details>
              ) : (
                <div key={r.id_material} style={fila}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13.7, fontWeight: 600, overflowWrap: 'anywhere' }}>{r.descripcion}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.codigo}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 18 }}>{r.cantidad}</strong>
                    {puedeEditar && <button type="button" onClick={() => setModal({ tipo: 'usar', fila: r })} style={{ ...estiloBotonSecundario, padding: '6px 12px' }}>Usar</button>}
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>

      {modal?.tipo === 'completar' && <ModalCompletar onGuardar={completar} onCerrar={() => setModal(null)} />}
      {modal && modal.tipo !== 'completar' && (
        <ModalCantidad
          titulo={modal.tipo === 'usar' ? 'Usar material' : 'Cambiar cantidad'}
          ayuda={modal.tipo === 'usar' ? `${modal.fila.descripcion} · disponible: ${modal.fila.cantidad}` : modal.fila.descripcion}
          inicial={modal.tipo === 'usar' ? '1' : modal.fila.cantidad}
          max={modal.tipo === 'usar' ? modal.fila.cantidad : undefined}
          onGuardar={guardarCantidad} onCerrar={() => setModal(null)}
        />
      )}
    </AppLayout>
  );
}
