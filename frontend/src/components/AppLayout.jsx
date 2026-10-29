import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AvatarPerfil from './AvatarPerfil';
import {
  IconPanel,
  IconPin,
  IconMap,
  IconSync,
  IconAlert,
  IconUsers,
  IconReport,
  IconLogout,
  IconMenu,
  IconTarget,
} from '../ui/Icons';

const NAV_ITEMS = [
  { to: '/panel', label: 'Panel del técnico', icon: IconPanel },
  { to: '/infraestructura', label: 'Registrar infraestructura', icon: IconPin },
  { to: '/cobertura', label: 'Mapa de cobertura', icon: IconMap },
  { to: '/sincronizacion', label: 'Sincronización', icon: IconSync },
  { to: '/incidencias', label: 'Incidencias', icon: IconAlert },
  { to: '/gestion', label: 'Gestionar actividades', icon: IconTarget, soloAdmin: true },
  { to: '/administracion', label: 'Administración', icon: IconUsers, soloAdmin: true },
  { to: '/reportes', label: 'Reportes', icon: IconReport },
];

export default function AppLayout({ eyebrow = 'PANEL', title, children }) {
  const { cerrarSesion, usuario } = useAuth();
  const itemsVisibles = NAV_ITEMS.filter(
    (i) =>
      (!i.soloAdmin || usuario?.rol === 'administrador') &&
      (!i.soloGestor || ['administrador', 'supervisor'].includes(usuario?.rol))
  );
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  function salir() {
    cerrarSesion();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <div className={`rt-fondo-menu ${menuAbierto ? 'abierto' : ''}`} onClick={() => setMenuAbierto(false)} />
      <aside
        className={`rt-sidebar ${menuAbierto ? 'abierto' : ''}`}
        style={{
          width: 236,
          flexShrink: 0,
          background: 'var(--navy)',
          color: '#cbd5e6',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '20px 18px',
            fontWeight: 700,
            fontSize: 15.5,
            color: '#fff',
            letterSpacing: '0.01em',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: 'var(--celeste)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMap size={15} color="#ffffff" />
          </span>
          RED-TRACK
        </div>

        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {itemsVisibles.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuAbierto(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13.7,
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? '#fff' : '#aeb9cc',
                background: isActive ? 'var(--navy-soft)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--celeste)' : '3px solid transparent',
              })}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 10, borderTop: '1px solid var(--navy-border)' }}>
          <button
            onClick={salir}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#aeb9cc',
              fontSize: 13.7,
              fontWeight: 500,
            }}
          >
            <IconLogout size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          className="rt-encabezado"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 28px',
            background: '#fff',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <button
              type="button"
              className="rt-menu-btn"
              aria-label="Abrir menú"
              onClick={() => setMenuAbierto(true)}
            >
              <IconMenu size={19} />
            </button>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.06em' }}>
                {eyebrow}
              </p>
              <h1 style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
            </div>
          </div>
          <AvatarPerfil />
        </header>

        <main className="rt-contenido">{children}</main>
      </div>
    </div>
  );
}
