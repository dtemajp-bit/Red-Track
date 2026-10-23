import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import cliente, { ORIGEN_ARCHIVOS } from '../api/cliente';
import { colores } from '../theme/colors';

const ANCHO_MENU = Math.min(280, Dimensions.get('window').width * 0.78);

// Mismas 7 secciones que el sidebar del frontend web (ver AppLayout.jsx).
const NAV_ITEMS = [
  { to: 'PanelTecnico', label: 'Panel del técnico', icono: '🏠' },
  { to: 'RegistrarInfraestructura', label: 'Registrar infraestructura', icono: '📍' },
  { to: 'MapaCobertura', label: 'Mapa de cobertura', icono: '🗺' },
  { to: 'Sincronizacion', label: 'Sincronización', icono: '🔄' },
  { to: 'Incidencias', label: 'Incidencias', icono: '⚠️' },
  { to: 'Administracion', label: 'Administración', icono: '👥', soloAdmin: true },
  { to: 'Reportes', label: 'Reportes', icono: '📊' },
];

function iniciales(nombre) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return (partes[0]?.[0] || '') + (partes[1]?.[0] || '');
}

export default function MenuLateral() {
  const { usuario, cerrarSesion, actualizarUsuario } = useAuth();
  const { pantallaActual, navegar, menuVisible, cerrarMenu } = useNav();
  const [subiendo, setSubiendo] = useState(false);
  const desplazamiento = useRef(new Animated.Value(-ANCHO_MENU)).current;

  useEffect(() => {
    Animated.timing(desplazamiento, {
      toValue: menuVisible ? 0 : -ANCHO_MENU,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuVisible, desplazamiento]);

  async function cambiarFotoPerfil() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para continuar.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (resultado.canceled) return;

    const foto = resultado.assets[0];
    const datos = new FormData();
    datos.append('foto', {
      uri: foto.uri,
      name: foto.fileName || 'perfil.jpg',
      type: foto.mimeType || 'image/jpeg',
    });

    setSubiendo(true);
    try {
      const { data } = await cliente.put('/usuarios/perfil/foto', datos);
      actualizarUsuario({ foto_perfil: data.foto_perfil });
    } catch {
      Alert.alert('Error', 'No se pudo actualizar tu foto de perfil.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      {menuVisible && <TouchableOpacity style={styles.fondo} activeOpacity={1} onPress={cerrarMenu} />}
      <Animated.View style={[styles.contenedor, { transform: [{ translateX: desplazamiento }] }]}>
        <View style={styles.logoFila}>
          <View style={styles.logoCaja}>
            <Text style={styles.logoIcono}>🗺</Text>
          </View>
          <Text style={styles.logoTexto}>RED-TRACK</Text>
        </View>

        {usuario ? (
          <TouchableOpacity style={styles.perfilFila} onPress={cambiarFotoPerfil} disabled={subiendo}>
            <View style={styles.avatar}>
              {subiendo ? (
                <ActivityIndicator size="small" color={colores.white} />
              ) : usuario.foto_perfil ? (
                <Image source={{ uri: `${ORIGEN_ARCHIVOS}${usuario.foto_perfil}` }} style={styles.avatarImagen} />
              ) : (
                <Text style={styles.avatarIniciales}>{iniciales(usuario.nombre_completo).toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usuarioTexto} numberOfLines={1}>
                {usuario.nombre_completo}
              </Text>
              <Text style={styles.cambiarFotoTexto}>Cambiar foto</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.nav}>
          {NAV_ITEMS.filter((i) => !i.soloAdmin || usuario?.rol === 'administrador').map((item) => {
            const activo = pantallaActual === item.to;
            return (
              <TouchableOpacity
                key={item.to}
                onPress={() => navegar(item.to)}
                style={[styles.itemNav, activo && styles.itemNavActivo]}
              >
                <Text style={styles.itemNavIcono}>{item.icono}</Text>
                <Text style={[styles.itemNavTexto, activo && styles.itemNavTextoActivo]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.pie}>
          <TouchableOpacity onPress={cerrarSesion} style={styles.botonSalir}>
            <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 5,
  },
  contenedor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: ANCHO_MENU,
    backgroundColor: colores.navy,
    zIndex: 10,
    paddingTop: 40,
    justifyContent: 'space-between',
  },
  logoFila: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 18, paddingBottom: 10 },
  logoCaja: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colores.celeste,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcono: { fontSize: 13 },
  logoTexto: { color: colores.white, fontWeight: '700', fontSize: 15.5, letterSpacing: 0.3 },
  perfilFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colores.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImagen: { width: '100%', height: '100%' },
  avatarIniciales: { color: colores.white, fontWeight: '700', fontSize: 13 },
  usuarioTexto: { color: colores.white, fontSize: 13, fontWeight: '600' },
  cambiarFotoTexto: { color: colores.textSoft, fontSize: 11, marginTop: 1 },
  nav: { paddingHorizontal: 10, gap: 2, flex: 1 },
  itemNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  itemNavIcono: { fontSize: 15, width: 18, textAlign: 'center' },
  itemNavActivo: { backgroundColor: colores.navySoft, borderLeftColor: colores.celeste },
  itemNavTexto: { color: '#aeb9cc', fontSize: 13.7, fontWeight: '500' },
  itemNavTextoActivo: { color: colores.white },
  pie: { padding: 10, borderTopWidth: 1, borderTopColor: colores.navyBorder },
  botonSalir: { paddingVertical: 11, paddingHorizontal: 12 },
  botonSalirTexto: { color: '#aeb9cc', fontSize: 13.7, fontWeight: '500' },
});
