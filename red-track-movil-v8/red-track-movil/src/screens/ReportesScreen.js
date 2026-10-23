import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import cliente from '../api/cliente';

// Mismos tres reportes que la versión web (ver Reportes.jsx).
const REPORTES = [
  {
    id: 'desempeno-por-tecnico',
    etiqueta: 'Desempeño por técnico',
    columnas: [
      { clave: 'rutas', titulo: 'Rutas asignadas' },
      { clave: 'rutas_completadas', titulo: 'Completadas' },
      { clave: 'puntos_visitados', titulo: 'Puntos visitados', formato: (f) => `${f.puntos_visitados}/${f.puntos}` },
      { clave: 'cumplimiento', titulo: '% cumplimiento', formato: (f) => `${f.cumplimiento ?? 0}%` },
      { clave: 'nodos_registrados', titulo: 'Infraestructura registrada' },
      { clave: 'incidencias', titulo: 'Incidencias' },
    ],
    titulo: 'tecnico',
  },
  {
    id: 'infraestructura-por-zona',
    etiqueta: 'Infraestructura por zona',
    columnas: [
      { clave: 'total', titulo: 'Total nodos' },
      { clave: 'activos', titulo: 'Activos' },
      { clave: 'en_mantenimiento', titulo: 'Mantenimiento' },
      { clave: 'inactivos', titulo: 'Inactivos' },
    ],
    titulo: 'zona',
  },
  {
    id: 'incidencias-por-zona',
    etiqueta: 'Incidencias por zona',
    columnas: [
      { clave: 'total', titulo: 'Total' },
      { clave: 'abiertas', titulo: 'Abiertas' },
      { clave: 'en_atencion', titulo: 'En atención' },
      { clave: 'resueltas', titulo: 'Resueltas' },
    ],
    titulo: 'zona',
  },
];

export default function ReportesScreen() {
  const [reporteId, setReporteId] = useState(REPORTES[0].id);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  const reporte = REPORTES.find((r) => r.id === reporteId);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const respuesta = await cliente.get(`/reportes/${reporteId}`);
      setFilas(respuesta.data);
    } catch {
      setFilas([]);
      setError('No se pudo cargar el reporte. Revisa tu conexión.');
    }
  }, [reporteId]);

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

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
    >
      <EncabezadoPantalla titulo="Reportes" />

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Tipo de reporte</Text>
        <View style={styles.filaChips}>
          {REPORTES.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setReporteId(r.id)}
              style={[styles.chip, reporteId === r.id && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, reporteId === r.id && styles.chipTextoActivo]}>{r.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>{reporte.etiqueta}</Text>
        {cargando ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 14 }} />
        ) : error ? (
          <Text style={styles.textoError}>{error}</Text>
        ) : filas.length === 0 ? (
          <Text style={styles.detalleLista}>Aún no hay datos para este reporte.</Text>
        ) : (
          filas.map((f) => (
            <View key={f[reporte.titulo]} style={styles.filaLista}>
              <Text style={styles.codigoLista}>{f[reporte.titulo]}</Text>
              <View style={styles.rejilla}>
                {reporte.columnas.map((c) => (
                  <View key={c.clave} style={styles.celdaDato}>
                    <Text style={styles.valorDato}>{c.formato ? c.formato(f) : f[c.clave] ?? 0}</Text>
                    <Text style={styles.detalleLista}>{c.titulo}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  codigoLista: { fontSize: 13.7, fontWeight: '600', color: colores.text },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  celdaDato: { width: '50%', paddingVertical: 4 },
  valorDato: { fontSize: 17, fontWeight: '700', color: colores.navy },
  textoError: { color: colores.red, fontSize: 12.5, marginTop: 8 },
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
  tituloTarjeta: { fontSize: 14.5, fontWeight: '600', color: colores.text, marginBottom: 10 },
  filaLista: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colores.border },
  nombreLista: { fontSize: 13.7, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12.3, color: colores.textMuted, marginTop: 2 },
});
