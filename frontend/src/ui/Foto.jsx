import { useState } from 'react';
import { ORIGEN_ARCHIVOS } from '../api/cliente';
import { IconImage } from './Icons';

// Miniatura de un punto. Si no hay foto o el archivo ya no existe en el servidor,
// muestra un marcador en lugar del texto roto del navegador.
export default function Foto({ url, alt = '', tam = 44, radio = 8, onClick, previa }) {
  const [fallo, setFallo] = useState(false);
  const src = previa || (url ? `${ORIGEN_ARCHIVOS}${url}` : null);
  const estilo = { width: tam, height: tam, borderRadius: radio, flexShrink: 0 };
  const props = onClick ? { onClick, role: 'button', style: { ...estilo, cursor: 'zoom-in' } } : { style: estilo };

  if (!src || fallo) {
    return (
      <span
        {...props}
        style={{
          ...props.style,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--gris-bg)',
          color: 'var(--text-soft)',
        }}
        title={src && fallo ? 'La foto ya no está disponible en el servidor' : 'Sin foto'}
      >
        <IconImage size={Math.round(tam * 0.45)} />
      </span>
    );
  }
  return <img {...props} src={src} alt={alt} loading="lazy" onError={() => setFallo(true)} style={{ ...props.style, objectFit: 'cover' }} />;
}
