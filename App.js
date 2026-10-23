import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NavProvider, useNav } from './src/context/NavContext';
import LoginScreen from './src/screens/LoginScreen';
import PanelTecnicoScreen from './src/screens/PanelTecnicoScreen';
import RegistrarInfraestructuraScreen from './src/screens/RegistrarInfraestructuraScreen';
import MapaCoberturaScreen from './src/screens/MapaCoberturaScreen';
import SincronizacionScreen from './src/screens/SincronizacionScreen';
import IncidenciasScreen from './src/screens/IncidenciasScreen';
import AdministracionScreen from './src/screens/AdministracionScreen';
import ReportesScreen from './src/screens/ReportesScreen';
import MenuLateral from './src/components/MenuLateral';
import { colores } from './src/theme/colors';

// Antes esto usaba @react-navigation/drawer. Ese paquete necesita
// react-native-reanimated + react-native-worklets, que requieren una
// compilación nativa personalizada y no funcionan dentro de Expo Go
// (la app se cerraba al abrir el menú). Aquí la "navegación" es solo
// mostrar el componente de la pantalla activa según NavContext.
const PANTALLAS = {
  PanelTecnico: PanelTecnicoScreen,
  RegistrarInfraestructura: RegistrarInfraestructuraScreen,
  MapaCobertura: MapaCoberturaScreen,
  Sincronizacion: SincronizacionScreen,
  Incidencias: IncidenciasScreen,
  Administracion: AdministracionScreen,
  Reportes: ReportesScreen,
};

function AreaPrivada() {
  const { pantallaActual } = useNav();
  const Pantalla = PANTALLAS[pantallaActual] || PanelTecnicoScreen;

  return (
    <View style={{ flex: 1, backgroundColor: colores.bg }}>
      <Pantalla />
      <MenuLateral />
    </View>
  );
}

function NavegacionRaiz() {
  const { usuario, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colores.navy }}>
        <ActivityIndicator size="large" color={colores.celeste} />
      </View>
    );
  }

  if (!usuario) {
    return <LoginScreen />;
  }

  return (
    <NavProvider>
      <AreaPrivada />
    </NavProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <NavegacionRaiz />
    </AuthProvider>
  );
}
