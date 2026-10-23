import { useEffect } from 'react';
import { IconX } from './Icons';

// Ventana emergente para detalle y edición. Se cierra con Escape o al tocar el fondo.
export default function Modal({ titulo, onCerrar, children, ancho = 520 }) {
  useEffect(() => {
    function alTeclear(e) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="rt-fondo-modal" onClick={onCerrar}>
      <div
        className="rt-caja-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ maxWidth: ancho }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10 }}>
          <h2 style={{ fontSize: 16.5 }}>{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rt-btn-icono" style={{ border: 'none' }}>
            <IconX size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const estiloCampo = {
  width: '100%',
  background: '#fff',
  color: 'var(--text)',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13.5,
};

export const estiloBotonPrimario = {
  padding: '9px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--navy)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13.5,
};

export const estiloBotonSecundario = {
  padding: '9px 16px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'var(--text)',
  fontWeight: 600,
  fontSize: 13.5,
};

export const estiloBotonPeligro = {
  padding: '9px 16px',
  borderRadius: 8,
  border: '1px solid var(--red)',
  background: '#fff',
  color: 'var(--red)',
  fontWeight: 600,
  fontSize: 13.5,
};

export function Etiqueta({ children }) {
  return <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5, color: 'var(--text-muted)' }}>{children}</label>;
}
