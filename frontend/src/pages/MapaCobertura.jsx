import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import cliente from '../api/cliente';

const TIPOS = [
  { valor: 'poste', etiqueta: 'Postes' },
  { valor: 'nodo_central', etiqueta: 'Nodos centrales' },
  { valor: 'caja_distribucion', etiqueta: 'Cajas de distribución' },
];

// Colores sólidos (no variables CSS) porque Mapbox dibuja los marcadores
// en su propio lienzo y no hereda las variables de la página.
const COLOR_ESTADO = {
  activo: '#17a35a',
  mantenimiento: '#e08a1e',
  inactivo: '#d23b3b',
};

// Token público de Mapbox. Se define en Vercel o en un archivo .env como
// VITE_MAPBOX_TOKEN=pk.xxxxx. Si no existe, se usa la vista de respaldo.
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
// Centro por defecto: Ciudad de Guatemala, por si no hay nodos todavía.
const CENTRO_POR_DEFECTO = [-90.5133, 14.6407];

function etiquetaTipo(v) {
  return TIPOS.find((t) => t.valor === v)?.etiqueta?.replace(/s$/, '') || String(v).replace('_', ' ');
}

export default function MapaCobertura() {
  const [nodos, setNodos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [zona, setZona] = useState('todas');
  const [tipos, setTipos] = useState(new Set(TIPOS.map((t) => t.valor)));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);

  const contenedorMapa = useRef(null);
  const mapa = useRef(null);
  const marcadores = useRef([]);
  const [mapaListo, setMapaListo] = useState(false);

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
        (n) =>
          (zona === 'todas' || n.id_zona === Number(zona)) &&
          tipos.has(n.tipo) &&
          Math.abs(Number(n.latitud)) <= 90 &&
          Math.abs(Number(n.longitud)) <= 180
      ),
    [nodos, zona, tipos]
  );

  const conteoPorEstado = useMemo(() => {
    const base = { activo: 0, mantenimiento: 0, inactivo: 0 };
    filtrados.forEach((n) => {
      base[n.estado] = (base[n.estado] || 0) + 1;
    });
    return base;
  }, [filtrados]);

  // ---- Inicializa el mapa de Mapbox una sola vez ----
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapa.current || !contenedorMapa.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapa.current = new mapboxgl.Map({
      container: contenedorMapa.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: CENTRO_POR_DEFECTO,
      zoom: 11,
    });
    mapa.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapa.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    mapa.current.on('load', () => setMapaListo(true));

    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // ---- Vuelve a pintar los marcadores cuando cambian los nodos filtrados ----
  useEffect(() => {
    if (!mapa.current || !mapaListo) return;

    marcadores.current.forEach((m) => m.remove());
    marcadores.current = [];

    if (filtrados.length === 0) return;

    const limites = new mapboxgl.LngLatBounds();

    filtrados.forEach((n) => {
      const lng = Number(n.longitud);
      const lat = Number(n.latitud);

      const el = document.createElement('div');
      el.style.cssText = [
        'width:16px',
        'height:16px',
        'border-radius:50%',
        'border:2px solid #fff',
        'box-shadow:0 1px 4px rgba(0,0,0,0.35)',
        'cursor:pointer',
        `background:${COLOR_ESTADO[n.estado] || '#8a93a6'}`,
      ].join(';');
      el.title = n.codigo;

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-size:12.5px;line-height:1.5">
           <strong>${escaparHtml(n.codigo)}</strong><br/>
           ${escaparHtml(etiquetaTipo(n.tipo))} \u00b7 ${escaparHtml(n.estado)}<br/>
           <span style="color:#6b7280">${escaparHtml(n.nombre_zona || 'Sin zona')}</span>
         </div>`
      );

      const marcador = new mapboxgl.Marker(el).setLngLat([lng, lat]).setPopup(popup).addTo(mapa.current);
      el.addEventListener('click', () => setSeleccionado(n));
      marcadores.current.push(marcador);
      limites.extend([lng, lat]);
    });

    if (filtrados.length === 1) {
      mapa.current.easeTo({ center: limites.getCenter(), zoom: 15, duration: 600 });
    } else {
      mapa.current.fitBounds(limites, { padding: 60, maxZoom: 15, duration: 600 });
    }
  }, [filtrados, mapaListo]);

  const tituloMapa = `Mapa de cobertura \u2014 ${
    zona === 'todas' ? 'todas las zonas' : zonas.find((z) => z.id_zona === Number(zona))?.nombre || ''
  }`;
  const subtituloMapa = cargando
    ? 'Cargando\u2026'
    : `${filtrados.length} nodo(s) \u00b7 actualizado ${new Date().toLocaleDateString('es-GT')}`;

  return (
    <AppLayout title="Mapa de cobertura">
      <div className="rt-mapa-grid">
        <Card title="Filtros" style={{ order: 0 }} className="rt-mapa-filtros">
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

        <Card title={tituloMapa} subtitle={subtituloMapa}>
          {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}

          {MAPBOX_TOKEN ? (
            <div
              ref={contenedorMapa}
              className="rt-mapa-lienzo"
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid var(--border)',
                marginBottom: 16,
                overflow: 'hidden',
              }}
            />
          ) : (
            <VistaRespaldo cargando={cargando} filtrados={filtrados} onSeleccionar={setSeleccionado} />
          )}

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
              {seleccionado.observaciones ? ` \u2014 ${seleccionado.observaciones}` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_ESTADO.activo }} />
              Activo ({conteoPorEstado.activo})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_ESTADO.mantenimiento }} />
              Mantenimiento ({conteoPorEstado.mantenimiento})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_ESTADO.inactivo }} />
              Inactivo ({conteoPorEstado.inactivo})
            </span>
          </div>

          {!MAPBOX_TOKEN && (
            <p style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 10 }}>
              Vista simplificada. Configura VITE_MAPBOX_TOKEN para ver el mapa real de Mapbox.
            </p>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

// Escapa texto antes de insertarlo en el HTML del popup (evita inyección).
function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Vista de respaldo (plano normalizado) cuando no hay token de Mapbox.
function VistaRespaldo({ cargando, filtrados, onSeleccionar }) {
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
      const y =
        maxLat === minLat ? 50 : margen + ((maxLat - Number(n.latitud)) / (maxLat - minLat)) * (100 - 2 * margen);
      return { ...n, x, y };
    });
  }, [filtrados]);

  return (
    <div
      className="rt-mapa-lienzo"
      style={{
        position: 'relative',
        width: '100%',
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
          onClick={() => onSeleccionar(n)}
          title={n.codigo}
          style={{
            position: 'absolute',
            left: `${n.x}%`,
            top: `${n.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: COLOR_ESTADO[n.estado] || '#8a93a6',
            border: '2px solid #fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}
