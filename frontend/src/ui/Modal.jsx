// Ventana emergente sencilla para editar registros desde Administración.
export default function Modal({ titulo, onCerrar, children, ancho = 520 }) {
  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 27, 46, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: ancho,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 12,
          padding: 22,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16.5 }}>{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', fontSize: 20, color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const estiloCampo = {
  width: '100%',
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
