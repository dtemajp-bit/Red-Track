import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import cliente from '../api/cliente';

const REPORTES = [
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
  {
    id: 'rutas-por-tecnico',
    etiqueta: 'Rutas por técnico',
    columnas: [
      { clave: 'tecnico', titulo: 'Técnico' },
      { clave: 'rutas', titulo: 'Rutas asignadas' },
      { clave: 'rutas_completadas', titulo: 'Completadas' },
      { clave: 'puntos', titulo: 'Puntos totales' },
      { clave: 'incidencias', titulo: 'Incidencias reportadas' },
    ],
  },
];

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '11px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };

export default function Reportes() {
  const [reporteId, setReporteId] = useState(REPORTES[0].id);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const reporte = REPORTES.find((r) => r.id === reporteId);

  useEffect(() => {
    setCargando(true);
    cliente
      .get(`/reportes/${reporteId}`)
      .then((res) => {
        setFilas(res.data);
        setError('');
      })
      .catch(() => setError('No se pudo cargar el reporte'))
      .finally(() => setCargando(false));
  }, [reporteId]);

  function exportarCsv() {
    const encabezado = reporte.columnas.map((c) => c.titulo).join(',');
    const cuerpo = filas.map((f) => reporte.columnas.map((c) => f[c.clave] ?? 0).join(',')).join('\n');
    const csv = `${encabezado}\n${cuerpo}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${reporteId}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout title="Reportes">
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Tipo de reporte</label>
            <select
              value={reporteId}
              onChange={(e) => setReporteId(e.target.value)}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13.5, minWidth: 220 }}
            >
              {REPORTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportarCsv}
            disabled={filas.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: filas.length === 0 ? '#c7ccd6' : 'var(--navy)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </Card>

      <Card title={reporte.etiqueta} subtitle={cargando ? 'Cargando…' : `${filas.length} fila(s)`}>
        {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
        {!cargando && filas.length === 0 && !error && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay datos para este reporte todavía.</p>
        )}
        {filas.length > 0 && (
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
                      {f[c.clave] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppLayout>
  );
}
