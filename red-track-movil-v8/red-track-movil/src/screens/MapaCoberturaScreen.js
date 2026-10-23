import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import cliente from '../api/cliente';

const TIPOS = [
  { valor: 'poste', etiqueta: 'Postes' },
  { valor: 'nodo_central', etiqueta: 'Nodos centrales' },
  { valor: 'caja_distribucion', etiqueta: 'Cajas' },
];

const COLOR_ESTADO = {
  activo: '#17a35a',
  mantenimiento: colores.orange,
  inactivo: colores.red,
};

export default function MapaCoberturaScreen() {
  const [nodos, setNodos] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [zona, setZona] = useState('todas');
  const [tipos, setTipos] = useState(new Set(TIPOS.map((t) => t.valor)));
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [resNodos, resZonas] = await Promise.all([cliente.get('/nodos'), cliente.get('/catalogos/zonas')]);
      setNodos(resNodos.data);
      setZonas(resZonas.data);
    } catch {
      setError('No se pudieron cargar los nodos. Revisa tu conexión.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      await cargar();
      setCargando(false);
    })();
  }, [cargar]);

  async function onRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  function alternarTipo(tipo) {
    setTipos((prev) => {
      const copia = new Set(prev);
      if (copia.has(tipo)) copia.delete(tipo);
      else copia.add(tipo);
      return copia;
    });
  }

  const filtrados = useMemo(
    () => nodos.filter((n) => (zona === 'todas' || n.id_zona === zona) && tipos.has(n.tipo)),
    [nodos, zona, tipos]
  );

  // Normaliza latitud/longitud a un plano 0–100% para dibujar los puntos
  // sin depender de una librería externa de mapas (igual que la versión web).
  const puntos = useMemo(() => {
    if (filtrados.length === 0) return [];
    const lats = filtrados.map((n) => Number(n.latitud));
    const lons = filtrados.map((n) => Number(n.longitud));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const margen = 8;

    return filtrados.map((n) => {
      const x = maxLon === minLon ? 50 : margen + ((Number(n.longitud) - minLon) / (maxLon - minLon)) * (100 - 2 * margen);
      const y = maxLat === minLat ? 50 : margen + ((maxLat - Number(n.latitud)) / (maxLat - minLat)) * (100 - 2 * margen);
      return { ...n, x, y };
    });
  }, [filtrados]);

  const conteo = useMemo(() => {
    const base = { activo: 0, mantenimiento: 0, inactivo: 0 };
    filtrados.forEach((n) => {
      base[n.estado] = (base[n.estado] || 0) + 1;
    });
    return base;
  }, [filtrados]);

  const nombreZona = zona === 'todas' ? 'Todas las zonas' : zonas.find((z) => z.id_zona === zona)?.nombre || '';

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
    >
      <EncabezadoPantalla titulo="Mapa de cobertura" />

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Zona</Text>
        <View style={styles.filaChips}>
          {[{ id_zona: 'todas', nombre: 'Todas las zonas' }, ...zonas].map((z) => (
            <TouchableOpacity
              key={z.id_zona}
              onPress={() => {
                setZona(z.id_zona);
                setSeleccionado(null);
              }}
              style={[styles.chip, zona === z.id_zona && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, zona === z.id_zona && styles.chipTextoActivo]}>{z.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.etiqueta, { marginTop: 14 }]}>Tipo de elemento</Text>
        <View style={styles.filaChips}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t.valor}
              onPress={() => alternarTipo(t.valor)}
              style={[styles.chip, tipos.has(t.valor) && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, tipos.has(t.valor) && styles.chipTextoActivo]}>{t.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Mapa de cobertura — {nombreZona}</Text>
        <Text style={styles.subtituloTarjeta}>
          {filtrados.length} elemento(s) · actualizado {new Date().toLocaleDateString('es-GT')}
        </Text>

        {cargando ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 30 }} />
        ) : error ? (
          <Text style={styles.textoError}>{error}</Text>
        ) : filtrados.length === 0 ? (
          <Text style={styles.leyendaTexto}>No hay elementos registrados con estos filtros.</Text>
        ) : (
          <View style={styles.lienzo}>
            {puntos.map((p) => (
              <TouchableOpacity
                key={p.id_nodo}
                onPress={() => setSeleccionado(p)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[
                  styles.punto,
                  {
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    backgroundColor: COLOR_ESTADO[p.estado] || colores.textSoft,
                    borderColor: seleccionado?.id_nodo === p.id_nodo ? colores.navy : colores.white,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {seleccionado ? (
          <View style={styles.detallePunto}>
            <Text style={styles.codigoDetalle}>{seleccionado.codigo}</Text>
            <Text style={styles.leyendaTexto}>
              {String(seleccionado.tipo).replace('_', ' ')} · {seleccionado.estado} · {seleccionado.nombre_zona || 'Sin zona'}
            </Text>
            <Text style={styles.leyendaTexto}>
              {Number(seleccionado.latitud).toFixed(5)}, {Number(seleccionado.longitud).toFixed(5)}
            </Text>
          </View>
        ) : null}

        <View style={styles.leyendaFila}>
          {[
            ['activo', 'Activo'],
            ['mantenimiento', 'Mantenimiento'],
            ['inactivo', 'Inactivo'],
          ].map(([clave, etiqueta]) => (
            <View key={clave} style={styles.leyendaItem}>
              <View style={[styles.leyendaPunto, { backgroundColor: COLOR_ESTADO[clave] }]} />
              <Text style={styles.leyendaTexto}>
                {etiqueta} ({conteo[clave] || 0})
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lienzo: {
    height: 260,
    borderRadius: 10,
    backgroundColor: '#eef3f8',
    borderWidth: 1,
    borderColor: colores.border,
    marginBottom: 12,
    position: 'relative',
  },
  punto: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    borderWidth: 2,
  },
  detallePunto: {
    backgroundColor: colores.bg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  codigoDetalle: { fontSize: 14, fontWeight: '700', color: colores.text, marginBottom: 2 },
  textoError: { color: colores.red, fontSize: 12.5 },
  contenedor: { flex: 1, backgroundColor: colores.bg },
  tarjeta: {
    backgroundColor: colores.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.border,
    padding: 16,
    marginBottom: 16,
  },
  etiqueta: { fontSize: 12.5, color: colores.textMuted, marginBottom: 8 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colores.border,
    backgroundColor: colores.white,
  },
  chipActivo: { backgroundColor: colores.navy, borderColor: colores.navy },
  chipTexto: { fontSize: 12.7, color: colores.text, fontWeight: '500' },
  chipTextoActivo: { color: colores.white },
  tituloTarjeta: { fontSize: 14.5, fontWeight: '600', color: colores.text },
  subtituloTarjeta: { fontSize: 12.3, color: colores.textMuted, marginBottom: 12 },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  celda: { width: '11%', aspectRatio: 1, borderRadius: 5 },
  leyendaFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 10, height: 10, borderRadius: 3 },
  leyendaTexto: { fontSize: 12, color: colores.textMuted },
});
