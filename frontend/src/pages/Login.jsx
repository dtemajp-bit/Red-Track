import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { IconMail, IconLock, IconMap, IconPin, IconSync, IconAlert, IconWifiOff } from '../ui/Icons';

const CARACTERISTICAS = [
  { Icono: IconPin, titulo: 'Registro georreferenciado', texto: 'Postes, cajas y nodos con ubicación exacta.' },
  { Icono: IconWifiOff, titulo: 'Modo sin conexión', texto: 'Trabaja en campo y sincroniza al volver.' },
  { Icono: IconAlert, titulo: 'Incidencias en tiempo real', texto: 'Reporta y da seguimiento a cada falla.' },
  { Icono: IconSync, titulo: 'Rutas y reportes', texto: 'Planifica jornadas y exporta resultados.' },
];

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  async function manejarEnvio(evento) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      const respuesta = await cliente.post('/auth/login', { correo, contrasena });
      iniciarSesion(respuesta.data.token, respuesta.data.usuario);
      navigate('/panel');
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || 'Error al iniciar sesión';
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rt-login">
      <aside className="rt-login-marca">
        <div className="rt-login-logo">
          <span><IconMap size={20} color="#ffffff" /></span>
          RED-TRACK
        </div>
        <div className="rt-login-hero">
          <h2>Gestión de infraestructura de red, desde el campo.</h2>
          <p>Plataforma de soporte para técnicos: registra, supervisa y mantiene tu red en un solo lugar.</p>
          <ul>
            {CARACTERISTICAS.map(({ Icono, titulo, texto }) => (
              <li key={titulo}>
                <span className="rt-login-icono"><Icono size={18} /></span>
                <div>
                  <strong>{titulo}</strong>
                  <small>{texto}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="rt-login-pie">Universidad Mariano Gálvez · Seminario de Ingeniería en Sistemas</p>
      </aside>

      <main className="rt-login-panel">
        <form className="rt-login-tarjeta" onSubmit={manejarEnvio}>
          <div className="rt-login-logo rt-login-logo-movil">
            <span><IconMap size={18} color="#ffffff" /></span>
            RED-TRACK
          </div>
          <h1>Bienvenido</h1>
          <p className="rt-login-sub">Inicia sesión para continuar</p>

          <label htmlFor="correo">Usuario o correo</label>
          <div className="rt-login-campo">
            <IconMail size={16} />
            <input
              id="correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="username"
              required
            />
          </div>

          <label htmlFor="clave">Contraseña</label>
          <div className="rt-login-campo">
            <IconLock size={16} />
            <input
              id="clave"
              type={verClave ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button type="button" className="rt-login-ver" onClick={() => setVerClave((v) => !v)}>
              {verClave ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          {error && <p className="rt-login-error" role="alert">{error}</p>}

          <button type="submit" className="rt-login-enviar" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="rt-login-ayuda">
            ¿Olvidaste tu contraseña? <a href="#">Recupérala aquí</a>
          </p>
          {cargando && (
            <p className="rt-login-nota">La primera conexión puede tardar hasta un minuto mientras el servidor despierta.</p>
          )}
        </form>
      </main>
    </div>
  );
}
