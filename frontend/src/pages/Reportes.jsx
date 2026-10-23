import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';

const REPORTES = [
  {
    id: 'desempeno-por-tecnico',
    etiqueta: 'Desempeño por técnico',
    columnas: [
      { clave: 'tecnico', titulo: 'Técnico' },
      { clave: 'zona', titulo: 'Zona' },
      { clave: 'rutas', titulo: 'Rutas' },
      { clave: 'rutas_completadas', titulo: 'Completadas' },
      { clave: 'puntos_visitados', titulo: 'Puntos visitados', formato: (f) => `${f.puntos_visitados}/${f.puntos}` },
      { clave: 'cumplimiento', titulo: '% cumplimiento', barra: true },
      { clave: 'nodos_registrados', titulo: 'Infraestructura registrada' },
      { clave: 'incidencias', titulo: 'Incidencias', formato: (f) => `${f.incidencias} (${f.incidencias_resueltas} resueltas)` },
      {
        clave: 'ultima_actividad',
        titulo: 'Última actividad',
        formato: (f) =>
          f.ultima_actividad
            ? new Date(f.ultima_actividad).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Sin actividad',
      },
    ],
  },
  {
    id: 'infraestructura-por-zona',
    etiqueta: 'Infraestructura por zona',
    columnas: [
      { clave: 'zona', titulo: 'Zona' },
      { clave: 'total', titulo: 'Total nodos' },
      { clave: 'activos', titulo: 'Activos' },
      { clave: 'en_mantenimiento', titulo: 'En mantenimiento' },
      { clave: 'inactivos', titulo: 'Inactivos' },
    ],
  },
  {
    id: 'incidencias-por-zona',
    etiqueta: 'Incidencias por zona',
    columnas: [
      { clave: 'zona', titulo: 'Zona' },
      { clave: 'total', titulo: 'Total incidencias' },
      { clave: 'abiertas', titulo: 'Abiertas' },
      { clave: 'en_atencion', titulo: 'En atención' },
      { clave: 'resueltas', titulo: 'Resueltas' },
    ],
  },
];

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '11px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };
const campo = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13.5 };

const aTexto = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Periodos rápidos: semana (lunes a domingo) y mes calendario.
function periodo(tipo) {
  const hoy = new Date();
  if (tipo === 'semana' || tipo === 'semana-pasada') {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - (tipo === 'semana-pasada' ? 7 : 0));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: aTexto(lunes), hasta: aTexto(domingo) };
  }
  const base = new Date(hoy.getFullYear(), hoy.getMonth() - (tipo === 'mes-pasado' ? 1 : 0), 1);
  const fin = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { desde: aTexto(base), hasta: aTexto(fin) };
}

const PERIODOS = [
  { id: 'semana', etiqueta: 'Esta semana' },
  { id: 'semana-pasada', etiqueta: 'Semana pasada' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes-pasado', etiqueta: 'Mes pasado' },
];

function Indicador({ titulo, valor, detalle }) {
  return (
    <div style={{ flex: '1 1 160px', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff' }}>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>{titulo}</p>
      <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{valor}</p>
      {detalle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{detalle}</p>}
    </div>
  );
}

export default function Reportes() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';
  const esGestor = esAdmin || usuario?.rol === 'supervisor';

  const [reporteId, setReporteId] = useState(REPORTES[0].id);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', id_zona: '', id_tecnico: '' });
  const [zonas, setZonas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');

  const reporte = REPORTES.find((r) => r.id === reporteId);

  const consulta = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }, [filtros]);

  useEffect(() => {
    cliente
      .get('/catalogos/zonas')
      .then((r) => setZonas(r.data))
      .catch(() => {});
    if (esAdmin) {
      cliente
        .get('/usuarios')
        .then((r) => setTecnicos(r.data.filter((u) => u.rol === 'tecnico')))
        .catch(() => {});
    }
  }, [esAdmin]);

  useEffect(() => {
    setCargando(true);
    cliente
      .get(`/reportes/${reporteId}${consulta ? `?${consulta}` : ''}`)
      .then((res) => {
        setFilas(res.data);
        setError('');
      })
      .catch(() => setError('No se pudo cargar el reporte'))
      .finally(() => setCargando(false));
  }, [reporteId, consulta]);

  function cambiar(clave, valor) {
    setFiltros((prev) => ({ ...prev, [clave]: valor }));
  }

  async function exportarExcel() {
    setExportando(true);
    setError('');
    try {
      const res = await cliente.get(`/reportes/exportar/excel${consulta ? `?${consulta}` : ''}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `red-track-reporte-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo generar el Excel. Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  // Indicadores del reporte de desempeño.
  const resumen = useMemo(() => {
    if (reporteId !== 'desempeno-por-tecnico') return null;
    const suma = (k) => filas.reduce((a, f) => a + Number(f[k] || 0), 0);
    const puntos = suma('puntos');
    const visitados = suma('puntos_visitados');
    return {
      tecnicos: filas.length,
      rutas: suma('rutas'),
      cumplimiento: puntos > 0 ? Math.round((visitados / puntos) * 1000) / 10 : 0,
      registrada: suma('nodos_registrados'),
      incidencias: suma('incidencias'),
    };
  }, [filas, reporteId]);

  const botonPrimario = (deshabilitado) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 8,
    border: 'none',
    background: deshabilitado ? '#c7ccd6' : 'var(--navy)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13.5,
  });

  return (
    <AppLayout title="Reportes">
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Tipo de reporte</label>
            <select value={reporteId} onChange={(e) => setReporteId(e.target.value)} style={{ ...campo, minWidth: 210 }}>
              {REPORTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Desde</label>
            <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiar('desde', e.target.value)} style={campo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Hasta</label>
            <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar('hasta', e.target.value)} style={campo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Zona</label>
            <select value={filtros.id_zona} onChange={(e) => cambiar('id_zona', e.target.value)} style={{ ...campo, minWidth: 140 }}>
              <option value="">Todas</option>
              {zonas.map((z) => (
                <option key={z.id_zona} value={z.id_zona}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>
          {esAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Técnico</label>
              <select value={filtros.id_tecnico} onChange={(e) => cambiar('id_tecnico', e.target.value)} style={{ ...campo, minWidth: 170 }}>
                <option value="">Todos</option>
                {tecnicos.map((t) => (
                  <option key={t.id_usuario} value={t.id_usuario}>
                    {t.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(filtros.desde || filtros.hasta || filtros.id_zona || filtros.id_tecnico) && (
            <button
              onClick={() => setFiltros({ desde: '', hasta: '', id_zona: '', id_tecnico: '' })}
              style={{ ...campo, background: '#fff', color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Limpiar filtros
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={exportarExcel} disabled={exportando} style={botonPrimario(exportando)}>
              {exportando ? 'Generando…' : '⬇ Exportar Excel'}
            </button>
          </div>
        </div>
        {!esGestor && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
            Como técnico, el desempeño y el Excel muestran solo tu información.
          </p>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Periodo rápido:</span>
        {PERIODOS.map((p) => {
          const rango = periodo(p.id);
          const activo = filtros.desde === rango.desde && filtros.hasta === rango.hasta;
          return (
            <button
              key={p.id}
              onClick={() => setFiltros((prev) => ({ ...prev, ...rango }))}
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: activo ? 'var(--navy)' : '#fff',
                color: activo ? '#fff' : 'var(--text)',
                fontWeight: 600,
                fontSize: 12.5,
              }}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      {resumen && !cargando && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          <Indicador titulo="Técnicos" valor={resumen.tecnicos} />
          <Indicador titulo="Rutas asignadas" valor={resumen.rutas} />
          <Indicador titulo="Cumplimiento de puntos" valor={`${resumen.cumplimiento}%`} />
          <Indicador titulo="Infraestructura registrada" valor={resumen.registrada} />
          <Indicador titulo="Incidencias reportadas" valor={resumen.incidencias} />
        </div>
      )}

      <Card title={reporte.etiqueta} subtitle={cargando ? 'Cargando…' : `${filas.length} fila(s)`}>
        {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
        {!cargando && filas.length === 0 && !error && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay datos para estos filtros.</p>
        )}
        {filas.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {reporte.columnas.map((c) => (
                    <th key={c.clave} style={th}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    {reporte.columnas.map((c, j) => (
                      <td key={c.clave} style={j === 0 ? { ...td, fontWeight: 600 } : td}>
                        {c.barra ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#eef0f4', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Number(f[c.clave]) || 0)}%`,
                                  height: '100%',
                                  background: Number(f[c.clave]) >= 80 ? 'var(--green)' : Number(f[c.clave]) >= 50 ? 'var(--orange)' : 'var(--red)',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{Number(f[c.clave]) || 0}%</span>
                          </div>
                        ) : c.formato ? (
                          c.formato(f)
                        ) : (
                          f[c.clave] ?? 0
                        )}
                      </td>
                    ))}
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
