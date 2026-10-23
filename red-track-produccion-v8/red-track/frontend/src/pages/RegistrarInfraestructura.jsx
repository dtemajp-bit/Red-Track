import { useEffect, useState } from 'react';
import cliente, { ORIGEN_ARCHIVOS } from '../api/cliente';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { IconAlert, IconCamera, IconPin } from '../ui/Icons';
import { useAuth } from '../context/AuthContext';
import { agregarACola, esErrorDeRed, reducirFoto } from '../lib/cola';

const TIPOS = [
  { valor: 'poste', etiqueta: 'Poste' },
  { valor: 'nodo_central', etiqueta: 'Nodo central' },
  { valor: 'caja_distribucion', etiqueta: 'Caja de distribución' },
];

const ESTADOS = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'mantenimiento', etiqueta: 'En revisión' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
];

const VACIO = { codigo: '', tipo: 'poste', latitud: '', longitud: '', estado: 'activo', observaciones: '' };

export default function RegistrarInfraestructura() {
  const { usuario } = useAuth();
  const [aviso, setAviso] = useState('');
  const [nodos, setNodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(VACIO);
  const [foto, setFoto] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState(null);

  function manejarSeleccionFoto(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    setFoto(archivo);
    setPrevisualizacion(URL.createObjectURL(archivo));
  }

  async function cargarNodos() {
    setCargando(true);
    try {
      const respuesta = await cliente.get('/nodos');
      setNodos(respuesta.data);
    } catch {
      setError('No se pudieron cargar los registros existentes');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarNodos();
  }, []);

  function capturarUbicacion() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitud: pos.coords.latitude.toFixed(7),
          longitud: pos.coords.longitude.toFixed(7),
        }));
      },
      () => {
        // Señal GPS no disponible: el técnico puede ingresar las coordenadas manualmente.
      }
    );
  }

  useEffect(() => {
    capturarUbicacion();
  }, []);

  async function manejarGuardar(evento) {
    evento.preventDefault();
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      const datos = new FormData();
      datos.append('codigo', form.codigo);
      datos.append('tipo', form.tipo);
      datos.append('latitud', form.latitud);
      datos.append('longitud', form.longitud);
      datos.append('estado', form.estado);
      datos.append('observaciones', form.observaciones);
      if (foto) datos.append('foto', foto);

      await cliente.post('/nodos', datos);
      setForm(VACIO);
      setFoto(null);
      setPrevisualizacion(null);
      capturarUbicacion();
      cargarNodos();
    } catch (err) {
      if (esErrorDeRed(err)) {
        // Sin conexión: se guarda en este navegador y se envía desde Sincronización.
        if (!form.codigo.trim() || !form.latitud || !form.longitud) {
          setError('Completa el código y la ubicación antes de guardar.');
        } else {
          try {
            const fotoReducida = foto ? await reducirFoto(foto) : null;
            const guardado = agregarACola({
              tipo: 'nodo',
              id_usuario: usuario.id_usuario,
              datos: { ...form },
              foto: fotoReducida,
            });
            setForm(VACIO);
            setFoto(null);
            setPrevisualizacion(null);
            capturarUbicacion();
            setAviso(
              guardado.fotoOmitida
                ? 'Sin conexión: el registro quedó guardado, pero la foto no cabía y se omitió. Envíalo desde Sincronización.'
                : 'Sin conexión: el registro quedó guardado en este equipo. Envíalo desde Sincronización.'
            );
          } catch (e) {
            setError(e.message);
          }
        }
      } else {
        setError(err.response?.data?.mensaje || 'Error al guardar el registro');
      }
    } finally {
      setGuardando(false);
    }
  }

  const campoInput = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 13.7,
    outline: 'none',
  };

  return (
    <AppLayout title="Registrar infraestructura">
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: 12,
              borderRadius: 8,
              background: 'var(--orange-bg)',
              color: 'var(--orange)',
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            <IconAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <p>
              Antes de continuar, verifica los riesgos eléctricos del punto y utiliza tu equipo de
              protección personal.
            </p>
          </div>

          <h2 style={{ fontSize: 15.5, marginBottom: 3 }}>Registrar infraestructura</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Poste, cable o nodo detectado en el punto actual de la ruta.
          </p>

          <form onSubmit={manejarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Tipo de elemento</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  style={campoInput}
                >
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Código</label>
                <input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="PT-0234"
                  required
                  style={campoInput}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Latitud</label>
                <input
                  value={form.latitud}
                  onChange={(e) => setForm({ ...form, latitud: e.target.value })}
                  required
                  style={campoInput}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Longitud</label>
                <input
                  value={form.longitud}
                  onChange={(e) => setForm({ ...form, longitud: e.target.value })}
                  required
                  style={campoInput}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 6 }}>Estado</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {ESTADOS.map((e) => (
                  <button
                    type="button"
                    key={e.valor}
                    onClick={() => setForm({ ...form, estado: e.valor })}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 7,
                      border: '1px solid ' + (form.estado === e.valor ? 'var(--navy)' : 'var(--border)'),
                      background: form.estado === e.valor ? 'var(--navy)' : '#fff',
                      color: form.estado === e.valor ? '#fff' : 'var(--text)',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {e.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 6 }}>Fotografía</label>
              <input
                id="input-foto"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={manejarSeleccionFoto}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="input-foto"
                style={{
                  display: 'block',
                  cursor: 'pointer',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 8,
                  padding: previsualizacion ? 8 : '20px 12px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                {previsualizacion ? (
                  <img
                    src={previsualizacion}
                    alt="Previsualización"
                    style={{ maxHeight: 140, borderRadius: 6, display: 'block', margin: '0 auto' }}
                  />
                ) : (
                  <>
                    <IconCamera size={20} style={{ marginBottom: 6 }} />
                    <p style={{ fontSize: 12.7 }}>Subir o tomar foto</p>
                  </>
                )}
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, marginBottom: 5 }}>Observaciones</label>
              <textarea
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas adicionales del técnico…"
                rows={3}
                style={{ ...campoInput, resize: 'vertical' }}
              />
            </div>

            {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
            {aviso && <p style={{ color: 'var(--orange)', fontSize: 13 }}>{aviso}</p>}

            <button
              type="submit"
              disabled={guardando}
              style={{
                alignSelf: 'flex-start',
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--navy)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13.7,
              }}
            >
              {guardando ? 'Guardando…' : '✓ Guardar registro'}
            </button>
          </form>
        </Card>

        <Card title="Infraestructura registrada" subtitle={`${nodos.length} elementos`}>
          {cargando ? (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Cargando…</p>
          ) : nodos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Aún no hay registros.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 480, overflowY: 'auto' }}>
              {nodos.map((n) => (
                <div
                  key={n.id_nodo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 4px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {n.foto_url ? (
                      <img
                        src={`${ORIGEN_ARCHIVOS}${n.foto_url}`}
                        alt={n.codigo}
                        style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }}
                      />
                    ) : (
                      <IconPin size={16} color="var(--text-soft)" />
                    )}
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 600 }}>{n.codigo}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {n.tipo} · {n.nombre_zona || 'Sin zona'}
                      </p>
                    </div>
                  </div>
                  <Badge>{n.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
