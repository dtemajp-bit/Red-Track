import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import cliente from '../api/cliente';
import { IconPlus } from '../ui/Icons';
import AdminRutas from '../components/AdminRutas';

const th = { textAlign: 'left', padding: '9px 6px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 };
const td = { padding: '11px 6px', fontSize: 13.5, borderTop: '1px solid var(--border)' };
const campo = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13.5,
};

const FORM_VACIO = { nombre_completo: '', correo: '', contrasena: '', id_rol: '', id_zona: '' };

export default function Administracion() {
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [mostrarFormRuta, setMostrarFormRuta] = useState(false);
  const [formZona, setFormZona] = useState({ nombre: '', descripcion: '' });
  const [mostrarFormZona, setMostrarFormZona] = useState(false);

  async function cargarTodo() {
    setCargando(true);
    try {
      const [resUsuarios, resZonas, resRoles] = await Promise.all([
        cliente.get('/usuarios'),
        cliente.get('/catalogos/zonas'),
        cliente.get('/catalogos/roles'),
      ]);
      setUsuarios(resUsuarios.data);
      setZonas(resZonas.data);
      setRoles(resRoles.data);
      setError('');
    } catch {
      setError('No se pudo cargar la información. ¿Tu usuario tiene rol de administrador?');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function crearTecnico(evento) {
    evento.preventDefault();
    setEnviando(true);
    try {
      await cliente.post('/usuarios', {
        ...form,
        id_rol: Number(form.id_rol),
        id_zona: form.id_zona ? Number(form.id_zona) : null,
      });
      setForm(FORM_VACIO);
      setMostrarForm(false);
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear el usuario');
    } finally {
      setEnviando(false);
    }
  }

  async function crearZona(evento) {
    evento.preventDefault();
    setEnviando(true);
    try {
      await cliente.post('/catalogos/zonas', formZona);
      setFormZona({ nombre: '', descripcion: '' });
      setMostrarFormZona(false);
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear la zona');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarEstado(usuario) {
    try {
      await cliente.put(`/usuarios/${usuario.id_usuario}/estado`, { activo: !usuario.activo });
      setUsuarios((prev) =>
        prev.map((u) => (u.id_usuario === usuario.id_usuario ? { ...u, activo: !u.activo } : u))
      );
    } catch {
      setError('No se pudo cambiar el estado del usuario');
    }
  }

  const zonasConTecnicos = zonas.map((z) => ({
    ...z,
    tecnicos: usuarios.filter((u) => u.id_zona === z.id_zona && u.rol === 'tecnico').length,
  }));

  return (
    <AppLayout title="Administración">
      <Card
        subtitle={cargando ? 'Cargando…' : undefined}
        action={
          <button
            onClick={() => {
              if (tab === 'usuarios') setMostrarForm((v) => !v);
              else if (tab === 'rutas') setMostrarFormRuta((v) => !v);
              else setMostrarFormZona((v) => !v);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--navy)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <IconPlus size={15} /> {tab === 'usuarios' ? 'Nuevo usuario' : tab === 'rutas' ? 'Nueva ruta' : 'Nueva zona'}
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'zonas', label: 'Zonas' },
            { id: 'rutas', label: 'Rutas' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                background: tab === t.id ? 'var(--celeste-bg)' : 'transparent',
                color: tab === t.id ? 'var(--celeste-dark)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 13.5,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

        {tab === 'usuarios' && mostrarForm && (
          <form
            onSubmit={crearTecnico}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              padding: 14,
              marginBottom: 16,
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <input
              required
              placeholder="Nombre completo"
              value={form.nombre_completo}
              onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
              style={campo}
            />
            <input
              required
              type="email"
              placeholder="Correo"
              value={form.correo}
              onChange={(e) => setForm({ ...form, correo: e.target.value })}
              style={campo}
            />
            <input
              required
              type="password"
              placeholder="Contraseña temporal (mín. 8 caracteres)"
              minLength={8}
              value={form.contrasena}
              onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
              style={campo}
            />
            <select
              required
              value={form.id_rol}
              onChange={(e) => setForm({ ...form, id_rol: e.target.value })}
              style={campo}
            >
              <option value="">Rol…</option>
              {roles.map((r) => (
                <option key={r.id_rol} value={r.id_rol}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select
              value={form.id_zona}
              onChange={(e) => setForm({ ...form, id_zona: e.target.value })}
              style={campo}
            >
              <option value="">Sin zona</option>
              {zonas.map((z) => (
                <option key={z.id_zona} value={z.id_zona}>
                  {z.nombre}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={enviando}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--navy)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13.5,
              }}
            >
              {enviando ? 'Creando…' : 'Guardar usuario'}
            </button>
          </form>
        )}

        {tab === 'zonas' && mostrarFormZona && (
          <form
            onSubmit={crearZona}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr auto',
              gap: 10,
              padding: 14,
              marginBottom: 16,
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <input
              required
              placeholder="Nombre de la zona"
              value={formZona.nombre}
              onChange={(e) => setFormZona({ ...formZona, nombre: e.target.value })}
              style={campo}
            />
            <input
              placeholder="Descripción (opcional)"
              value={formZona.descripcion}
              onChange={(e) => setFormZona({ ...formZona, descripcion: e.target.value })}
              style={campo}
            />
            <button
              type="submit"
              disabled={enviando}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--navy)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13.5,
              }}
            >
              {enviando ? 'Guardando…' : 'Guardar zona'}
            </button>
          </form>
        )}

        {tab === 'usuarios' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Correo</th>
                <th style={th}>Rol</th>
                <th style={th}>Zona</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id_usuario}>
                  <td style={{ ...td, fontWeight: 600 }}>{u.nombre_completo}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{u.correo}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{u.rol}</td>
                  <td style={td}>{u.zona || '—'}</td>
                  <td style={td}>
                    <button
                      onClick={() => alternarEstado(u)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      title="Clic para cambiar estado"
                    >
                      <Badge>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'rutas' ? (
          <AdminRutas
            tecnicos={usuarios.filter((u) => u.rol === 'tecnico' && u.activo)}
            mostrarForm={mostrarFormRuta}
            onCerrarForm={() => setMostrarFormRuta(false)}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Zona</th>
                <th style={th}>Descripción</th>
                <th style={th}>Técnicos asignados</th>
              </tr>
            </thead>
            <tbody>
              {zonasConTecnicos.map((z) => (
                <tr key={z.id_zona}>
                  <td style={{ ...td, fontWeight: 600 }}>{z.nombre}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{z.descripcion}</td>
                  <td style={td}>{z.tecnicos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppLayout>
  );
}
