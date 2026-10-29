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
import { ESTADOS, duracion, esAdmin, esGestor, fechaLegible, horaLegible, mensajeError, ventana } from '../lib/actividades';

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 2 }}>{etiqueta}</p>
      <p style={{ fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere' }}>{valor || '—'}</p>
    </div>
  );
}

// Ventana para pedir una cantidad (usar material, cambiar cantidad, cerrar orden con notas).
function ModalCantidad({ titulo, ayuda, inicial = '', max, onGuardar, onCerrar }) {
  const [valor, setValor] = useState(String(inicial));
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try { await onGuardar(Number(valor)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho={380}>
      <form onSubmit={enviar}>
        {ayuda && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{ayuda}</p>}
        <Etiqueta>Cantidad</Etiqueta>
        <input type="number" min="0.01" step="0.01" max={max} required autoFocus value={valor}
          onChange={(e) => setValor(e.target.value)} style={estiloCampo} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={estiloBotonPrimario}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCerrar({ onGuardar, onCerrar }) {
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    try { await onGuardar(notas); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo="Cerrar orden" onCerrar={onCerrar} ancho={420}>
      <form onSubmit={enviar}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Antes de cerrar, revisa que la mano de obra y el inventario estén completos.
        </p>
        <Etiqueta>Notas de cierre (opcional)</Etiqueta>
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} style={{ ...estiloCampo, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCerrar} style={estiloBotonSecundario}>Cancelar</button>
          <button type="submit" disabled={enviando} style={{ ...estiloBotonPrimario, background: ESTADOS.cerrado.cuadro }}>Cerrar orden</button>
        </div>
      </form>
    </Modal>
  );
}

const fila = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--border)' };

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

  async function iniciar() {
    setTrabajando(true);
    await ejecutar(cliente.put(`/actividades/${id}/iniciar`), 'Orden iniciada: ahora estás en ruta');
    setTrabajando(false);
  }
  async function cerrar(notas) {
    if (await ejecutar(cliente.put(`/actividades/${id}/cerrar`, { notas_cierre: notas }))) setModal(null);
  }
  async function reabrir() {
    const si = await confirmar({ titulo: 'Reabrir orden', mensaje: 'La actividad volverá a estar en ruta. ¿Continuar?', textoConfirmar: 'Reabrir' });
    if (si) await ejecutar(cliente.put(`/actividades/${id}/reabrir`));
  }
  async function agregarMO(e) {
    e.preventDefault();
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
  const puedeEditar = act.puede_editar_lineas;
  const motivo = !act.puede_operar ? 'Modo supervisión: solo el técnico responsable o el administrador pueden registrar mano de obra e inventario.' : act.estado === 'pendiente' ? 'Inicia la orden para registrar mano de obra e inventario.' : 'La orden está cerrada; solo el administrador puede modificarla.';
  const pasos = act.estado === 'pendiente' ? 0 : act.estado === 'en_ruta' ? 1 : 2;
  const pestanas = [['detalles', 'Detalles'], ['mano', `Mano de obra (${act.mano_obra.length})`], ['inventario', `Inventario (${act.materiales.length + act.series_instaladas.length})`]];

  const accionLinea = (tipo, f, texto, ruta) => puedeEditar && (
    <div style={{ display: 'flex', gap: 6 }}>
      <button type="button" className="rt-btn-icono" aria-label="Cambiar cantidad" onClick={() => setModal({ tipo, fila: f })}><IconEdit size={15} /></button>
      <button type="button" className="rt-btn-icono" aria-label="Quitar" onClick={() => quitar(ruta, texto)}><IconTrash size={15} /></button>
    </div>
  );

  return (
    <AppLayout title="Detalle de actividad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <button type="button" onClick={() => navigate('/panel')} style={{ ...estiloBotonSecundario, alignSelf: 'flex-start' }}>‹ Volver a la lista</button>

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
            <p style={{ fontSize: 12.5, marginBottom: 8 }}>Flujo de trabajo de esta actividad · Pasos {pasos}/2</p>
            {[['Iniciar orden (en ruta): avisa que te diriges al domicilio y puedes comenzar tu actividad.', 1], ['Cerrar orden: al terminar, con mano de obra e inventario registrados.', 2]].map(([t, n]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '3px 0' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '2px solid #9fb0c8', background: pasos >= n ? '#17a35a' : 'transparent', borderColor: pasos >= n ? '#17a35a' : '#9fb0c8' }} />
                <span style={{ opacity: pasos >= n ? 0.7 : 1 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            {act.puede_operar && act.estado === 'pendiente' && (
              <button type="button" disabled={trabajando} onClick={iniciar} style={{ ...estiloBotonPrimario, width: '100%', padding: '13px 16px', fontSize: 15, background: ESTADOS.en_ruta.cuadro }}>Iniciar orden</button>
            )}
            {act.puede_operar && act.estado === 'en_ruta' && (
              <button type="button" onClick={() => setModal({ tipo: 'cerrar' })} style={{ ...estiloBotonPrimario, width: '100%', padding: '13px 16px', fontSize: 15, background: ESTADOS.cerrado.cuadro }}>Cerrar orden</button>
            )}
            {!act.puede_operar && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Modo supervisión: puedes ver esta actividad, pero solo el técnico responsable o el administrador pueden modificarla.
              </p>
            )}
            {act.puede_operar && act.estado === 'cerrado' && (
              admin
                ? <button type="button" onClick={reabrir} style={{ ...estiloBotonSecundario, width: '100%', padding: '12px 16px' }}>Reabrir orden</button>
                : <p style={{ fontSize: 13.5, color: ESTADOS.cerrado.texto, fontWeight: 600, textAlign: 'center' }}>Orden cerrada</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <Dato etiqueta="Tipo" valor={act.tipo} />
              <Dato etiqueta="Caja terminal" valor={act.caja_terminal} />
              <Dato etiqueta="Fecha programada" valor={fechaLegible(act.fecha_programada)} />
              <Dato etiqueta="Ventana de entrega" valor={ventana(act)} />
              <Dato etiqueta="Cliente" valor={act.cliente} />
              <Dato etiqueta="Teléfono" valor={act.telefono} />
              <Dato etiqueta="Dirección" valor={act.direccion} />
              <Dato etiqueta="Inicio" valor={horaLegible(act.iniciado_en)} />
              <Dato etiqueta="Cierre" valor={horaLegible(act.cerrado_en)} />
              <Dato etiqueta="Duración" valor={duracion(act.iniciado_en, act.cerrado_en)} />
            </div>
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

        {pestana === 'mano' && (
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
                    <input type="number" min="0.01" step="0.01" required value={nuevoMO.cantidad} onChange={(e) => setNuevoMO({ ...nuevoMO, cantidad: e.target.value })} style={estiloCampo} />
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
            <Card title={`Instalado (${act.materiales.length + act.series_instaladas.length})`} subtitle="Material usado en esta actividad">
              {act.materiales.length + act.series_instaladas.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no se instaló material.</p>}
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
              {!puedeEditar && <p style={{ fontSize: 13, color: 'var(--orange)', marginTop: 12 }}>{motivo}</p>}
            </Card>

            <Card title={`Recurso (${act.recurso.length})`} subtitle={act.estado === 'pendiente' ? 'Todo el material disponible del técnico' : 'Material disponible del técnico'}>
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

      {modal?.tipo === 'cerrar' && <ModalCerrar onGuardar={cerrar} onCerrar={() => setModal(null)} />}
      {modal && modal.tipo !== 'cerrar' && (
        <ModalCantidad
          titulo={modal.tipo === 'usar' ? 'Usar material' : 'Cambiar cantidad'}
          ayuda={modal.tipo === 'usar' ? `${modal.fila.descripcion} · disponible: ${modal.fila.cantidad}` : modal.fila.descripcion}
          inicial={modal.tipo === 'usar' ? '' : modal.fila.cantidad}
          max={modal.tipo === 'usar' ? modal.fila.cantidad : undefined}
          onGuardar={guardarCantidad} onCerrar={() => setModal(null)}
        />
      )}
    </AppLayout>
  );
}
