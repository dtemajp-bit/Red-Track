import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { colores } from '../theme/colors';

export default function LoginScreen() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { iniciarSesion } = useAuth();

  async function manejarEnvio() {
    setError('');
    setCargando(true);
    try {
      const respuesta = await cliente.post('/auth/login', { correo, contrasena });
      await iniciarSesion(respuesta.data.token, respuesta.data.usuario);
      // La navegación cambia sola: RootNavigator observa "usuario" en el contexto
      // y muestra las pantallas privadas en cuanto hay sesión.
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || 'Error al iniciar sesión';
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tarjeta}>
        <View style={styles.marca}>
          <View style={styles.marcaIcono} />
          <Text style={styles.marcaTexto}>Red-Track</Text>
        </View>
        <Text style={styles.subtitulo}>Acceso de técnicos</Text>

        <Text style={styles.etiqueta}>Correo</Text>
        <TextInput
          style={styles.input}
          value={correo}
          onChangeText={setCorreo}
          placeholder="tecnico@redtrack.com"
          placeholderTextColor={colores.textSoft}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.etiqueta}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={contrasena}
          onChangeText={setContrasena}
          placeholder="••••••••"
          placeholderTextColor={colores.textSoft}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={manejarEnvio}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color={colores.white} />
          ) : (
            <Text style={styles.botonTexto}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.navy,
    justifyContent: 'center',
    padding: 20,
  },
  tarjeta: {
    backgroundColor: colores.navySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.navyBorder,
    padding: 26,
  },
  marca: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  marcaIcono: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colores.celeste,
    marginRight: 10,
  },
  marcaTexto: { color: colores.white, fontSize: 19, fontWeight: '700' },
  subtitulo: { color: '#b7c4d8', fontSize: 13, marginBottom: 22 },
  etiqueta: { color: '#c9d4e3', fontSize: 12.5, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0d2038',
    borderWidth: 1,
    borderColor: colores.navyBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colores.white,
    fontSize: 14.5,
  },
  error: { color: '#ff9d8a', fontSize: 13, marginTop: 14 },
  boton: {
    backgroundColor: colores.celeste,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 22,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { color: colores.white, fontWeight: '700', fontSize: 14.5 },
});
