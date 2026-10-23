import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registrarSesionVencida } from '../api/cliente';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // Si el servidor responde 401 (token vencido), se cierra la sesión y se muestra el login.
  useEffect(() => {
    registrarSesionVencida(() => setUsuario(null));
    return () => registrarSesionVencida(null);
  }, []);

  useEffect(() => {
    async function restaurarSesion() {
      try {
        const guardado = await AsyncStorage.getItem('usuario');
        if (guardado) {
          setUsuario(JSON.parse(guardado));
        }
      } catch (error) {
        // Si la sesión guardada está dañada, la eliminamos y mostramos el login.
        await AsyncStorage.multiRemove(['token', 'usuario']);
        setUsuario(null);
      } finally {
        setCargandoSesion(false);
      }
    }
    restaurarSesion();
  }, []);

  async function iniciarSesion(token, datosUsuario) {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
  }

  async function cerrarSesion() {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('usuario');
    setUsuario(null);
  }

  // Actualiza parcialmente los datos del usuario en sesión (ej. tras cambiar la foto de perfil)
  // sin necesidad de volver a iniciar sesión.
  async function actualizarUsuario(cambios) {
    setUsuario((actual) => {
      const nuevo = { ...actual, ...cambios };
      AsyncStorage.setItem('usuario', JSON.stringify(nuevo));
      return nuevo;
    });
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargandoSesion, iniciarSesion, cerrarSesion, actualizarUsuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
