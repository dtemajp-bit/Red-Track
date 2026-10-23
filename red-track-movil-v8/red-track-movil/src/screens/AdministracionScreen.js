import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import cliente from '../api/cliente';

export default function AdministracionScreen() {
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  const cargarTodo = useCallback(async () => {
    setError('');
    try {
      const [resUsuarios, resZonas] = await Promise.all([
        cliente.get('/usuarios'),
        cliente.get('/catalogos/zonas'),
      ]);
      setUsuarios(resUsuarios.data);
      setZonas(resZonas.data);
    } catch (e) {
      setError(
        e.response?.status === 403
          ? 'Solo los administradores pueden ver esta sección.'
          : 'No se pudo conectar con el servidor. Revisa tu conexión.'
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      await cargarTodo();
      setCargando(false);
    })();
  }, [cargarTodo]);

  async function onRefrescar() {
    setRefrescando(true);
    await cargarTodo();
    setRefrescando(false);
  }

  function tecnicosEnZona(idZona) {
    return usuarios.filter((u) => u.id_zona === idZona && u.rol === 'tecnico').length;
  }

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
    >
      <EncabezadoPantalla titulo="Administración" />

      <View style={styles.tarjeta}>
        <View style={styles.tabs}>
          {[{ id: 'usuarios', label: 'Usuarios' }, { id: 'zonas', label: 'Zonas' }].map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tab, tab === t.id && styles.tabActivo]}
            >
              <Text style={[styles.tabTexto, tab === t.id && styles.tabTextoActivo]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cargando ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 20 }} />
        ) : error ? (
          <Text style={styles.detalleLista}>{error}</Text>
        ) : tab === 'usuarios' ? (
          usuarios.map((u) => (
            <View key={u.id_usuario} style={styles.filaLista}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombreLista}>{u.nombre_completo}</Text>
                <Text style={styles.detalleLista}>{u.correo}</Text>
                <Text style={styles.detalleLista}>
                  {u.rol} · {u.zona || '—'}
                </Text>
              </View>
              <View style={styles.insignia}>
                <Text style={styles.insigniaTexto}>{u.activo ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
          ))
        ) : (
          zonas.map((z) => (
            <View key={z.id_zona} style={styles.filaLista}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombreLista}>{z.nombre}</Text>
                <Text style={styles.detalleLista}>{z.descripcion}</Text>
              </View>
              <Text style={styles.detalleLista}>{tecnicosEnZona(z.id_zona)} técnico(s)</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.bg },
  tarjeta: {
    backgroundColor: colores.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.border,
    padding: 16,
  },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  tab: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7 },
  tabActivo: { backgroundColor: colores.bg },
  tabTexto: { color: colores.textMuted, fontWeight: '600', fontSize: 13.5 },
  tabTextoActivo: { color: colores.navy },
  filaLista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colores.border,
  },
  nombreLista: { fontSize: 13.7, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12.3, color: colores.textMuted, marginTop: 2 },
  insignia: { backgroundColor: colores.bg, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  insigniaTexto: { fontSize: 11.5, color: colores.text, fontWeight: '600' },
});
