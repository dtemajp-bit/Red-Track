import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import cliente from '../api/cliente';

const ETIQUETA_TIPO = {
  poste: 'Poste',
  nodo_central: 'Nodo central',
  caja_distribucion: 'Caja de distribución',
};

function GrupoPuntos({ titulo, color, puntos, abiertoInicial, onAlternar, idSiguiente }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  if (puntos.length === 0) return null;

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={styles.filaGrupo} onPress={() => setAbierto((a) => !a)}>
        <Text style={styles.flecha}>{abierto ? '▾' : '▸'}</Text>
        <View style={[styles.puntoEstado, { backgroundColor: color }]} />
        <Text style={styles.tituloGrupo}>
          {titulo} ({puntos.length})
        </Text>
      </TouchableOpacity>

      {abierto
        ? puntos.map((p) => (
            <TouchableOpacity
              key={p.id_ruta_nodo}
              onPress={() => onAlternar(p)}
              style={[styles.filaPunto, { borderLeftColor: color }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.codigoLista}>
                  {p.codigo}
                  {p.id_ruta_nodo === idSiguiente ? '  · siguiente' : ''}
                </Text>
                <Text style={styles.detalleLista}>
                  {ETIQUETA_TIPO[p.tipo] || p.tipo} · {p.zona || 'Sin zona'}
                </Text>
              </View>
              <Text style={styles.casilla}>{p.visitado ? '☑' : '☐'}</Text>
            </TouchableOpacity>
          ))
        : null}
    </View>
  );
}

export default function PanelTecnicoScreen() {
  const [ruta, setRuta] = useState(undefined); // undefined = cargando, null = sin ruta
  const [cobertura, setCobertura] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const respuesta = await cliente.get('/rutas/mia');
      setRuta(respuesta.data);
    } catch {
      setError('No se pudo cargar tu ruta. Revisa tu conexión.');
      setRuta((actual) => (actual === undefined ? null : actual));
    }
    try {
      const respuesta = await cliente.get('/reportes/infraestructura-por-zona');
      setCobertura(respuesta.data);
    } catch {
      setCobertura((actual) => actual || []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function alternarVisitado(punto) {
    setError('');
    try {
      const respuesta = await cliente.put(`/rutas/puntos/${punto.id_ruta_nodo}`, { visitado: !punto.visitado });
      setRuta((prev) => ({
        ...prev,
        estado: respuesta.data.estado_ruta,
        puntos: prev.puntos.map((p) =>
          p.id_ruta_nodo === punto.id_ruta_nodo ? { ...p, visitado: !p.visitado } : p
        ),
      }));
    } catch (e) {
      setError(e.response?.data?.mensaje || 'No se pudo actualizar el punto. Revisa tu conexión.');
    }
  }

  const pendientes = ruta ? ruta.puntos.filter((p) => !p.visitado) : [];
  const completados = ruta ? ruta.puntos.filter((p) => p.visitado) : [];
  const idSiguiente = pendientes.length > 0 ? pendientes[0].id_ruta_nodo : null;

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
    >
      <EncabezadoPantalla titulo="Panel del técnico" />

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>{ruta ? `Ruta de hoy — ${ruta.nombre}` : 'Ruta de hoy'}</Text>
        <Text style={styles.subtituloTarjeta}>
          {ruta === undefined
            ? 'Cargando…'
            : ruta
            ? `RT-${ruta.id_ruta} · ${completados.length}/${ruta.puntos.length} puntos visitados`
            : 'No tienes una ruta asignada por ahora'}
        </Text>

        {ruta === undefined ? <ActivityIndicator color={colores.navy} style={{ marginVertical: 14 }} /> : null}
        {error ? <Text style={styles.textoError}>{error}</Text> : null}
        {ruta && ruta.estado === 'completada' ? (
          <Text style={styles.textoOk}>✓ Ruta completada. ¡Buen trabajo!</Text>
        ) : null}

        {ruta ? (
          <>
            <GrupoPuntos
              titulo="Pendiente"
              color={colores.orange}
              puntos={pendientes}
              abiertoInicial
              onAlternar={alternarVisitado}
              idSiguiente={idSiguiente}
            />
            <GrupoPuntos
              titulo="Completada"
              color={colores.textSoft}
              puntos={completados}
              abiertoInicial={pendientes.length === 0}
              onAlternar={alternarVisitado}
              idSiguiente={idSiguiente}
            />
            <Text style={styles.ayuda}>Toca un punto para marcarlo como visitado.</Text>
          </>
        ) : null}
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Cobertura de la zona</Text>
        <Text style={styles.subtituloTarjeta}>Infraestructura registrada por zona</Text>
        {cobertura === null ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 10 }} />
        ) : cobertura.length === 0 ? (
          <Text style={styles.detalleLista}>Aún no hay infraestructura registrada.</Text>
        ) : (
          cobertura.map((z) => {
            const total = Number(z.total) || 0;
            const activos = Number(z.activos) || 0;
            const proporcion = total > 0 ? activos / total : 0;
            return (
              <View key={z.zona} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.codigoLista}>{z.zona}</Text>
                  <Text style={styles.detalleLista}>
                    {activos} activos de {total}
                  </Text>
                </View>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraRelleno, { width: `${Math.round(proporcion * 100)}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  casilla: { fontSize: 20, color: colores.navy, marginLeft: 8 },
  textoError: { color: colores.red, fontSize: 12.5, marginBottom: 8 },
  textoOk: { color: '#17a35a', fontSize: 13.5, fontWeight: '600', marginBottom: 8 },
  ayuda: { fontSize: 11.8, color: colores.textSoft, marginTop: 10 },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: '#e7eaf0', marginTop: 5, overflow: 'hidden' },
  barraRelleno: { height: 8, borderRadius: 4, backgroundColor: colores.celeste },
  contenedor: { flex: 1, backgroundColor: colores.bg },
  tarjeta: {
    backgroundColor: colores.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.border,
    padding: 16,
    marginBottom: 16,
  },
  tituloTarjeta: { fontSize: 14.5, fontWeight: '600', color: colores.text },
  subtituloTarjeta: { fontSize: 12.3, color: colores.textMuted, marginBottom: 10 },
  filaGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colores.border,
  },
  flecha: { fontSize: 12, color: colores.textMuted, width: 12 },
  puntoEstado: { width: 9, height: 9, borderRadius: 3 },
  tituloGrupo: { fontSize: 13.7, fontWeight: '700', color: colores.text },
  filaPunto: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingLeft: 14,
    marginLeft: 6,
    borderLeftWidth: 2,
  },
  codigoLista: { fontSize: 13.3, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12, color: colores.textMuted, marginTop: 1 },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 14 },
  celda: { width: '11%', aspectRatio: 1, borderRadius: 5 },
  leyendaFila: { flexDirection: 'row', gap: 16 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 10, height: 10, borderRadius: 3 },
  leyendaTexto: { fontSize: 12, color: colores.textMuted },
});
