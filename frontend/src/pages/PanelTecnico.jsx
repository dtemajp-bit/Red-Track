import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import cliente from '../api/cliente';
import { IconPin } from '../ui/Icons';
import ListaActividades from '../components/ListaActividades';

function estadoPunto(visitado) {
  return visitado ? 'Completada' : 'Pendiente';
}

export default function PanelTecnico() {
  const [ruta, setRuta] = useState(undefined); // undefined = cargando, null = sin ruta
  const [error, setError] = useState('');
  const [cobertura, setCobertura] = useState(null);

  async function cargarRuta() {
    try {
      const respuesta = await cliente.get('/rutas/mia');
      setRuta(respuesta.data);
    } catch {
      setError('No se pudo cargar la ruta de hoy');
      setRuta(null);
    }
  }

  useEffect(() => {
    cargarRuta();
    cliente
      .get('/reportes/infraestructura-por-zona')
      .then((res) => setCobertura(res.data))
      .catch(() => setCobertura([]));
  }, []);

  async function alternarVisitado(punto) {
    try {
      await cliente.put(`/rutas/puntos/${punto.id_ruta_nodo}`, { visitado: !punto.visitado });
      setRuta((prev) => ({
        ...prev,
        puntos: prev.puntos.map((p) =>
          p.id_ruta_nodo === punto.id_ruta_nodo ? { ...p, visitado: !p.visitado } : p
        ),
      }));
    } catch {
      setError('No se pudo actualizar el punto');
    }
  }

  return (
    <AppLayout title="Panel del técnico">
      <div className="rt-colapsa" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <ListaActividades />
        <Card
          title={ruta ? `Ruta de hoy — ${ruta.nombre}` : 'Ruta de hoy'}
          subtitle={
            ruta === undefined
              ? 'Cargando…'
              : ruta
              ? `RT-${ruta.id_ruta} · ${ruta.puntos.length} puntos`
              : 'No tienes una ruta asignada por ahora'
          }
        >
          {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}
          {ruta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ruta.puntos.map((p) => (
                <div
                  key={p.id_ruta_nodo}
                  onClick={() => alternarVisitado(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 4px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconPin size={16} color="var(--text-soft)" />
                    <div>
                      <p style={{ fontSize: 13.7, fontWeight: 600 }}>{p.codigo}</p>
                      <p style={{ fontSize: 12.3, color: 'var(--text-muted)' }}>
                        {p.tipo.replace('_', ' ')} · {p.zona || 'sin zona'}
                      </p>
                    </div>
                  </div>
                  <Badge>{estadoPunto(p.visitado)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        </div>

        <Card title="Infraestructura por zona" subtitle="Nodos activos vs. total, en tiempo real">
          {cobertura === null ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando…</p>
          ) : cobertura.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay nodos registrados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cobertura.map((z) => {
                const porcentaje = z.total > 0 ? Math.round((z.activos / z.total) * 100) : 0;
                return (
                  <div key={z.zona}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.7, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{z.zona}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {z.activos}/{z.total} activos
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#e7eaf0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${porcentaje}%`, background: 'var(--navy)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
