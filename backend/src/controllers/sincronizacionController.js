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

module.exports = { listarPendientes, crearPendiente, sincronizarUno };
