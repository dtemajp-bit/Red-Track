import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cliente from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { IconMail, IconLock, IconMap } from '../ui/Icons';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
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
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: '100%',
          background: 'var(--navy-soft)',
          border: '1px solid var(--navy-border)',
          borderRadius: 14,
          padding: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 26 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--celeste)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMap size={16} color="#0f1b2e" />
          </span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15.5, letterSpacing: '0.01em' }}>
            RED-TRACK
          </span>
        </div>

        <h1 style={{ color: '#fff', fontSize: 22, marginBottom: 4 }}>Iniciar sesión</h1>
        <p style={{ color: '#9aa5ba', fontSize: 13.5, marginBottom: 24 }}>
          Sistema de soporte a técnicos de campo
        </p>

        <form onSubmit={manejarEnvio}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, color: '#c2cadb', marginBottom: 6 }}>
              Usuario o correo
            </label>
            <div style={{ position: 'relative' }}>
              <IconMail
                size={16}
                color="#7c88a0"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="jgarcia@redtrack.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--navy-border)',
                  background: '#0f1b2e',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12.5, color: '#c2cadb', marginBottom: 6 }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <IconLock
                size={16}
                color="#7c88a0"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--navy-border)',
                  background: '#0f1b2e',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#f3a39a', fontSize: 13, margin: '10px 0 0' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%',
              marginTop: 20,
              padding: '11px 0',
              borderRadius: 8,
              border: 'none',
              background: cargando ? '#1b2d47' : '#fff',
              color: cargando ? '#8b97ac' : 'var(--navy)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#8b97ac', marginTop: 16 }}>
            ¿Olvidaste tu contraseña?{' '}
            <a href="#" style={{ color: 'var(--celeste)' }}>
              Recupérala aquí
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
