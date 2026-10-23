import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import { colores } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { agregarACola, enviarRegistro, nuevoIdLocal } from '../offline/cola';
import cliente from '../api/cliente';

const TIPOS_INCIDENCIA = ['Poste dañado', 'Cable cortado', 'Acceso bloqueado', 'Nodo sin señal'];

const PRIORIDADES = [
  { valor: 'baja', etiqueta: 'Baja' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'critica', etiqueta: 'Crítica' },
];

const ESTADO_ETIQUETA = {
  abierta: 'Pendiente',
  en_atencion: 'En progreso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

export default function IncidenciasScreen() {
  const [tipo, setTipo] = useState(TIPOS_INCIDENCIA[0]);
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [aviso, setAviso] = useState('');
  const { usuario } = useAuth();
  const [recientes, setRecientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargarIncidencias = useCallback(async () => {
    setError('');
    try {
      const respuesta = await cliente.get('/incidencias');
      setRecientes(respuesta.data);
    } catch (e) {
      setError('No se pudieron cargar las incidencias.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setCargando(true);
      await cargarIncidencias();
      setCargando(false);
    })();
  }, [cargarIncidencias]);

  async function registrar() {
    if (!descripcion.trim()) return;
    setEnviando(true);
    setError('');
    setAviso('');

    // El backend guarda todo en un solo campo "descripcion"; anteponemos
    // el tipo elegido para no perder esa información.
    const registro = {
      tipo: 'incidencia',
      idLocal: nuevoIdLocal(),
      creadoEn: new Date().toISOString(),
      datos: { descripcion: `${tipo}: ${descripcion.trim()}`, prioridad },
    };

    try {
      await enviarRegistro(registro);
      setDescripcion('');
      setPrioridad('media');
      await cargarIncidencias();
    } catch (e) {
      if (e.response === null) {
        // Sin señal: queda en el teléfono hasta sincronizar.
        await agregarACola({ ...registro, id_usuario: usuario.id_usuario });
        setDescripcion('');
        setPrioridad('media');
        setAviso('Sin señal: la incidencia quedó guardada en el teléfono. Envíala desde Sincronización.');
      } else {
        setError(e.response?.data?.mensaje || 'No se pudo registrar la incidencia.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <EncabezadoPantalla titulo="Incidencias" />

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Reportar incidencia</Text>
        <Text style={styles.subtituloTarjeta}>Indica qué encontraste y qué tan urgente es</Text>

        <Text style={styles.etiqueta}>Tipo de incidencia</Text>
        <View style={styles.filaChips}>
          {TIPOS_INCIDENCIA.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTipo(t)}
              style={[styles.chip, tipo === t && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, tipo === t && styles.chipTextoActivo]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiqueta}>Prioridad</Text>
        <View style={styles.filaChips}>
          {PRIORIDADES.map((p) => (
            <TouchableOpacity
              key={p.valor}
              onPress={() => setPrioridad(p.valor)}
              style={[styles.chip, prioridad === p.valor && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, prioridad === p.valor && styles.chipTextoActivo]}>{p.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiqueta}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe lo encontrado…"
          placeholderTextColor={colores.textSoft}
          multiline
          numberOfLines={4}
        />

        {aviso ? <Text style={{ color: '#17803f', fontSize: 12.8, marginTop: 10 }}>{aviso}</Text> : null}
        {error ? <Text style={{ color: colores.red, fontSize: 12.8, marginTop: 10 }}>{error}</Text> : null}

        <TouchableOpacity style={styles.boton} onPress={registrar} disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color={colores.white} />
          ) : (
            <Text style={styles.botonTexto}>+ Registrar incidencia</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Incidencias recientes</Text>
        {error ? (
          <Text style={styles.detalleLista}>{error}</Text>
        ) : cargando ? (
          <ActivityIndicator color={colores.navy} style={{ marginVertical: 14 }} />
        ) : (
          recientes.map((inc) => (
            <View key={inc.id_incidencia} style={styles.filaLista}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codigoLista}>{inc.descripcion}</Text>
                <Text style={styles.detalleLista}>
                  INC-{inc.id_incidencia} · {inc.reportado_por}
                </Text>
              </View>
              <View style={styles.insignia}>
                <Text style={styles.insigniaTexto}>{ESTADO_ETIQUETA[inc.estado] || inc.estado}</Text>
              </View>
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
    marginBottom: 16,
  },
  tituloTarjeta: { fontSize: 14.5, fontWeight: '600', color: colores.text },
  subtituloTarjeta: { fontSize: 12.3, color: colores.textMuted, marginBottom: 10 },
  etiqueta: { fontSize: 12.5, color: colores.textMuted, marginBottom: 6, marginTop: 10 },
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
  input: {
    borderWidth: 1,
    borderColor: colores.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colores.text,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  boton: {
    backgroundColor: colores.navy,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  botonTexto: { color: colores.white, fontWeight: '700', fontSize: 14 },
  filaLista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colores.border,
  },
  codigoLista: { fontSize: 13.7, fontWeight: '600', color: colores.text },
  detalleLista: { fontSize: 12.3, color: colores.textMuted, marginTop: 2 },
  insignia: { backgroundColor: colores.bg, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10 },
  insigniaTexto: { fontSize: 11.5, color: colores.text, fontWeight: '600' },
});
