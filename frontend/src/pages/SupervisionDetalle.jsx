import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import EstadoActividad from '../ui/EstadoActividad';
import { Etiqueta, estiloBotonPrimario, estiloBotonSecundario, estiloCampo } from '../ui/Modal';
import cliente from '../api/cliente';
import { avisar } from '../lib/avisos';
import { fechaLegible, mensajeError, ventana } from '../lib/actividades';

const RESPUESTAS = [
  ['cumple', 'Cumple', '#17a35a'],
  ['no_cumple', 'No cumple', '#e5484d'],
  ['na', 'No aplica', '#7b8494'],
];

// Check list de una visita: el supervisor marca cada punto y el sistema calcula la calificación.
export default function SupervisionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sup, setSup] = useState(undefined); // undefined = cargando, null = no disponible
  const [error, setError] = useState('');
  const [puntos, setPuntos] = useState([]);
  const [resp, setResp] = useState({});
  const [comentario, setComentario] = useState('');
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const { data } = await cliente.get(`/supervision/${id}`);
      setSup(data);
      setPuntos(data.puntos);
      setComentario(data.comentario || '');
      setResp(Object.fromEntries(data.puntos.filter((p) => p.respuesta).map((p) => [p.id_item, p.respuesta])));
      setEditando(data.estado !== 'completada');
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la visita'));
      setSup(null);
    }
  }
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volver a calificar usa el check list vigente.
  async function recalificar() {
    try {
      const { data } = await cliente.get('/supervision/items');
      setPuntos(data.map((p) => ({ id_item: p.id_item, descripcion: p.descripcion, respuesta: null })));
      setResp((prev) => Object.fromEntries(data.filter((p) => prev[p.id_item]).map((p) => [p.id_item, prev[p.id_item]])));
      setEditando(true);
    } catch (err) { avisar(mensajeError(err, 'No se pudo cargar el check list'), 'error'); }
  }

  const { puntaje, contestados } = useMemo(() => {
    const valores = puntos.map((p) => resp[p.id_item]).filter(Boolean);
    const aplican = valores.filter((v) => v !== 'na').length;
    const cumple = valores.filter((v) => v === 'cumple').length;
    return { puntaje: aplican ? Math.round((cumple / aplican) * 10000) / 100 : null, contestados: valores.length };
  }, [puntos, resp]);

  async function guardar() {
    setGuardando(true);
    try {
      const { data } = await cliente.put(`/supervision/${id}/calificar`, { respuestas: resp, comentario });
      avisar(data.mensaje, 'exito');
      await cargar();
    } catch (err) { avisar(mensajeError(err, 'No se pudo guardar la calificación'), 'error'); } finally { setGuardando(false); }
  }

  if (sup === undefined || sup === null) {
    return (
      <AppLayout eyebrow="SUPERVISIÓN" title="Visita de supervisión">
        <Card>
          <p style={{ fontSize: 13.5, color: sup === null ? 'var(--red)' : 'var(--text-muted)' }}>{sup === null ? error : 'Cargando…'}</p>
          <button type="button" onClick={() => navigate('/supervision')} style={{ ...estiloBotonSecundario, marginTop: 12 }}>Volver a la ruta</button>
        </Card>
      </AppLayout>
    );
  }

  const puedeCalificar = sup.puede_calificar;
  const completada = sup.estado === 'completada';
  return (
    <AppLayout eyebrow="SUPERVISIÓN" title="Visita de supervisión">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
        <button type="button" onClick={() => navigate('/supervision')} style={{ ...estiloBotonSecundario, alignSelf: 'flex-start' }}>‹ Volver a la ruta</button>

        <Card title={sup.orden_trabajo} subtitle={`Técnico: ${sup.tecnico}`} action={<EstadoActividad estado={sup.estado_actividad} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 14 }}>
            <div><p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Fecha de la visita</p><p>{fechaLegible(sup.fecha)}</p></div>
            <div><p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Ventana</p><p>{ventana(sup)}</p></div>
            <div><p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Cliente</p><p>{sup.cliente || '—'}</p></div>
            <div><p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Dirección</p><p style={{ overflowWrap: 'anywhere' }}>{sup.direccion || '—'}</p></div>
            <div><p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Supervisor</p><p>{sup.supervisor}</p></div>
          </div>
          <button type="button" onClick={() => navigate(`/actividad/${sup.id_actividad}`)} style={{ ...estiloBotonSecundario, marginTop: 14 }}>Ver la orden</button>
        </Card>

        <Card
          title="Check list de desempeño"
          subtitle={editando && puedeCalificar ? 'Marca cada punto: cumple, no cumple o no aplica' : completada ? 'Calificación registrada' : 'Solo el supervisor asignado puede calificar'}
          action={puntaje !== null ? <strong style={{ fontSize: 22 }}>{puntaje}%</strong> : null}
        >
          {puntos.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>El check list no tiene puntos. El administrador los agrega en Gestionar actividades → Check list.</p>}
          {puntos.map((p, i) => {
            const valor = resp[p.id_item];
            return (
              <div key={p.id_item} style={{ padding: '12px 2px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13.7, fontWeight: 600, marginBottom: 8, overflowWrap: 'anywhere' }}>{i + 1}. {p.descripcion}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {RESPUESTAS.map(([clave, texto, color]) => {
                    const marcado = valor === clave;
                    const habilitado = editando && puedeCalificar;
                    if (!habilitado && !marcado) return null;
                    return (
                      <button key={clave} type="button" disabled={!habilitado} aria-pressed={marcado}
                        onClick={() => setResp({ ...resp, [p.id_item]: clave })}
                        style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: habilitado ? 'pointer' : 'default',
                          border: `1px solid ${marcado ? color : 'var(--border)'}`, background: marcado ? color : '#fff', color: marcado ? '#fff' : 'var(--text)' }}>
                        {texto}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16 }}>
            <Etiqueta>Comentarios del supervisor</Etiqueta>
            <textarea rows={3} value={comentario} disabled={!(editando && puedeCalificar)} onChange={(e) => setComentario(e.target.value)} style={{ ...estiloCampo, resize: 'vertical' }} />
          </div>

          {puedeCalificar && editando && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" disabled={guardando || contestados < puntos.length || puntos.length === 0} onClick={guardar} style={estiloBotonPrimario}>Guardar calificación</button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{contestados}/{puntos.length} puntos respondidos</span>
            </div>
          )}
          {puedeCalificar && completada && !editando && (
            <button type="button" onClick={recalificar} style={{ ...estiloBotonSecundario, marginTop: 14 }}>Volver a calificar</button>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
