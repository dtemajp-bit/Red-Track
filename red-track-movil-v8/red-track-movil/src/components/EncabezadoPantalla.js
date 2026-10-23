import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import { colores } from '../theme/colors';

// Encabezado usado en todas las pantallas privadas: botón de menú (☰) para
// abrir el menú lateral propio (MenuLateral.js), título de la pantalla y
// botón de salir.
export default function EncabezadoPantalla({ titulo }) {
  const { cerrarSesion } = useAuth();
  const { abrirMenu } = useNav();

  return (
    <View style={styles.encabezado}>
      <View style={styles.izquierda}>
        <TouchableOpacity onPress={abrirMenu} style={styles.botonMenu}>
          <Text style={styles.iconoMenu}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{titulo}</Text>
      </View>
      <TouchableOpacity onPress={cerrarSesion}>
        <Text style={styles.salir}>Salir</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botonMenu: { padding: 4 },
  iconoMenu: { fontSize: 20, color: colores.text },
  titulo: { fontSize: 19, fontWeight: '700', color: colores.text },
  salir: { color: colores.red, fontSize: 13.5, fontWeight: '600' },
});
