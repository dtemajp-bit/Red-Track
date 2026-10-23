import { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { IconWifiOff, IconClock, IconCheck } from '../ui/Icons';
import { obtenerCola, quitarDeCola, enviarRegistro, esErrorDeRed } from '../lib/cola';

const ETIQUETA_TIPO = { nodo: 'Infraestructura', cable: 'Cable', incidencia: 'Incidencia' };

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '10px 6px', fontSize: 13, borderTop: '1px solid var(--border)' };

const formatoFecha = (valor) =>
  valor
    ? new Date(valor).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

function resumenLocal(r) {
  if (r.tipo === 'nodo') return `${r.datos.codigo || 'Sin código'} · ${String(r.datos.tipo || '').replace('_', ' ')}`;
  return String(r.datos.descripcion || '').slice(0, 70);
}

export default function Sincronizacion() {
  const { usuario } = useAuth();
  const esGestor = ['administrador', 'supervisor'].includes(usuario?.rol);

  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [locales, setLocales] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [erroresLocales, setErroresLocales] = useState({});
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmados, setConfirmados] = useState(null);
  const [error, setError] = useState('');
  const ocupado = useRef(false);

  const cargarTodo = useCallback(async () => {
    setLocales(obtenerCola(usuario.id_usuario));
    const consulta = tecnicoFiltro && esGestor ? `?id_tecnico=${tecnicoFiltro}` : '';
    const [resPend, resHist, resResumen] = await Promise.allSettled([
      cliente.get('/sincronizacion/pendientes'),
      cliente.get(`/sincronizacion/historial${consulta}`),
      esGestor && usuario.rol === 'administrador' ? cliente.get('/sincronizacion/resumen') : Promise.resolve({ data: [] }),
    ]);
    if (resPend.status === 'fulfilled') setPendientes(resPend.value.data);
    if (resHist.status === 'fulfilled') setHistorial(resHist.value.data);
    if (resResumen.status === 'fulfilled') setResumen(resResumen.value.data);
    const fallo = [resPend, resHist].find((r) => r.status === 'rejected');
    setError(fallo ? 'No se pudo consultar el servidor. Revisa tu conexión.' : '');
  }, [usuario.id_usuario, usuario.rol, esGestor, tecnicoFiltro]);

  useEffect(() => {
    (async () => {
      setCargando(true);
      await cargarTodo();
      setCargando(false);
    })();
  }, [cargarTodo]);

  const sincronizar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setSincronizando(true);
    setConfirmados(null);
    const nuevosErrores = {};
    let exitosos = 0;
    let sinRed = false;

    // 1) Registros guardados en este equipo.
    for (const r of obtenerCola(usuario.id_usuario)) {
      try {
        await enviarRegistro(r);
        quitarDeCola(r.idLocal);
        exitosos += 1;
      } catch (e) {
        if (esErrorDeRed(e)) {
          sinRed = true;
          break;
        }
        nuevosErrores[r.idLocal] = e.response?.data?.mensaje || 'El servidor rechazó este registro';
      }
    }

    // 2) Registros pendientes que ya estaban en el servidor.
    if (!sinRed) {
      try {
        const { data } = await cliente.get('/sincronizacion/pendientes');
        for (const p of data) {
          try {
            await cliente.put(`/sincronizacion/${p.id_registro}/sincronizar`);
            exitosos += 1;
          } catch (e) {
            if (esErrorDeRed(e)) break;
          }
        }
      } catch {
        /* se reintenta en la siguiente sincronización */
      }
    }

    setErroresLocales(nuevosErrores);
    setConfirmados(sinRed ? null : exitosos);
    if (sinRed) setError('Sin conexión con el servidor. Tus registros siguen guardados; reintenta al recuperar señal.');
    setSincronizando(false);
    ocupado.current = false;
    await cargarTodo();
  }, [usuario.id_usuario, cargarTodo]);

  useEffect(() => {
    function alVolverConexion() {
      setEnLinea(true);
      // Al recuperar señal, se envía solo lo que haya quedado guardado en este equipo.
      if (obtenerCola(usuario.id_usuario).length > 0) sincronizar();
    }
    const alPerderConexion = () => setEnLinea(false);
    const alCambiarCola = () => setLocales(obtenerCola(usuario.id_usuario));
    window.addEventListener('online', alVolverConexion);
    window.addEventListener('offline', alPerderConexion);
    window.addEventListener('cola-sync-cambio', alCambiarCola);
    return () => {
      window.removeEventListener('online', alVolverConexion);
      window.removeEventListener('offline', alPerderConexion);
      window.removeEventListener('cola-sync-cambio', alCambiarCola);
    };
  }, [usuario.id_usuario, sincronizar]);

  function descartarLocal(idLocal) {
    quitarDeCola(idLocal);
    setErroresLocales((prev) => {
      const copia = { ...prev };
      delete copia[idLocal];
      return copia;
    });
    setLocales(obtenerCola(usuario.id_usuario));
  }

  const total = locales.length + pendientes.length;

  return (
    <AppLayout title="Sincronización">
      <Card style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderRadius: 8,
            background: enLinea ? 'var(--green-bg)' : 'var(--orange-bg)',
            color: enLinea ? 'var(--green)' : 'var(--orange)',
            marginBottom: 18,
          }}
        >
          <IconWifiOff size={18} />
          <div>
            <p style={{ fontWeight: 600, fontSize: 13.7 }}>{enLinea ? 'Conectado' : 'Sin conexión'}</p>
            <p style={{ fontSize: 12.7 }}>
              {enLinea
                ? 'Tu conexión está activa. Lo que registres sin señal se envía desde aquí.'
                : 'Tus registros se están guardando en este equipo. Se enviarán cuando recuperes señal.'}
            </p>
          </div>
        </div>

        {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Cargando…</p>
        ) : (
          <>
            {locales.length > 0 && (
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                GUARDADOS EN ESTE EQUIPO
              </p>
            )}
            {locales.map((r) => (
              <div
                key={r.idLocal}
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
                  <IconClock size={16} color="var(--text-soft)" />
                  <div>
                    <p style={{ fontSize: 13.7, fontWeight: 600 }}>{ETIQUETA_TIPO[r.tipo] || r.tipo}</p>
                    <p style={{ fontSize: 12.3, color: 'var(--text-muted)' }}>{resumenLocal(r)}</p>
                    {erroresLocales[r.idLocal] && (
                      <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>
                        {erroresLocales[r.idLocal]}{' '}
                        <button
                          onClick={() => descartarLocal(r.idLocal)}
                          style={{ border: 'none', background: 'none', color: 'var(--red)', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
                        >
                          Descartar
                        </button>
                      </p>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatoFecha(r.creadoEn)}</span>
              </div>
            ))}

            {pendientes.length > 0 && (
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 4px' }}>
                PENDIENTES EN EL SERVIDOR
              </p>
            )}
            {pendientes.map((p) => (
              <div
                key={p.id_registro}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 4px', borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <p style={{ fontSize: 13.7, fontWeight: 600 }}>{ETIQUETA_TIPO[p.tipo_entidad] || p.tipo_entidad}</p>
                  <p style={{ fontSize: 12.3, color: 'var(--text-muted)' }}>Registro #{p.id_registro}</p>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatoFecha(p.creado_en)}</span>
              </div>
            ))}

            {total === 0 && confirmados !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px', color: 'var(--green)', fontSize: 13.7 }}>
                <IconCheck size={16} />
                {confirmados} registro(s) sincronizado(s) correctamente.
              </div>
            )}
            {total === 0 && confirmados === null && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 4px 10px' }}>
                No tienes registros pendientes. Todo lo que registras en línea se guarda de inmediato.
              </p>
            )}
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} registros pendientes</p>
          <button
            onClick={sincronizar}
            disabled={!enLinea || sincronizando || total === 0}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: !enLinea || total === 0 ? '#c7ccd6' : 'var(--navy)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            {sincronizando ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
        </div>
      </Card>

      {usuario.rol === 'administrador' && (
        <Card title="Estado por técnico" subtitle="Actividad registrada y pendientes de cada técnico" style={{ marginBottom: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Técnico</th>
                  <th style={th}>Infraestructura</th>
                  <th style={th}>Incidencias</th>
                  <th style={th}>Enviados tras quedar sin señal</th>
                  <th style={th}>Pendientes en servidor</th>
                  <th style={th}>Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((t) => (
                  <tr key={t.id_usuario}>
                    <td style={{ ...td, fontWeight: 600 }}>{t.tecnico}</td>
                    <td style={td}>{t.nodos}</td>
                    <td style={td}>{t.incidencias}</td>
                    <td style={td}>{t.desde_sin_conexion}</td>
                    <td style={td}>{t.pendientes_servidor}</td>
                    <td style={td}>{formatoFecha(t.ultima_actividad)}</td>
                  </tr>
                ))}
                {resumen.length === 0 && (
                  <tr>
                    <td style={{ ...td, color: 'var(--text-muted)' }} colSpan={6}>
                      Aún no hay técnicos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title={esGestor ? 'Actividad reciente de los técnicos' : 'Mi actividad reciente'}
        subtitle="Lo último que llegó al servidor"
        action={
          usuario.rol === 'administrador' && resumen.length > 0 ? (
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
            >
              <option value="">Todos los técnicos</option>
              {resumen.map((t) => (
                <option key={t.id_usuario} value={t.id_usuario}>
                  {t.tecnico}
                </option>
              ))}
            </select>
          ) : null
        }
      >
        {!cargando && historial.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Todavía no hay actividad registrada.</p>
        )}
        {historial.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Tipo</th>
                  <th style={th}>Detalle</th>
                  {esGestor && <th style={th}>Técnico</th>}
                  <th style={th}>Origen</th>
                  <th style={th}>Capturado</th>
                  <th style={th}>Recibido</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={`${h.tipo}-${h.id}`}>
                    <td style={{ ...td, fontWeight: 600 }}>{ETIQUETA_TIPO[h.tipo] || h.tipo}</td>
                    <td style={td}>{h.detalle}</td>
                    {esGestor && <td style={td}>{h.tecnico || '—'}</td>}
                    <td style={td}>
                      <Badge tono={h.origen === 'sin_conexion' ? 'pendiente' : 'activo'}>
                        {h.origen === 'sin_conexion' ? 'Sin conexión' : 'En línea'}
                      </Badge>
                    </td>
                    <td style={td}>{formatoFecha(h.capturado_en || h.sincronizado_en)}</td>
                    <td style={td}>{formatoFecha(h.sincronizado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
