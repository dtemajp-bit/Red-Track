import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import cliente from '../api/cliente';
import { IconWifiOff, IconClock, IconCheck } from '../ui/Icons';

const ETIQUETA_TIPO = {
  nodo: 'Infraestructura',
  cable: 'Cable',
  incidencia: 'Incidencia',
};

export default function Sincronizacion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmados, setConfirmados] = useState(null);
  const [error, setError] = useState('');

  async function cargarPendientes() {
    setCargando(true);
    try {
      const respuesta = await cliente.get('/sincronizacion/pendientes');
      setPendientes(respuesta.data);
    } catch {
      setError('No se pudieron cargar los registros pendientes');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPendientes();
    function actualizar() {
      setEnLinea(navigator.onLine);
    }
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  async function sincronizarTodo() {
    setSincronizando(true);
    setConfirmados(null);
    let exitosos = 0;
    for (const p of pendientes) {
      try {
        await cliente.put(`/sincronizacion/${p.id_registro}/sincronizar`);
        exitosos += 1;
      } catch {
        // Se deja el registro en la lista para reintentar más tarde.
      }
    }
    setConfirmados(exitosos);
    setSincronizando(false);
    await cargarPendientes();
  }

  return (
    <AppLayout title="Sincronización">
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderRadius: 8,
            background: enLinea ? 'var(--green-bg)' : 'var(--orange-bg)',
            color: enLinea ? 'var(--green)' : 'var(--orange)',
            marginBottom: 18,
          }}
        >
          <IconWifiOff size={18} />
          <div>
            <p style={{ fontWeight: 600, fontSize: 13.7 }}>{enLinea ? 'Conectado' : 'Sin conexión'}</p>
            <p style={{ fontSize: 12.7 }}>
              {enLinea
                ? 'Tu conexión está activa. Puedes sincronizar los registros pendientes.'
                : 'Tus registros se están guardando en este dispositivo. Sincroniza cuando recuperes señal.'}
            </p>
          </div>
        </div>

        {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Cargando…</p>
        ) : pendientes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
            {pendientes.map((p) => (
              <div
                key={p.id_registro}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 4px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconClock size={16} color="var(--text-soft)" />
                  <div>
                    <p style={{ fontSize: 13.7, fontWeight: 600 }}>{ETIQUETA_TIPO[p.tipo_entidad] || p.tipo_entidad}</p>
                    <p style={{ fontSize: 12.3, color: 'var(--text-muted)' }}>Registro #{p.id_registro}</p>
                  </div>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {new Date(p.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          confirmados !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 4px',
                color: 'var(--green)',
                fontSize: 13.7,
                marginBottom: 16,
              }}
            >
              <IconCheck size={16} />
              {confirmados} registro(s) sincronizado(s) correctamente.
            </div>
          )
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pendientes.length} registros pendientes</p>
          <button
            onClick={sincronizarTodo}
            disabled={!enLinea || sincronizando || pendientes.length === 0}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: !enLinea || pendientes.length === 0 ? '#c7ccd6' : 'var(--navy)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            {sincronizando ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
        </div>
      </Card>
    </AppLayout>
  );
}
