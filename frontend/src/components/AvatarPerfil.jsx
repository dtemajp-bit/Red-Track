import { useRef, useState } from 'react';
import cliente, { ORIGEN_ARCHIVOS } from '../api/cliente';
import { useAuth } from '../context/AuthContext';

function iniciales(nombre) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return (partes[0]?.[0] || '') + (partes[1]?.[0] || '');
}

export default function AvatarPerfil() {
  const { usuario, actualizarUsuario } = useAuth();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function manejarArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('foto', archivo);
      const { data } = await cliente.put('/usuarios/perfil/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      actualizarUsuario({ foto_perfil: data.foto_perfil });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo actualizar la foto');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Cambiar foto de perfil"
        disabled={subiendo}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'var(--celeste-bg)',
          color: 'var(--celeste-dark)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12.5,
          fontWeight: 700,
          opacity: subiendo ? 0.6 : 1,
        }}
      >
        {usuario?.foto_perfil ? (
          <img
            src={`${ORIGEN_ARCHIVOS}${usuario.foto_perfil}`}
            alt="Foto de perfil"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          iniciales(usuario?.nombre_completo).toUpperCase()
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={manejarArchivo}
        style={{ display: 'none' }}
      />
      <span style={{ fontSize: 13.7, fontWeight: 500, color: 'var(--text)' }}>
        {usuario?.nombre_completo}
      </span>
      {error ? (
        <span style={{ position: 'absolute', top: 36, right: 0, fontSize: 11, color: 'var(--red)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
