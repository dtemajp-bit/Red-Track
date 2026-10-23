import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PanelTecnico from './pages/PanelTecnico';
import RegistrarInfraestructura from './pages/RegistrarInfraestructura';
import MapaCobertura from './pages/MapaCobertura';
import Sincronizacion from './pages/Sincronizacion';
import Incidencias from './pages/Incidencias';
import Administracion from './pages/Administracion';
import Reportes from './pages/Reportes';

function RutaPrivada({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/panel" element={<RutaPrivada><PanelTecnico /></RutaPrivada>} />
          <Route path="/infraestructura" element={<RutaPrivada><RegistrarInfraestructura /></RutaPrivada>} />
          <Route path="/cobertura" element={<RutaPrivada><MapaCobertura /></RutaPrivada>} />
          <Route path="/sincronizacion" element={<RutaPrivada><Sincronizacion /></RutaPrivada>} />
          <Route path="/incidencias" element={<RutaPrivada><Incidencias /></RutaPrivada>} />
          <Route path="/administracion" element={<RutaPrivada><Administracion /></RutaPrivada>} />
          <Route path="/reportes" element={<RutaPrivada><Reportes /></RutaPrivada>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
