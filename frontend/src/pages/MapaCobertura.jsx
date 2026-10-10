import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import cliente from '../api/cliente';

const TIPOS = [
  { valor: 'poste', etiqueta: 'Postes' },
  { valor: 'nodo_central', etiqueta: 'Nodos centrales' },
  { valor: 'caja_distribucion', etiqueta: 'Cajas de distribución' },
];

const COLOR_ESTADO = {
  activo: 'var(--green)',
  mantenimiento: 'var(--orange)',
  inactivo: 'var(--red)',
};

export default function MapaCobertura() {
  const [nodos, setNodos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [zona, setZona] = useState('todas');
  const [tipos, setTipos] = useState(new Set(TIPOS.map((t) => t.valor)));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [resNodos, resZonas] = await Promise.all([
          cliente.get('/nodos'),
          cliente.get('/catalogos/zonas'),
        ]);
        setNodos(resNodos.data);
        setZonas(resZonas.data);
      } catch {
        setError('No se pudieron cargar los nodos');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  function alternarTipo(tipo) {
    setTipos((prev) => {
      const copia = new Set(prev);
      if (copia.has(tipo)) copia.delete(tipo);
      else copia.add(tipo);
      return copia;
    });
  }

  const filtrados = useMemo(
    () =>
      nodos.filter(
        (n) => (zona === 'todas' || n.id_zona === Number(zona)) && tipos.has(n.tipo)
      ),
    [nodos, zona, tipos]
  );

  // Normaliza latitud/longitud a un plano 0–100% para dibujar los puntos
  // sin depender de una librería externa de mapas.
  const puntos = useMemo(() => {
    if (filtrados.length === 0) return [];
    const lats = filtrados.map((n) => Number(n.latitud));
    const lons = filtrados.map((n) => Number(n.longitud));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const margen = 10;

    return filtrados.map((n) => {
      const x =
        maxLon === minLon ? 50 : margen + ((Number(n.longitud) - minLon) / (maxLon - minLon)) * (100 - 2 * margen);
      // La latitud se invierte: valores mayores (norte) van arriba.
      const y =
        maxLat === minLat ? 50 : margen + ((maxLat - Number(n.latitud)) / (maxLat - minLat)) * (100 - 2 * margen);
      return { ...n, x, y };
    });
  }, [filtrados]);

  const conteoPorEstado = useMemo(() => {
    const base = { activo: 0, mantenimiento: 0, inactivo: 0 };
    filtrados.forEach((n) => {
      base[n.estado] = (base[n.estado] || 0) + 1;
    });
    return base;
  }, [filtrados]);

  return (
    <AppLayout title="Mapa de cobertura">
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>
        <Card title="Filtros">
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12.5, marginBottom: 6 }}>Zona</label>
            <select
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 11px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13.5,
              }}
            >
              <option value="todas">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z.id_zona} value={z.id_zona}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={{ fontSize: 12.5, marginBottom: 8 }}>Tipo de elemento</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TIPOS.map((t) => (
                <label key={t.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                  <input type="checkbox" checked={tipos.has(t.valor)} onChange={() => alternarTipo(t.valor)} />
                  {t.etiqueta}
                </label>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title={`Mapa de cobertura — ${zona === 'todas' ? 'todas las zonas' : zonas.find((z) => z.id_zona === Number(zona))?.nombre || ''}`}
          subtitle={cargando ? 'Cargando…' : `${filtrados.length} nodo(s) · actualizado ${new Date().toLocaleDateString('es-GT')}`}
        >
          {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#f3f5f9',
              borderRadius: 10,
              border: '1px solid var(--border)',
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            {!cargando && puntos.length === 0 && (
              <p
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}
              >
                No hay nodos que coincidan con el filtro.
              </p>
            )}
            {puntos.map((n) => (
              <div
                key={n.id_nodo}
                onClick={() => setSeleccionado(n)}
                title={n.codigo}
                style={{
                  position: 'absolute',
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: COLOR_ESTADO[n.estado] || 'var(--text-muted)',
                  border: '2px solid #fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {seleccionado && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <strong>{seleccionado.codigo}</strong> · {seleccionado.tipo.replace('_', ' ')} ·{' '}
              {seleccionado.nombre_zona || 'sin zona'} · estado: {seleccionado.estado}
              {seleccionado.observaciones ? ` — ${seleccionado.observaciones}` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)' }} />
              Activo ({conteoPorEstado.activo})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--orange)' }} />
              Mantenimiento ({conteoPorEstado.mantenimiento})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }} />
              Inactivo ({conteoPorEstado.inactivo})
            </span>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
