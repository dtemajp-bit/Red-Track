import { createContext, useContext, useState } from 'react';

const NavContext = createContext(null);

// Reemplaza a @react-navigation/drawer: ese paquete depende de
// react-native-reanimated/react-native-worklets, que requieren una
// compilación nativa propia y no funcionan dentro de Expo Go (la app
// se cerraba sola al abrir el menú). En su lugar, este contexto guarda
// qué pantalla se muestra y si el menú lateral está abierto, usando
// solo React state + Animated (ver MenuLateral.js).
export function NavProvider({ children, pantallaInicial = 'PanelTecnico' }) {
  const [pantallaActual, setPantallaActual] = useState(pantallaInicial);
  const [menuVisible, setMenuVisible] = useState(false);

  function navegar(pantalla) {
    setPantallaActual(pantalla);
    setMenuVisible(false);
  }

  const valor = {
    pantallaActual,
    navegar,
    menuVisible,
    abrirMenu: () => setMenuVisible(true),
    cerrarMenu: () => setMenuVisible(false),
  };

  return <NavContext.Provider value={valor}>{children}</NavContext.Provider>;
}

export function useNav() {
  const contexto = useContext(NavContext);
  if (!contexto) {
    throw new Error('useNav debe usarse dentro de <NavProvider>');
  }
  return contexto;
}
