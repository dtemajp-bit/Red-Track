const pool = require('../config/db');
const { validarNodo } = require('./nodoController');

const TIPOS_VALIDOS = ['nodo', 'cable', 'incidencia'];

// Lista los registros del usuario autenticado que aún no se han sincronizado.
// Estos representan datos guardados localmente (ej. sin conexión) pendientes de enviar.
async function listarPendientes(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT id_registro, tipo_entidad, datos_json, creado_en
       FROM registros_pendientes_sync
       WHERE id_usuario = ? AND sincronizado = FALSE
       ORDER BY creado_en ASC`,
      [req.usuario.id_usuario]
    );
    res.json(filas);
  } catch (error) {
    console.error('Error al listar pendientes de sincronización:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Guarda un registro pendiente (lo crea el cliente cuando trabaja sin conexión
// y necesita encolar el dato para enviarlo más tarde).
async function crearPendiente(req, res) {
  const { tipo_entidad, datos } = req.body;

  if (!TIPOS_VALIDOS.includes(tipo_entidad) || !datos) {
    return res
      .status(400)
      .json({ mensaje: `tipo_entidad debe ser uno de: ${TIPOS_VALIDOS.join(', ')}, y datos es requerido` });
  }

  try {
    const [resultado] = await pool.query(
      'INSERT INTO registros_pendientes_sync (id_usuario, tipo_entidad, datos_json) VALUES (?, ?, ?)',
      [req.usuario.id_usuario, tipo_entidad, JSON.stringify(datos)]
    );
    res.status(201).json({ id_registro: resultado.insertId, mensaje: 'Registro guardado localmente' });
  } catch (error) {
    console.error('Error al crear registro pendiente:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Aplica un registro pendiente: inserta la entidad real (nodo o incidencia)
// usando los datos guardados, y marca el registro como sincronizado. Todo en una
// transacción: si falla el insert, el registro sigue pendiente.
async function sincronizarUno(req, res) {
  const conexion = await pool.getConnection();
  try {
    const [[registro]] = await conexion.query(
      'SELECT * FROM registros_pendientes_sync WHERE id_registro = ? AND id_usuario = ?',
      [req.params.id, req.usuario.id_usuario]
    );
    if (!registro) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }
    if (registro.sincronizado) {
      return res.status(409).json({ mensaje: 'Este registro ya fue sincronizado' });
    }

    const datos = typeof registro.datos_json === 'string' ? JSON.parse(registro.datos_json) : registro.datos_json;

    await conexion.beginTransaction();

    if (registro.tipo_entidad === 'incidencia') {
      if (!datos.descripcion) throw Object.assign(new Error('datos incompletos'), { codigoHttp: 400 });
      await conexion.query(
        'INSERT INTO incidencias (id_nodo, id_usuario_reporta, descripcion, prioridad) VALUES (?, ?, ?, ?)',
        [datos.id_nodo || null, req.usuario.id_usuario, datos.descripcion, datos.prioridad || 'media']
      );
    } else if (registro.tipo_entidad === 'nodo') {
      const errorValidacion = validarNodo(datos);
      if (errorValidacion) throw Object.assign(new Error(errorValidacion), { codigoHttp: 400 });
      await conexion.query(
        `INSERT INTO nodos (codigo, tipo, latitud, longitud, estado, observaciones, id_zona)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(datos.codigo).trim(),
          datos.tipo,
          datos.latitud,
          datos.longitud,
          datos.estado || 'activo',
          datos.observaciones || null,
          datos.id_zona || req.usuario.id_zona || null,
        ]
      );
    }

    await conexion.query(
      'UPDATE registros_pendientes_sync SET sincronizado = TRUE, sincronizado_en = NOW() WHERE id_registro = ?',
      [req.params.id]
    );
    await conexion.commit();

    res.json({ mensaje: 'Registro sincronizado correctamente' });
  } catch (error) {
    await conexion.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un nodo con ese código' });
    }
    if (error.codigoHttp) {
      return res.status(error.codigoHttp).json({ mensaje: error.message });
    }
    console.error('Error al sincronizar registro:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    conexion.release();
  }
}

// Historial de actividad registrada: puntos de infraestructura e incidencias,
// indicando si se enviaron en línea o se guardaron antes sin conexión y se
// sincronizaron después. Un técnico ve lo suyo; el administrador/supervisor ve
// todo (y puede filtrar con ?id_tecnico=).
async function historial(req, res) {
  const esGestor = ['administrador', 'supervisor'].includes(req.usuario.rol);
  const idFiltro = esGestor ? Number(req.query.id_tecnico) || null : req.usuario.id_usuario;
  const limite = Math.min(Number(req.query.limite) || 50, 200);

  const filtroNodo = idFiltro ? 'WHERE n.id_usuario_registra = ?' : '';
  const filtroInc = idFiltro ? 'WHERE i.id_usuario_reporta = ?' : '';
  const params = idFiltro ? [idFiltro, idFiltro, limite] : [limite];

  try {
    const [filas] = await pool.query(
      `SELECT * FROM (
         SELECT 'nodo' AS tipo, n.id_nodo AS id, n.codigo AS detalle, u.nombre_completo AS tecnico,
                n.creado_en AS sincronizado_en, n.capturado_en
         FROM nodos n LEFT JOIN usuarios u ON n.id_usuario_registra = u.id_usuario
         ${filtroNodo}
         UNION ALL
         SELECT 'incidencia' AS tipo, i.id_incidencia AS id, LEFT(i.descripcion, 80) AS detalle,
                u.nombre_completo AS tecnico, i.creado_en AS sincronizado_en, i.capturado_en
         FROM incidencias i JOIN usuarios u ON i.id_usuario_reporta = u.id_usuario
         ${filtroInc}
       ) actividad
       ORDER BY sincronizado_en DESC
       LIMIT ?`,
      params
    );
    res.json(
      filas.map((f) => ({
        ...f,
        // Se considera "sin conexión" si pasó más de 2 minutos entre que se capturó y llegó al servidor.
        origen:
          f.capturado_en && new Date(f.sincronizado_en) - new Date(f.capturado_en) > 120000
            ? 'sin_conexion'
            : 'en_linea',
      }))
    );
  } catch (error) {
    console.error('Error al listar historial de sincronización:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

// Resumen por técnico (administración): qué tiene pendiente en el servidor,
// cuánto registró y cuándo fue su última actividad.
async function resumenPorTecnico(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo AS tecnico, u.activo,
              (SELECT COUNT(*) FROM registros_pendientes_sync p
                WHERE p.id_usuario = u.id_usuario AND p.sincronizado = FALSE) AS pendientes_servidor,
              (SELECT COUNT(*) FROM nodos n WHERE n.id_usuario_registra = u.id_usuario) AS nodos,
              (SELECT COUNT(*) FROM incidencias i WHERE i.id_usuario_reporta = u.id_usuario) AS incidencias,
              (SELECT COUNT(*) FROM nodos n
                WHERE n.id_usuario_registra = u.id_usuario AND TIMESTAMPDIFF(SECOND, n.capturado_en, n.creado_en) > 120)
              + (SELECT COUNT(*) FROM incidencias i
                WHERE i.id_usuario_reporta = u.id_usuario AND TIMESTAMPDIFF(SECOND, i.capturado_en, i.creado_en) > 120) AS desde_sin_conexion,
              (SELECT MAX(n.creado_en) FROM nodos n WHERE n.id_usuario_registra = u.id_usuario) AS ultimo_nodo,
              (SELECT MAX(i.creado_en) FROM incidencias i WHERE i.id_usuario_reporta = u.id_usuario) AS ultima_incidencia
       FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol AND r.nombre = 'tecnico'
       ORDER BY u.nombre_completo`
    );
    res.json(
      filas.map(({ ultimo_nodo, ultima_incidencia, ...f }) => {
        const fechas = [ultimo_nodo, ultima_incidencia].filter(Boolean).map((d) => new Date(d));
        return { ...f, ultima_actividad: fechas.length ? new Date(Math.max(...fechas)) : null };
      })
    );
  } catch (error) {
    console.error('Error en resumen de sincronización:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { listarPendientes, crearPendiente, sincronizarUno, historial, resumenPorTecnico };
