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
import ActividadDetalle from './pages/ActividadDetalle';
import GestionActividades from './pages/GestionActividades';
import Supervision from './pages/Supervision';
import SupervisionDetalle from './pages/SupervisionDetalle';
import Avisos from './ui/Avisos';

function RutaPrivada({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

// Solo el administrador entra a Administración; el técnico vuelve al panel.
function RutaAdmin({ children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return usuario.rol === 'administrador' ? children : <Navigate to="/panel" replace />;
}

// Administrador y supervisor: ruta de supervisión y calificación de órdenes.
function RutaGestor({ children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return ['administrador', 'supervisor'].includes(usuario.rol) ? children : <Navigate to="/panel" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Avisos />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/panel" element={<RutaPrivada><PanelTecnico /></RutaPrivada>} />
          <Route path="/infraestructura" element={<RutaPrivada><RegistrarInfraestructura /></RutaPrivada>} />
          <Route path="/cobertura" element={<RutaPrivada><MapaCobertura /></RutaPrivada>} />
          <Route path="/sincronizacion" element={<RutaPrivada><Sincronizacion /></RutaPrivada>} />
          <Route path="/incidencias" element={<RutaPrivada><Incidencias /></RutaPrivada>} />
          <Route path="/administracion" element={<RutaAdmin><Administracion /></RutaAdmin>} />
          <Route path="/actividad/:id" element={<RutaPrivada><ActividadDetalle /></RutaPrivada>} />
          <Route path="/gestion" element={<RutaAdmin><GestionActividades /></RutaAdmin>} />
          <Route path="/supervision" element={<RutaGestor><Supervision /></RutaGestor>} />
          <Route path="/supervision/:id" element={<RutaGestor><SupervisionDetalle /></RutaGestor>} />
          <Route path="/reportes" element={<RutaPrivada><Reportes /></RutaPrivada>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
