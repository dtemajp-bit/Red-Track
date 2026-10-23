import { useCallback, useEffect, useMemo, useState } from 'react';
import cliente from '../api/cliente';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Foto from '../ui/Foto';
import Modal, { Etiqueta, estiloCampo } from '../ui/Modal';
import { IconAlert, IconCamera, IconEdit, IconExternal, IconPin, IconSearch, IconTarget, IconTrash, IconX } from '../ui/Icons';
import { useAuth } from '../context/AuthContext';
import { agregarACola, esErrorDeRed, reducirFoto } from '../lib/cola';
import { avisar } from '../lib/avisos';
import { comprimirFoto } from '../lib/foto';
import { eliminarConConfirmacion } from '../lib/borrar';

const TIPOS = [
  { valor: 'poste', etiqueta: 'Poste' },
  { valor: 'nodo_central', etiqueta: 'Nodo central' },
  { valor: 'caja_distribucion', etiqueta: 'Caja de distribución' },
];

const ESTADOS = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'mantenimiento', etiqueta: 'En revisión' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
];

const VACIO = { codigo: '', tipo: 'poste', latitud: '', longitud: '', estado: 'activo', observaciones: '', id_zona: '' };

const etiquetaTipo = (v) => TIPOS.find((t) => t.valor === v)?.etiqueta || v;
const etiquetaEstado = (v) => ESTADOS.find((e) => e.valor === v)?.etiqueta || v;
const fecha = (v) =>
  v ? new Date(v).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Valida coordenadas en el cliente para dar un mensaje claro antes de enviar.
function errorDeCoordenadas(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (lat === '' || lng === '' || !Number.isFinite(la) || !Number.isFinite(lo)) {
    return 'Ingresa la latitud y la longitud como números (ej. 14.6768300 y -90.5282640).';
  }
  if (la < -90 || la > 90) return 'La latitud debe estar entre -90 y 90.';
  if (lo < -180 || lo > 180) return 'La longitud debe estar entre -180 y 180.';
  return '';
}

// Selector de fotografía con vista previa. Sirve para el registro y para la edición.
function SelectorFoto({ id, previa, urlActual, onElegir, onQuitar }) {
  const hayFoto = Boolean(previa || urlActual);
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onElegir(archivo);
          e.target.value = '';
        }}
      />
      {hayFoto ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <Foto url={urlActual} previa={previa} tam={84} radio={8} alt="Fotografía del punto" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label htmlFor={id} className="rt-btn rt-btn-secundario" style={{ cursor: 'pointer', padding: '7px 12px', fontSize: 12.5 }}>
              <IconCamera size={15} /> Cambiar foto
            </label>
            <button type="button" className="rt-btn rt-btn-peligro" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={onQuitar}>
              <IconX size={14} /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            border: '1.5px dashed #c5cad4',
            borderRadius: 10,
            padding: '18px 12px',
            color: 'var(--text-muted)',
            background: '#fafbfc',
          }}
        >
          <IconCamera size={21} />
          <span style={{ fontSize: 12.9 }}>Subir o tomar foto</span>
        </label>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor, tono, activo, onClick }) {
  return (
    <button type="button" className={`rt-stat ${activo ? 'activo' : ''}`} onClick={onClick} aria-pressed={activo}>
      <p style={{ fontSize: 12.3, color: 'var(--text-muted)', marginBottom: 4 }}>{etiqueta}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: tono || 'var(--text)', lineHeight: 1.1 }}>{valor}</p>
    </button>
  );
}

export default function RegistrarInfraestructura() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  const [nodos, setNodos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [form, setForm] = useState(VACIO);
  const [foto, setFoto] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [gps, setGps] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const [detalle, setDetalle] = useState(null);
  const [editando, setEditando] = useState(null);
  const [edicion, setEdicion] = useState({ foto: null, previa: null, quitar: false });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  const cargarNodos = useCallback(async () => {
    try {
      const respuesta = await cliente.get('/nodos');
      setNodos(respuesta.data);
      setErrorCarga('');
    } catch {
      setErrorCarga('No se pudieron cargar los registros existentes.');
    } finally {
      setCargando(false);
    }
  }, []);

  const capturarUbicacion = useCallback((manual = false) => {
    if (!navigator.geolocation) {
      if (manual) setGps('Tu navegador no permite obtener la ubicación.');
      return;
    }
    setGps('Buscando señal GPS…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitud: pos.coords.latitude.toFixed(7),
          longitud: pos.coords.longitude.toFixed(7),
        }));
        setGps(`Ubicación capturada (precisión ≈ ${Math.round(pos.coords.accuracy)} m)`);
      },
      () => setGps('No se pudo obtener la ubicación. Ingrésala manualmente.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    cargarNodos();
    cliente
      .get('/catalogos/zonas')
      .then((r) => setZonas(r.data))
      .catch(() => setZonas([]));
    capturarUbicacion();
  }, [cargarNodos, capturarUbicacion]);

  function elegirFoto(archivo) {
    setFoto(archivo);
    setPrevia(URL.createObjectURL(archivo));
  }

  function quitarFoto() {
    setFoto(null);
    setPrevia(null);
  }

  function reiniciarFormulario() {
    setForm(VACIO);
    quitarFoto();
    setError('');
    capturarUbicacion();
  }

  async function manejarGuardar(evento) {
    evento.preventDefault();
    setError('');

    if (!form.codigo.trim()) return setError('El código del punto es obligatorio.');
    const errorCoord = errorDeCoordenadas(form.latitud, form.longitud);
    if (errorCoord) return setError(errorCoord);

    setGuardando(true);
    try {
      const datos = new FormData();
      datos.append('codigo', form.codigo.trim());
      datos.append('tipo', form.tipo);
      datos.append('latitud', form.latitud);
      datos.append('longitud', form.longitud);
      datos.append('estado', form.estado);
      datos.append('observaciones', form.observaciones);
      if (form.id_zona) datos.append('id_zona', form.id_zona);
      if (foto) datos.append('foto', await comprimirFoto(foto));

      await cliente.post('/nodos', datos);
      avisar(`Punto ${form.codigo.trim()} registrado correctamente`);
      reiniciarFormulario();
      cargarNodos();
    } catch (err) {
      if (esErrorDeRed(err)) {
        // Sin conexión: se guarda en este navegador y se envía desde Sincronización.
        try {
          const fotoReducida = foto ? await reducirFoto(foto) : null;
          const guardado = agregarACola({
            tipo: 'nodo',
            id_usuario: usuario.id_usuario,
            datos: { ...form },
            foto: fotoReducida,
          });
          reiniciarFormulario();
          avisar(
            guardado.fotoOmitida
              ? 'Sin conexión: el registro quedó guardado, pero la foto no cabía y se omitió. Envíalo desde Sincronización.'
              : 'Sin conexión: el registro quedó guardado en este equipo. Envíalo desde Sincronización.',
            'alerta'
          );
        } catch (e) {
          setError(e.message);
        }
      } else {
        setError(err.response?.data?.mensaje || 'Error al guardar el registro');
      }
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Edición (solo administrador) ----------
  function abrirEdicion(n) {
    setDetalle(null);
    setErrorEdicion('');
    setEdicion({ foto: null, previa: null, quitar: false });
    setEditando({
      id_nodo: n.id_nodo,
      codigo: n.codigo,
      tipo: n.tipo,
      latitud: String(n.latitud),
      longitud: String(n.longitud),
      estado: n.estado,
      observaciones: n.observaciones || '',
      id_zona: n.id_zona ? String(n.id_zona) : '',
      foto_url: n.foto_url,
    });
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    setErrorEdicion('');
    if (!editando.codigo.trim()) return setErrorEdicion('El código del punto es obligatorio.');
    const errorCoord = errorDeCoordenadas(editando.latitud, editando.longitud);
    if (errorCoord) return setErrorEdicion(errorCoord);

    setGuardandoEdicion(true);
    try {
      const datos = new FormData();
      datos.append('codigo', editando.codigo.trim());
      datos.append('tipo', editando.tipo);
      datos.append('latitud', editando.latitud);
      datos.append('longitud', editando.longitud);
      datos.append('estado', editando.estado);
      datos.append('observaciones', editando.observaciones);
      datos.append('id_zona', editando.id_zona);
      if (edicion.foto) datos.append('foto', await comprimirFoto(edicion.foto));
      else if (edicion.quitar) datos.append('quitar_foto', 'true');

      await cliente.put(`/nodos/${editando.id_nodo}`, datos);
      avisar(`Punto ${editando.codigo.trim()} actualizado`);
      setEditando(null);
      await cargarNodos();
    } catch (err) {
      setErrorEdicion(
        err.response?.data?.mensaje || 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      setGuardandoEdicion(false);
    }
  }

  // ---------- Eliminación (solo administrador) ----------
  async function eliminar(n) {
    try {
      const hecho = await eliminarConConfirmacion(
        `/nodos/${n.id_nodo}`,
        `Se eliminará el punto "${n.codigo}" y su fotografía. Esta acción no se puede deshacer.`,
        'Este punto tiene rutas, incidencias o cables asociados. Si continúas se borrarán también.'
      );
      if (hecho) {
        setDetalle(null);
        avisar(`Punto ${n.codigo} eliminado`);
        await cargarNodos();
      }
    } catch (err) {
      avisar(err.response?.data?.mensaje || 'No se pudo eliminar el punto', 'error');
    }
  }

  // ---------- Listado filtrado ----------
  const conteo = useMemo(() => {
    const c = { total: nodos.length, activo: 0, mantenimiento: 0, inactivo: 0 };
    nodos.forEach((n) => {
      c[n.estado] = (c[n.estado] || 0) + 1;
    });
    return c;
  }, [nodos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return nodos.filter((n) => {
      if (filtroEstado !== 'todos' && n.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && n.tipo !== filtroTipo) return false;
      if (!q) return true;
      return [n.codigo, n.nombre_zona, n.registrado_por, etiquetaTipo(n.tipo)].some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    });
  }, [nodos, busqueda, filtroEstado, filtroTipo]);

  const hayFiltros = busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos';

  function limpiarFiltros() {
    setBusqueda('');
    setFiltroEstado('todos');
    setFiltroTipo('todos');
  }

  function alternarEstado(estado) {
    setFiltroEstado((actual) => (actual === estado ? 'todos' : estado));
  }

  const subtituloLista = cargando
    ? 'Cargando…'
    : hayFiltros
    ? `${visibles.length} de ${nodos.length} elementos`
    : `${nodos.length} ${nodos.length === 1 ? 'elemento' : 'elementos'}`;

  return (
    <AppLayout title="Registrar infraestructura">
      <div className="rt-resumen">
        <Resumen etiqueta="Total registrado" valor={conteo.total} activo={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')} />
        <Resumen etiqueta="Activos" valor={conteo.activo} tono="var(--green)" activo={filtroEstado === 'activo'} onClick={() => alternarEstado('activo')} />
        <Resumen etiqueta="En revisión" valor={conteo.mantenimiento} tono="var(--orange)" activo={filtroEstado === 'mantenimiento'} onClick={() => alternarEstado('mantenimiento')} />
        <Resumen etiqueta="Inactivos" valor={conteo.inactivo} tono="var(--red)" activo={filtroEstado === 'inactivo'} onClick={() => alternarEstado('inactivo')} />
      </div>

      <div className="rt-grid-form">
        {/* ---------------- Formulario de registro ---------------- */}
        <Card>
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: 12,
              borderRadius: 8,
              background: 'var(--orange-bg)',
              color: 'var(--orange)',
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            <IconAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <p>Antes de continuar, verifica los riesgos eléctricos del punto y utiliza tu equipo de protección personal.</p>
          </div>

          <h2 style={{ fontSize: 15.5, marginBottom: 3 }}>Nuevo registro</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Poste, cable o nodo detectado en el punto actual de la ruta.
          </p>

          <form onSubmit={manejarGuardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="rt-grid-2">
              <div>
                <Etiqueta>Tipo de elemento</Etiqueta>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={estiloCampo}>
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Código *</Etiqueta>
                <input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="PT-0234"
                  maxLength={50}
                  style={estiloCampo}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Ubicación *</label>
                <button
                  type="button"
                  onClick={() => capturarUbicacion(true)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--info)', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0 }}
                >
                  <IconTarget size={14} /> Usar mi ubicación
                </button>
              </div>
              <div className="rt-grid-2">
                <input
                  inputMode="decimal"
                  aria-label="Latitud"
                  placeholder="Latitud  14.6768300"
                  value={form.latitud}
                  onChange={(e) => setForm({ ...form, latitud: e.target.value })}
                  style={estiloCampo}
                />
                <input
                  inputMode="decimal"
                  aria-label="Longitud"
                  placeholder="Longitud  -90.5282640"
                  value={form.longitud}
                  onChange={(e) => setForm({ ...form, longitud: e.target.value })}
                  style={estiloCampo}
                />
              </div>
              {gps && <p style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 5 }}>{gps}</p>}
            </div>

            <div>
              <Etiqueta>Zona</Etiqueta>
              <select value={form.id_zona} onChange={(e) => setForm({ ...form, id_zona: e.target.value })} style={estiloCampo}>
                <option value="">{esAdmin ? 'Sin zona' : 'Mi zona asignada'}</option>
                {zonas.map((z) => (
                  <option key={z.id_zona} value={z.id_zona}>
                    {z.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Etiqueta>Estado</Etiqueta>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ESTADOS.map((e) => (
                  <button
                    type="button"
                    key={e.valor}
                    className={`rt-chip ${form.estado === e.valor ? 'activo' : ''}`}
                    onClick={() => setForm({ ...form, estado: e.valor })}
                  >
                    {e.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Etiqueta>Fotografía</Etiqueta>
              <SelectorFoto id="foto-nueva" previa={previa} onElegir={elegirFoto} onQuitar={quitarFoto} />
            </div>

            <div>
              <Etiqueta>Observaciones</Etiqueta>
              <textarea
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas adicionales del técnico…"
                rows={3}
                style={{ ...estiloCampo, resize: 'vertical' }}
              />
            </div>

            {error && (
              <p role="alert" style={{ color: 'var(--red)', background: 'var(--red-bg)', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={guardando} className="rt-btn rt-btn-primario" style={{ padding: '10px 22px' }}>
                {guardando ? 'Guardando…' : '✓ Guardar registro'}
              </button>
              <button type="button" className="rt-btn rt-btn-secundario" onClick={reiniciarFormulario} disabled={guardando}>
                Limpiar
              </button>
            </div>
          </form>
        </Card>

        {/* ---------------- Listado ---------------- */}
        <Card title="Infraestructura registrada" subtitle={subtituloLista}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <IconSearch size={16} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-soft)' }} />
            <input
              placeholder="Buscar por código, zona o técnico…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar infraestructura"
              style={{ ...estiloCampo, paddingLeft: 34 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" className={`rt-chip ${filtroTipo === 'todos' ? 'activo' : ''}`} onClick={() => setFiltroTipo('todos')}>
              Todos
            </button>
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={`rt-chip ${filtroTipo === t.valor ? 'activo' : ''}`}
                onClick={() => setFiltroTipo(filtroTipo === t.valor ? 'todos' : t.valor)}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          {errorCarga && (
            <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>
              {errorCarga}{' '}
              <button type="button" onClick={cargarNodos} style={{ border: 'none', background: 'none', color: 'var(--info)', fontWeight: 600, padding: 0 }}>
                Reintentar
              </button>
            </p>
          )}

          <div style={{ maxHeight: 'min(560px, 70vh)', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
            {cargando ? (
              [0, 1, 2, 3].map((i) => <div key={i} className="rt-esqueleto" style={{ height: 56, marginBottom: 8 }} />)
            ) : visibles.length === 0 ? (
              <div className="rt-vacio">
                <span className="rt-vacio-icono">
                  <IconPin size={22} />
                </span>
                <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                  {hayFiltros ? 'Sin resultados' : 'Aún no hay registros'}
                </p>
                <p>
                  {hayFiltros ? (
                    <>
                      Ningún punto coincide con los filtros.{' '}
                      <button type="button" onClick={limpiarFiltros} style={{ border: 'none', background: 'none', color: 'var(--info)', fontWeight: 600, padding: 0 }}>
                        Quitar filtros
                      </button>
                    </>
                  ) : (
                    'Registra el primer punto con el formulario.'
                  )}
                </p>
              </div>
            ) : (
              visibles.map((n) => (
                <div key={n.id_nodo} className="rt-fila">
                  <Foto url={n.foto_url} alt={n.codigo} tam={44} onClick={() => setDetalle(n)} />
                  <button
                    type="button"
                    onClick={() => setDetalle(n)}
                    style={{ flex: '1 1 150px', minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', padding: 0 }}
                  >
                    <p style={{ fontSize: 13.7, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.codigo}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {etiquetaTipo(n.tipo)} · {n.nombre_zona || 'Sin zona'}
                    </p>
                  </button>
                  <Badge tono={n.estado}>{etiquetaEstado(n.estado)}</Badge>
                  {esAdmin && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="rt-btn-icono" title="Editar" aria-label={`Editar ${n.codigo}`} onClick={() => abrirEdicion(n)}>
                        <IconEdit size={15} />
                      </button>
                      <button type="button" className="rt-btn-icono peligro" title="Eliminar" aria-label={`Eliminar ${n.codigo}`} onClick={() => eliminar(n)}>
                        <IconTrash size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ---------------- Detalle ---------------- */}
      {detalle && (
        <Modal titulo={detalle.codigo} onCerrar={() => setDetalle(null)} ancho={480}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <Foto url={detalle.foto_url} alt={detalle.codigo} tam={112} radio={10} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div>
                <Badge tono={detalle.estado}>{etiquetaEstado(detalle.estado)}</Badge>
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600 }}>{etiquetaTipo(detalle.tipo)}</p>
              <p style={{ fontSize: 12.8, color: 'var(--text-muted)' }}>{detalle.nombre_zona || 'Sin zona'}</p>
            </div>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13.3, margin: 0 }}>
            <dt style={{ color: 'var(--text-soft)' }}>Coordenadas</dt>
            <dd style={{ margin: 0 }}>
              {Number(detalle.latitud).toFixed(6)}, {Number(detalle.longitud).toFixed(6)}
            </dd>
            <dt style={{ color: 'var(--text-soft)' }}>Registrado por</dt>
            <dd style={{ margin: 0 }}>{detalle.registrado_por || '—'}</dd>
            <dt style={{ color: 'var(--text-soft)' }}>Fecha</dt>
            <dd style={{ margin: 0 }}>{fecha(detalle.capturado_en || detalle.creado_en)}</dd>
            <dt style={{ color: 'var(--text-soft)' }}>Observaciones</dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detalle.observaciones || '—'}</dd>
          </dl>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 20 }}>
            <a
              className="rt-btn rt-btn-secundario"
              style={{ textDecoration: 'none' }}
              href={`https://www.google.com/maps?q=${detalle.latitud},${detalle.longitud}`}
              target="_blank"
              rel="noreferrer"
            >
              <IconExternal size={15} /> Ver en el mapa
            </a>
            {esAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="rt-btn rt-btn-peligro" onClick={() => eliminar(detalle)}>
                  <IconTrash size={15} /> Eliminar
                </button>
                <button type="button" className="rt-btn rt-btn-primario" onClick={() => abrirEdicion(detalle)}>
                  <IconEdit size={15} /> Editar
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ---------------- Edición ---------------- */}
      {editando && (
        <Modal titulo={`Editar ${editando.codigo || 'punto'}`} onCerrar={() => !guardandoEdicion && setEditando(null)} ancho={560}>
          <form onSubmit={guardarEdicion} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="rt-grid-2">
              <div>
                <Etiqueta>Código *</Etiqueta>
                <input value={editando.codigo} maxLength={50} onChange={(e) => setEditando({ ...editando, codigo: e.target.value })} style={estiloCampo} />
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
                <Etiqueta>Latitud *</Etiqueta>
                <input inputMode="decimal" value={editando.latitud} onChange={(e) => setEditando({ ...editando, latitud: e.target.value })} style={estiloCampo} />
              </div>
              <div>
                <Etiqueta>Longitud *</Etiqueta>
                <input inputMode="decimal" value={editando.longitud} onChange={(e) => setEditando({ ...editando, longitud: e.target.value })} style={estiloCampo} />
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
              <Etiqueta>Fotografía</Etiqueta>
              <SelectorFoto
                id="foto-edicion"
                previa={edicion.previa}
                urlActual={edicion.quitar ? null : editando.foto_url}
                onElegir={(archivo) => setEdicion({ foto: archivo, previa: URL.createObjectURL(archivo), quitar: false })}
                onQuitar={() => setEdicion({ foto: null, previa: null, quitar: true })}
              />
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

            {errorEdicion && (
              <p role="alert" style={{ color: 'var(--red)', background: 'var(--red-bg)', padding: '9px 12px', borderRadius: 8, fontSize: 13 }}>
                {errorEdicion}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="rt-btn rt-btn-secundario" onClick={() => setEditando(null)} disabled={guardandoEdicion}>
                Cancelar
              </button>
              <button type="submit" className="rt-btn rt-btn-primario" disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
