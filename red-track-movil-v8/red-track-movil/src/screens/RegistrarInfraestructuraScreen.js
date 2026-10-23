import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import cliente, { ORIGEN_ARCHIVOS } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { agregarACola, enviarRegistro, nuevoIdLocal } from '../offline/cola';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';

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

const VACIO = { codigo: '', tipo: 'poste', latitud: '', longitud: '', estado: 'activo', observaciones: '' };

export default function RegistrarInfraestructuraScreen() {
  const [nodos, setNodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(VACIO);
  const [foto, setFoto] = useState(null);
  const [aviso, setAviso] = useState('');
  const { usuario } = useAuth();

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso para continuar.');
      return;
    }

    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (!resultado.canceled) {
      setFoto(resultado.assets[0]);
    }
  }

  const cargarNodos = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await cliente.get('/nodos');
      setNodos(respuesta.data);
    } catch {
      setError('No se pudieron cargar los registros existentes');
    } finally {
      setCargando(false);
    }
  }, []);

  const capturarUbicacion = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const posicion = await Location.getCurrentPositionAsync({});
      setForm((f) => ({
        ...f,
        latitud: posicion.coords.latitude.toFixed(7),
        longitud: posicion.coords.longitude.toFixed(7),
      }));
    } catch {
      // Señal GPS no disponible: el técnico puede ingresar las coordenadas manualmente.
    }
  }, []);

  useEffect(() => {
    cargarNodos();
    capturarUbicacion();
  }, [cargarNodos, capturarUbicacion]);

  async function manejarGuardar() {
    setError('');
    setAviso('');
    setGuardando(true);

    const registro = {
      tipo: 'nodo',
      idLocal: nuevoIdLocal(),
      creadoEn: new Date().toISOString(),
      datos: {
        codigo: form.codigo,
        tipo: form.tipo,
        latitud: form.latitud,
        longitud: form.longitud,
        estado: form.estado,
        observaciones: form.observaciones,
      },
      foto: foto
        ? { uri: foto.uri, name: foto.fileName || 'foto.jpg', type: foto.mimeType || 'image/jpeg' }
        : null,
    };

    try {
      await enviarRegistro(registro);
      setForm(VACIO);
      setFoto(null);
      capturarUbicacion();
      cargarNodos();
    } catch (err) {
      if (err.response === null) {
        // Sin señal: se guarda en el teléfono para enviarlo después desde Sincronización.
        if (!form.codigo.trim() || !form.latitud || !form.longitud) {
          setError('Completa el código y la ubicación antes de guardar.');
        } else {
          await agregarACola({ ...registro, id_usuario: usuario.id_usuario });
          setForm(VACIO);
          setFoto(null);
          capturarUbicacion();
          setAviso('Sin señal: el registro quedó guardado en el teléfono. Envíalo desde Sincronización.');
        }
      } else {
        setError(err.response?.data?.mensaje || 'Error al guardar el registro');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <EncabezadoPantalla titulo="Registrar infraestructura" />

      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Antes de continuar, verifica los riesgos eléctricos del punto y utiliza tu equipo de
          protección personal.
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Tipo de elemento</Text>
        <View style={styles.filaChips}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t.valor}
              onPress={() => setForm({ ...form, tipo: t.valor })}
              style={[styles.chip, form.tipo === t.valor && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, form.tipo === t.valor && styles.chipTextoActivo]}>
                {t.etiqueta}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiqueta}>Código</Text>
        <TextInput
          style={styles.input}
          value={form.codigo}
          onChangeText={(v) => setForm({ ...form, codigo: v })}
          placeholder="PT-0234"
          placeholderTextColor={colores.textSoft}
        />

        <View style={styles.fila2}>
          <View style={styles.mitad}>
            <Text style={styles.etiqueta}>Latitud</Text>
            <TextInput
              style={styles.input}
              value={form.latitud}
              onChangeText={(v) => setForm({ ...form, latitud: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.mitad}>
            <Text style={styles.etiqueta}>Longitud</Text>
            <TextInput
              style={styles.input}
              value={form.longitud}
              onChangeText={(v) => setForm({ ...form, longitud: v })}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.etiqueta}>Estado</Text>
        <View style={styles.filaChips}>
          {ESTADOS.map((e) => (
            <TouchableOpacity
              key={e.valor}
              onPress={() => setForm({ ...form, estado: e.valor })}
              style={[styles.chip, form.estado === e.valor && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, form.estado === e.valor && styles.chipTextoActivo]}>
                {e.etiqueta}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiqueta}>Fotografía</Text>
        {foto ? (
          <TouchableOpacity onPress={() => elegirFoto('camara')} style={styles.previewContenedor}>
            <Image source={{ uri: foto.uri }} style={styles.preview} />
          </TouchableOpacity>
        ) : (
          <View style={styles.filaFoto}>
            <TouchableOpacity style={styles.botonFoto} onPress={() => elegirFoto('camara')}>
              <Text style={styles.botonFotoTexto}>📷 Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonFoto} onPress={() => elegirFoto('galeria')}>
              <Text style={styles.botonFotoTexto}>🖼 Elegir de galería</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.etiqueta}>Observaciones</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={form.observaciones}
          onChangeText={(v) => setForm({ ...form, observaciones: v })}
          placeholder="Notas adicionales del técnico…"
          placeholderTextColor={colores.textSoft}
          multiline
          numberOfLines={3}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {aviso ? <Text style={styles.aviso2}>{aviso}</Text> : null}

        <TouchableOpacity
          style={[styles.boton, guardando && styles.botonDeshabilitado]}
          onPress={manejarGuardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color={colores.white} />
          ) : (
            <Text style={styles.botonTexto}>✓ Guardar registro</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloLista}>
          Infraestructura registrada · {nodos.length} elementos
        </Text>
        {cargando ? (
          <Text style={styles.textoMuted}>Cargando…</Text>
        ) : nodos.length === 0 ? (
          <Text style={styles.textoMuted}>Aún no hay registros.</Text>
        ) : (
          <FlatList
            data={nodos}
            keyExtractor={(item) => String(item.id_nodo)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.filaLista}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {item.foto_url ? (
                    <Image
                      source={{ uri: `${ORIGEN_ARCHIVOS}${item.foto_url}` }}
                      style={styles.miniatura}
                    />
                  ) : null}
                  <View>
                    <Text style={styles.codigoLista}>{item.codigo}</Text>
                    <Text style={styles.detalleLista}>
                      {item.tipo} · {item.nombre_zona || 'Sin zona'}
                    </Text>
                  </View>
                </View>
                <View style={styles.insignia}>
                  <Text style={styles.insigniaTexto}>{item.estado}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  aviso2: { color: '#17803f', fontSize: 12.8, marginBottom: 10 },
  contenedor: { flex: 1, backgroundColor: colores.bg },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titulo: { fontSize: 19, fontWeight: '700', color: colores.text },
  salir: { color: colores.red, fontSize: 13.5, fontWeight: '600' },
  aviso: {
    backgroundColor: colores.orangeBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  avisoTexto: { color: colores.orange, fontSize: 13 },
  tarjeta: {
    backgroundColor: colores.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.border,
    padding: 16,
    marginBottom: 16,
  },
  etiqueta: { fontSize: 12.5, color: colores.textMuted, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colores.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colores.text,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  filaFoto: { flexDirection: 'row', gap: 10 },
  botonFoto: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colores.border,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonFotoTexto: { fontSize: 12.5, color: colores.textMuted, fontWeight: '500' },
  previewContenedor: { borderRadius: 8, overflow: 'hidden' },
  preview: { width: '100%', height: 160, borderRadius: 8 },
  miniatura: { width: 34, height: 34, borderRadius: 6 },
  fila2: { flexDirection: 'row', gap: 10 },
  mitad: { flex: 1 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colores.border,
    backgroundColor: colores.white,
  },
  chipActivo: { backgroundColor: colores.navy, borderColor: colores.navy },
  chipTexto: { fontSize: 13, color: colores.text, fontWeight: '500' },
  chipTextoActivo: { color: colores.white },
  error: { color: colores.red, fontSize: 13, marginTop: 12 },
  boton: {
    backgroundColor: colores.navy,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { color: colores.white, fontWeight: '700', fontSize: 14 },
  tituloLista: { fontSize: 14.5, fontWeight: '600', color: colores.text, marginBottom: 10 },
  textoMuted: { color: colores.textMuted, fontSize: 13.5 },
  filaLista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colores.border,
  },
  codigoLista: { fontSize: 13.5, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12, color: colores.textMuted, marginTop: 2 },
  insignia: {
    backgroundColor: colores.bg,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  insigniaTexto: { fontSize: 11.5, color: colores.text, fontWeight: '600' },
});
