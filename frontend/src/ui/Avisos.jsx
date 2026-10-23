import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconCheck, IconX } from './Icons';

const TONOS = {
  exito: { color: 'var(--green)', fondo: 'var(--green-bg)' },
  error: { color: 'var(--red)', fondo: 'var(--red-bg)' },
  alerta: { color: 'var(--orange)', fondo: 'var(--orange-bg)' },
  info: { color: 'var(--info)', fondo: 'var(--info-bg)' },
};

// Se monta una sola vez en App: dibuja los avisos y el cuadro de confirmación.
export default function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [pregunta, setPregunta] = useState(null);
  const botonConfirmar = useRef(null);

  useEffect(() => {
    let contador = 0;
    function alAvisar(e) {
      const id = ++contador + Date.now();
      setAvisos((prev) => [...prev.slice(-3), { id, ...e.detail }]);
      setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), e.detail.tipo === 'error' ? 6500 : 4000);
    }
    function alPreguntar(e) {
      setPregunta(e.detail);
    }
    window.addEventListener('rt-aviso', alAvisar);
    window.addEventListener('rt-confirmar', alPreguntar);
    return () => {
      window.removeEventListener('rt-aviso', alAvisar);
      window.removeEventListener('rt-confirmar', alPreguntar);
    };
  }, []);

  const responder = useCallback(
    (valor) => {
      pregunta?.resolve(valor);
      setPregunta(null);
    },
    [pregunta]
  );

  useEffect(() => {
    if (!pregunta) return undefined;
    botonConfirmar.current?.focus();
    function alTeclear(e) {
      if (e.key === 'Escape') responder(false);
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [pregunta, responder]);

  return (
    <>
      <div className="rt-avisos" aria-live="polite">
        {avisos.map((a) => {
          const tono = TONOS[a.tipo] || TONOS.info;
          const Icono = a.tipo === 'exito' ? IconCheck : IconAlert;
          return (
            <div key={a.id} className="rt-aviso" style={{ borderLeft: `4px solid ${tono.color}` }} role="status">
              <span className="rt-aviso-icono" style={{ background: tono.fondo, color: tono.color }}>
                <Icono size={15} />
              </span>
              <p>{a.texto}</p>
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))}
              >
                <IconX size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {pregunta && (
        <div className="rt-fondo-modal" onClick={() => responder(false)} style={{ zIndex: 100 }}>
          <div
            className="rt-dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="rt-dialogo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rt-dialogo-icono"
              style={{
                background: pregunta.peligro ? 'var(--red-bg)' : 'var(--info-bg)',
                color: pregunta.peligro ? 'var(--red)' : 'var(--info)',
              }}
            >
              <IconAlert size={22} />
            </div>
            <h2 id="rt-dialogo-titulo" style={{ fontSize: 16.5, marginBottom: 8 }}>
              {pregunta.titulo}
            </h2>
            <p style={{ fontSize: 13.7, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {pregunta.mensaje}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="rt-btn rt-btn-secundario" onClick={() => responder(false)}>
                Cancelar
              </button>
              <button
                type="button"
                ref={botonConfirmar}
                className={`rt-btn ${pregunta.peligro ? 'rt-btn-peligro-solido' : 'rt-btn-primario'}`}
                onClick={() => responder(true)}
              >
                {pregunta.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
