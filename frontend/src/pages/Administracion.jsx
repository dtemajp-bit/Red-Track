import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import cliente from '../api/cliente';
import { eliminarConConfirmacion } from '../lib/borrar';
import { IconPlus } from '../ui/Icons';
import AdminRutas from '../components/AdminRutas';
import AdminInfraestructura from '../components/AdminInfraestructura';
import AdminIncidencias from '../components/AdminIncidencias';
import Modal, { Etiqueta, estiloCampo, estiloBotonPrimario, estiloBotonSecundario, estiloBotonPeligro } from '../ui/Modal';

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
  const [editandoUsuario, setEditandoUsuario] = useState(null); // { ...usuario, contrasena_nueva }
  const [editandoZona, setEditandoZona] = useState(null);
  const [mensaje, setMensaje] = useState('');

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

  async function guardarUsuario(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await cliente.put(`/usuarios/${editandoUsuario.id_usuario}`, {
        nombre_completo: editandoUsuario.nombre_completo,
        correo: editandoUsuario.correo,
        id_rol: Number(editandoUsuario.id_rol),
        id_zona: editandoUsuario.id_zona ? Number(editandoUsuario.id_zona) : null,
      });
      if (editandoUsuario.contrasena_nueva) {
        await cliente.put(`/usuarios/${editandoUsuario.id_usuario}/contrasena`, {
          contrasena: editandoUsuario.contrasena_nueva,
        });
      }
      setEditandoUsuario(null);
      setMensaje('Usuario actualizado correctamente');
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo actualizar el usuario');
    } finally {
      setEnviando(false);
    }
  }

  async function guardarZona(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await cliente.put(`/catalogos/zonas/${editandoZona.id_zona}`, {
        nombre: editandoZona.nombre,
        descripcion: editandoZona.descripcion,
      });
      setEditandoZona(null);
      setMensaje('Zona actualizada correctamente');
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo actualizar la zona');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminarZona(zona) {
    setError('');
    setMensaje('');
    try {
      const hecho = await eliminarConConfirmacion(
        `/catalogos/zonas/${zona.id_zona}`,
        `¿Eliminar la zona "${zona.nombre}"? Esta acción no se puede deshacer.`,
        'Si continúas, los usuarios y puntos de esa zona quedarán "sin zona" (no se borran). ¿Eliminar de todos modos?'
      );
      if (hecho) {
        setMensaje('Zona eliminada');
        await cargarTodo();
      }
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar la zona');
    }
  }

  async function eliminarUsuario(u) {
    setError('');
    setMensaje('');
    try {
      const hecho = await eliminarConConfirmacion(
        `/usuarios/${u.id_usuario}`,
        `¿Eliminar al usuario "${u.nombre_completo}"? Esta acción no se puede deshacer.`,
        `Si continúas se borrarán también sus rutas, incidencias y pendientes. La infraestructura que registró se conserva. ¿Eliminar de todos modos?`
      );
      if (hecho) {
        setMensaje('Usuario eliminado');
        await cargarTodo();
      }
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar el usuario');
    }
  }

  async function limpiarDatos() {
    const texto = window.prompt(
      'Se borrará TODA la infraestructura, incidencias, rutas y pendientes de sincronización (los usuarios y zonas se conservan).\n\nEscribe BORRAR para confirmar:'
    );
    if (texto === null) return;
    setError('');
    setMensaje('');
    try {
      const res = await cliente.post('/admin/limpiar-datos', { confirmacion: texto.trim() });
      const e = res.data.eliminados;
      setMensaje(
        `Datos eliminados: ${e.infraestructura} puntos, ${e.incidencias} incidencias, ${e.rutas} rutas.`
      );
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudieron borrar los datos');
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
          tab === 'infraestructura' || tab === 'incidencias' || tab === 'datos' ? null : (
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
          )
        }
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'zonas', label: 'Zonas' },
            { id: 'rutas', label: 'Rutas' },
            { id: 'infraestructura', label: 'Infraestructura' },
            { id: 'incidencias', label: 'Incidencias' },
            { id: 'datos', label: 'Datos de prueba' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMensaje('');
                setError('');
              }}
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
        {mensaje && <p style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 12 }}>{mensaje}</p>}

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
                <th style={th}>Acciones</th>
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
                  <td style={td}>
                    <button
                      onClick={() =>
                        setEditandoUsuario({
                          id_usuario: u.id_usuario,
                          nombre_completo: u.nombre_completo,
                          correo: u.correo,
                          id_rol: u.id_rol,
                          id_zona: u.id_zona || '',
                          contrasena_nueva: '',
                        })
                      }
                      style={{ ...estiloBotonSecundario, padding: '5px 12px', fontSize: 12.5 }}
                    >
                      Editar
                    </button>{' '}
                    <button
                      onClick={() => eliminarUsuario(u)}
                      style={{ ...estiloBotonPeligro, padding: '5px 12px', fontSize: 12.5 }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'datos' ? (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Borrar datos de prueba</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 14 }}>
              Elimina toda la infraestructura (con sus fotos), incidencias, rutas y registros pendientes de
              sincronización, para empezar con datos reales. Los usuarios y las zonas se conservan. Si solo quieres
              quitar algunos, usa las pestañas Infraestructura, Incidencias o Rutas.
            </p>
            <button onClick={limpiarDatos} style={estiloBotonPeligro}>
              Borrar todos los datos de prueba
            </button>
          </div>
        ) : tab === 'infraestructura' ? (
          <AdminInfraestructura zonas={zonas} />
        ) : tab === 'incidencias' ? (
          <AdminIncidencias />
        ) : tab === 'rutas' ? (
          <AdminRutas
            tecnicos={usuarios.filter((u) => u.rol === 'tecnico')}
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
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {zonasConTecnicos.map((z) => (
                <tr key={z.id_zona}>
                  <td style={{ ...td, fontWeight: 600 }}>{z.nombre}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{z.descripcion}</td>
                  <td style={td}>{z.tecnicos}</td>
                  <td style={{ ...td, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setEditandoZona({ id_zona: z.id_zona, nombre: z.nombre, descripcion: z.descripcion || '' })}
                      style={{ ...estiloBotonSecundario, padding: '5px 12px', fontSize: 12.5 }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarZona(z)}
                      style={{ ...estiloBotonPeligro, padding: '5px 12px', fontSize: 12.5 }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editandoUsuario && (
        <Modal titulo="Editar usuario" onCerrar={() => setEditandoUsuario(null)}>
          <form onSubmit={guardarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Etiqueta>Nombre completo</Etiqueta>
              <input
                required
                value={editandoUsuario.nombre_completo}
                onChange={(e) => setEditandoUsuario({ ...editandoUsuario, nombre_completo: e.target.value })}
                style={estiloCampo}
              />
            </div>
            <div>
              <Etiqueta>Correo</Etiqueta>
              <input
                required
                type="email"
                value={editandoUsuario.correo}
                onChange={(e) => setEditandoUsuario({ ...editandoUsuario, correo: e.target.value })}
                style={estiloCampo}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Etiqueta>Rol</Etiqueta>
                <select
                  required
                  value={editandoUsuario.id_rol}
                  onChange={(e) => setEditandoUsuario({ ...editandoUsuario, id_rol: e.target.value })}
                  style={estiloCampo}
                >
                  {roles.map((r) => (
                    <option key={r.id_rol} value={r.id_rol}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Etiqueta>Zona</Etiqueta>
                <select
                  value={editandoUsuario.id_zona}
                  onChange={(e) => setEditandoUsuario({ ...editandoUsuario, id_zona: e.target.value })}
                  style={estiloCampo}
                >
                  <option value="">Sin zona</option>
                  {zonas.map((z) => (
                    <option key={z.id_zona} value={z.id_zona}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Etiqueta>Nueva contraseña (déjala vacía para no cambiarla)</Etiqueta>
              <input
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={editandoUsuario.contrasena_nueva}
                onChange={(e) => setEditandoUsuario({ ...editandoUsuario, contrasena_nueva: e.target.value })}
                style={estiloCampo}
              />
            </div>
            {error && <p style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditandoUsuario(null)} style={estiloBotonSecundario}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando} style={estiloBotonPrimario}>
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editandoZona && (
        <Modal titulo="Editar zona" onCerrar={() => setEditandoZona(null)} ancho={440}>
          <form onSubmit={guardarZona} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Etiqueta>Nombre de la zona</Etiqueta>
              <input
                required
                value={editandoZona.nombre}
                onChange={(e) => setEditandoZona({ ...editandoZona, nombre: e.target.value })}
                style={estiloCampo}
              />
            </div>
            <div>
              <Etiqueta>Descripción</Etiqueta>
              <input
                value={editandoZona.descripcion}
                onChange={(e) => setEditandoZona({ ...editandoZona, descripcion: e.target.value })}
                style={estiloCampo}
              />
            </div>
            {error && <p style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditandoZona(null)} style={estiloBotonSecundario}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando} style={estiloBotonPrimario}>
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
