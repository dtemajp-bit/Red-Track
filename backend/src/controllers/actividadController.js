const pool = require('../config/db');
const { MANO_OBRA, MATERIALES, fusionarCatalogo, leerLineas } = require('../db/catalogoInicial');

// Estados: pendiente -> en_ruta (voy hacia el cliente) -> iniciada (ya en el sitio; se registra mano de obra e inventario) -> completada.
const esGestor = (rol) => ['administrador', 'supervisor'].includes(rol);
const esAdmin = (rol) => rol === 'administrador';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const texto = (v, max) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
// Las cantidades siempre son números enteros (no se aceptan decimales como 0.1).
const entero = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const numero = entero;
const ESTADOS = ['pendiente', 'en_ruta', 'iniciada', 'completada'];

function error500(res, mensaje, error) {
  console.error(mensaje, error);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
}

const COLUMNAS_ACTIVIDAD = `a.id_actividad, a.orden_trabajo, a.tipo, a.caja_terminal, a.id_tecnico,
  DATE_FORMAT(a.fecha_programada, '%Y-%m-%d') AS fecha_programada, a.ventana_inicio, a.ventana_fin,
  a.cliente, a.telefono, a.direccion, a.descripcion, a.estado, a.iniciado_en, a.cerrado_en,
  a.notas_cierre, u.nombre_completo AS tecnico`;

async function buscarActividad(id, conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${COLUMNAS_ACTIVIDAD} FROM actividades a JOIN usuarios u ON a.id_tecnico = u.id_usuario WHERE a.id_actividad = ?`,
    [id]
  );
  return filas[0] || null;
}

// El técnico solo ve sus actividades; administrador y supervisor ven todas.
function puedeVer(req, act) {
  return esGestor(req.usuario.rol) || act.id_tecnico === req.usuario.id_usuario;
}

// Administrador: opera cualquier actividad. Técnico y supervisor: solo las asignadas a ellos
// (el supervisor supervisa las demás, sin modificarlas, y apoya trabajando en las suyas).
const puedeOperar = (req, act) => esAdmin(req.usuario.rol) || act.id_tecnico === req.usuario.id_usuario;

// Quién puede registrar mano de obra e inventario: el administrador siempre; el responsable solo con la orden en ruta.
function permisoLineas(req, act) {
  if (esAdmin(req.usuario.rol)) return null;
  if (act.id_tecnico !== req.usuario.id_usuario) {
    return { codigo: 403, mensaje: esGestor(req.usuario.rol) ? 'Como supervisor solo puedes supervisar esta actividad' : 'Esta actividad no es tuya' };
  }
  if (act.estado === 'pendiente' || act.estado === 'en_ruta') return { codigo: 409, mensaje: 'Pulsa "Iniciar actividad" para registrar mano de obra e inventario' };
  if (act.estado === 'completada') return { codigo: 409, mensaje: 'La orden está completada; pide al administrador que la reabra' };
  return null;
}

// ---------------------------------------------------------------- actividades
async function listarActividades(req, res) {
  const { fecha, estado, id_tecnico } = req.query;
  const condiciones = [];
  const valores = [];
  if (esGestor(req.usuario.rol)) {
    if (id_tecnico) { condiciones.push('a.id_tecnico = ?'); valores.push(Number(id_tecnico)); }
  } else {
    condiciones.push('a.id_tecnico = ?'); valores.push(req.usuario.id_usuario);
  }
  if (fecha && FECHA.test(fecha)) { condiciones.push('a.fecha_programada = ?'); valores.push(fecha); }
  if (estado && ESTADOS.includes(estado)) { condiciones.push('a.estado = ?'); valores.push(estado); }
  try {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS_ACTIVIDAD}
       FROM actividades a JOIN usuarios u ON a.id_tecnico = u.id_usuario
       ${condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : ''}
       ORDER BY a.fecha_programada DESC, (a.ventana_inicio IS NULL), a.ventana_inicio, a.id_actividad DESC
       LIMIT 500`,
      valores
    );
    res.json(filas);
  } catch (e) { error500(res, 'Error al listar actividades:', e); }
}

async function obtenerActividad(req, res) {
  try {
    const act = await buscarActividad(req.params.id);
    if (!act) return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    if (!puedeVer(req, act)) return res.status(403).json({ mensaje: 'Esta actividad no es tuya' });
    const [mano_obra] = await pool.query(
      `SELECT l.id_linea, l.id_mano_obra, m.codigo, m.descripcion, m.unidad, l.cantidad + 0 AS cantidad
       FROM actividad_mano_obra l JOIN mano_obra_catalogo m ON l.id_mano_obra = m.id_mano_obra
       WHERE l.id_actividad = ? ORDER BY l.id_linea`, [act.id_actividad]);
    const [materiales] = await pool.query(
      `SELECT l.id_linea, l.id_material, m.codigo, m.descripcion, m.unidad, l.cantidad + 0 AS cantidad
       FROM actividad_materiales l JOIN materiales m ON l.id_material = m.id_material
       WHERE l.id_actividad = ? ORDER BY l.id_linea`, [act.id_actividad]);
    const [recursoCantidad] = await pool.query(
      `SELECT i.id_material, m.codigo, m.descripcion, m.unidad, i.cantidad + 0 AS cantidad
       FROM inventario_tecnico i JOIN materiales m ON i.id_material = m.id_material
       WHERE i.id_tecnico = ? AND i.cantidad > 0 AND m.activo = 1 AND m.con_serie = 0`, [act.id_tecnico]);
    const [seriesDisponibles] = await pool.query(
      `SELECT s.id_serie, s.serie, m.id_material, m.codigo, m.descripcion, m.unidad
       FROM series_material s JOIN materiales m ON s.id_material = m.id_material
       WHERE s.id_tecnico = ? AND s.id_actividad IS NULL AND m.activo = 1 ORDER BY m.descripcion, s.serie`, [act.id_tecnico]);
    const [series_instaladas] = await pool.query(
      `SELECT s.id_serie, s.serie, m.id_material, m.codigo, m.descripcion, m.unidad
       FROM series_material s JOIN materiales m ON s.id_material = m.id_material
       WHERE s.id_actividad = ? ORDER BY m.descripcion, s.serie`, [act.id_actividad]);
    const agrupadas = {};
    for (const f of seriesDisponibles) {
      if (!agrupadas[f.id_material]) agrupadas[f.id_material] = { id_material: f.id_material, codigo: f.codigo, descripcion: f.descripcion, unidad: f.unidad, con_serie: true, cantidad: 0, series: [] };
      agrupadas[f.id_material].series.push({ id_serie: f.id_serie, serie: f.serie });
      agrupadas[f.id_material].cantidad += 1;
    }
    const recurso = [...recursoCantidad.map((r) => ({ ...r, cantidad: Number(r.cantidad), con_serie: false })), ...Object.values(agrupadas)]
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    const [catalogo_mano_obra] = await pool.query(
      'SELECT id_mano_obra, codigo, descripcion, unidad FROM mano_obra_catalogo WHERE activo = 1 ORDER BY codigo');
    res.json({
      ...act,
      mano_obra: mano_obra.map((l) => ({ ...l, cantidad: Number(l.cantidad) })),
      materiales: materiales.map((l) => ({ ...l, cantidad: Number(l.cantidad) })),
      recurso,
      series_instaladas,
      catalogo_mano_obra,
      puede_editar_lineas: permisoLineas(req, act) === null,
      puede_operar: puedeOperar(req, act),
    });
  } catch (e) { error500(res, 'Error al obtener actividad:', e); }
}

function leerCampos(body) {
  return {
    orden_trabajo: texto(body.orden_trabajo, 60),
    tipo: texto(body.tipo, 60),
    caja_terminal: texto(body.caja_terminal, 60),
    fecha_programada: texto(body.fecha_programada, 10),
    ventana_inicio: texto(body.ventana_inicio, 5),
    ventana_fin: texto(body.ventana_fin, 5),
    cliente: texto(body.cliente, 150),
    telefono: texto(body.telefono, 30),
    direccion: texto(body.direccion, 255),
    descripcion: texto(body.descripcion, 4000),
  };
}

function validarCampos(c) {
  if (!c.orden_trabajo) return 'La orden de trabajo es requerida';
  if (!c.fecha_programada || !FECHA.test(c.fecha_programada)) return 'La fecha programada es requerida (AAAA-MM-DD)';
  if ((c.ventana_inicio && !HORA.test(c.ventana_inicio)) || (c.ventana_fin && !HORA.test(c.ventana_fin))) return 'La ventana de entrega debe tener formato HH:MM';
  return null;
}

async function tecnicoValido(id) {
  const [[u]] = await pool.query(
    `SELECT u.id_usuario FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol WHERE u.id_usuario = ? AND u.activo = 1`, [id]);
  return !!u;
}

async function crearActividad(req, res) {
  const c = leerCampos(req.body);
  const id_tecnico = Number(req.body.id_tecnico);
  const err = validarCampos(c) || (!id_tecnico ? 'Elige el técnico responsable' : null);
  if (err) return res.status(400).json({ mensaje: err });
  try {
    if (!(await tecnicoValido(id_tecnico))) return res.status(400).json({ mensaje: 'El técnico elegido no existe o está inactivo' });
    const [[dup]] = await pool.query('SELECT id_actividad FROM actividades WHERE orden_trabajo = ?', [c.orden_trabajo]);
    if (dup) return res.status(409).json({ mensaje: 'Ya existe una actividad con esa orden de trabajo' });
    const [r] = await pool.query(
      `INSERT INTO actividades (orden_trabajo, tipo, caja_terminal, id_tecnico, fecha_programada, ventana_inicio, ventana_fin,
                                cliente, telefono, direccion, descripcion, id_creador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.orden_trabajo, c.tipo, c.caja_terminal, id_tecnico, c.fecha_programada, c.ventana_inicio, c.ventana_fin,
       c.cliente, c.telefono, c.direccion, c.descripcion, req.usuario.id_usuario]);
    res.status(201).json({ id_actividad: r.insertId, mensaje: 'Actividad creada correctamente' });
  } catch (e) { error500(res, 'Error al crear actividad:', e); }
}

async function actualizarActividad(req, res) {
  const c = leerCampos(req.body);
  const id_tecnico = Number(req.body.id_tecnico);
  const err = validarCampos(c) || (!id_tecnico ? 'Elige el técnico responsable' : null);
  if (err) return res.status(400).json({ mensaje: err });
  try {
    const act = await buscarActividad(req.params.id);
    if (!act) return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    if (id_tecnico !== act.id_tecnico) {
      const [[uso]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM actividad_materiales WHERE id_actividad = ?) +
                (SELECT COUNT(*) FROM series_material WHERE id_actividad = ?) AS n`, [act.id_actividad, act.id_actividad]);
      if (uso.n > 0) return res.status(409).json({ mensaje: 'La actividad ya tiene material instalado; no se puede cambiar de técnico' });
      if (!(await tecnicoValido(id_tecnico))) return res.status(400).json({ mensaje: 'El técnico elegido no existe o está inactivo' });
    }
    const [[dup]] = await pool.query('SELECT id_actividad FROM actividades WHERE orden_trabajo = ? AND id_actividad <> ?', [c.orden_trabajo, act.id_actividad]);
    if (dup) return res.status(409).json({ mensaje: 'Ya existe otra actividad con esa orden de trabajo' });
    await pool.query(
      `UPDATE actividades SET orden_trabajo=?, tipo=?, caja_terminal=?, id_tecnico=?, fecha_programada=?, ventana_inicio=?, ventana_fin=?,
              cliente=?, telefono=?, direccion=?, descripcion=? WHERE id_actividad=?`,
      [c.orden_trabajo, c.tipo, c.caja_terminal, id_tecnico, c.fecha_programada, c.ventana_inicio, c.ventana_fin,
       c.cliente, c.telefono, c.direccion, c.descripcion, act.id_actividad]);
    res.json({ mensaje: 'Actividad actualizada correctamente' });
  } catch (e) { error500(res, 'Error al actualizar actividad:', e); }
}

// Al eliminar una actividad, el material instalado vuelve a las existencias del técnico.
async function eliminarActividad(req, res) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const act = await buscarActividad(req.params.id, conexion);
    if (!act) { await conexion.rollback(); return res.status(404).json({ mensaje: 'Actividad no encontrada' }); }
    const [lineas] = await conexion.query('SELECT id_material, cantidad FROM actividad_materiales WHERE id_actividad = ?', [act.id_actividad]);
    for (const l of lineas) await devolverExistencia(conexion, act.id_tecnico, l.id_material, Number(l.cantidad));
    await conexion.query('UPDATE series_material SET id_actividad = NULL WHERE id_actividad = ?', [act.id_actividad]);
    await conexion.query('DELETE FROM actividad_materiales WHERE id_actividad = ?', [act.id_actividad]);
    await conexion.query('DELETE FROM actividad_mano_obra WHERE id_actividad = ?', [act.id_actividad]);
    await conexion.query('DELETE FROM actividades WHERE id_actividad = ?', [act.id_actividad]);
    await conexion.commit();
    res.json({ mensaje: 'Actividad eliminada correctamente' });
  } catch (e) {
    await conexion.rollback().catch(() => {});
    error500(res, 'Error al eliminar actividad:', e);
  } finally { conexion.release(); }
}

async function cambiarEstado(req, res, desde, hacia, extra) {
  try {
    const act = await buscarActividad(req.params.id);
    if (!act) return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    if (!puedeVer(req, act)) return res.status(403).json({ mensaje: 'Esta actividad no es tuya' });
    if (!puedeOperar(req, act)) return res.status(403).json({ mensaje: 'Como supervisor solo puedes supervisar esta actividad' });
    if (act.estado !== desde) {
      return res.status(409).json({ mensaje: `La actividad está en estado "${act.estado.replace('_', ' ')}"; no se puede ${extra.verbo}` });
    }
    await pool.query(extra.sql, [...(extra.valores ? extra.valores(req) : []), act.id_actividad]);
    res.json({ estado: hacia, mensaje: extra.ok });
  } catch (e) { error500(res, 'Error al cambiar el estado de la actividad:', e); }
}

const enRutaActividad = (req, res) => cambiarEstado(req, res, 'pendiente', 'en_ruta', {
  verbo: 'salir en ruta', ok: 'Estás en ruta hacia el cliente',
  sql: "UPDATE actividades SET estado = 'en_ruta' WHERE id_actividad = ?",
});
const iniciarActividad = (req, res) => cambiarEstado(req, res, 'en_ruta', 'iniciada', {
  verbo: 'iniciar', ok: 'Actividad iniciada: ya puedes registrar mano de obra e inventario',
  sql: "UPDATE actividades SET estado = 'iniciada', iniciado_en = NOW() WHERE id_actividad = ?",
});
const completarActividad = (req, res) => cambiarEstado(req, res, 'iniciada', 'completada', {
  verbo: 'completar', ok: 'Orden completada correctamente',
  sql: "UPDATE actividades SET estado = 'completada', cerrado_en = NOW(), notas_cierre = ? WHERE id_actividad = ?",
  valores: (r) => [texto(r.body && r.body.notas_cierre, 2000)],
});
const reabrirActividad = (req, res) => cambiarEstado(req, res, 'completada', 'iniciada', {
  verbo: 'reabrir', ok: 'Orden reabierta: vuelve a estar iniciada',
  sql: "UPDATE actividades SET estado = 'iniciada', cerrado_en = NULL WHERE id_actividad = ?",
});

// ---------------------------------------------------------------- técnicos
async function listarTecnicos(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, r.nombre AS rol
       FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.activo = 1 AND r.nombre IN ('tecnico', 'supervisor') ORDER BY u.nombre_completo`);
    res.json(filas);
  } catch (e) { error500(res, 'Error al listar técnicos:', e); }
}

// ---------------------------------------------------------------- catálogos
function catalogo(tabla, id, usoTabla, conSerie = false) {
  return {
    listar: async (req, res) => {
      try {
        const [filas] = await pool.query(
          `SELECT ${id}, codigo, descripcion, unidad, activo${conSerie ? ', con_serie' : ''} FROM ${tabla} ${req.query.todos ? '' : 'WHERE activo = 1'} ORDER BY codigo`);
        res.json(filas);
      } catch (e) { error500(res, `Error al listar ${tabla}:`, e); }
    },
    crear: async (req, res) => {
      const codigo = texto(req.body.codigo, 60);
      const descripcion = texto(req.body.descripcion, 255);
      const unidad = texto(req.body.unidad, 20) || 'UND';
      if (!codigo || !descripcion) return res.status(400).json({ mensaje: 'El código y la descripción son requeridos' });
      try {
        const [[dup]] = await pool.query(`SELECT ${id} FROM ${tabla} WHERE codigo = ?`, [codigo]);
        if (dup) return res.status(409).json({ mensaje: 'Ya existe un registro con ese código' });
        const [r] = conSerie
          ? await pool.query(`INSERT INTO ${tabla} (codigo, descripcion, unidad, con_serie) VALUES (?, ?, ?, ?)`, [codigo, descripcion, unidad, req.body.con_serie ? 1 : 0])
          : await pool.query(`INSERT INTO ${tabla} (codigo, descripcion, unidad) VALUES (?, ?, ?)`, [codigo, descripcion, unidad]);
        res.status(201).json({ [id]: r.insertId, mensaje: 'Registro creado correctamente' });
      } catch (e) { error500(res, `Error al crear en ${tabla}:`, e); }
    },
    actualizar: async (req, res) => {
      const codigo = texto(req.body.codigo, 60);
      const descripcion = texto(req.body.descripcion, 255);
      const unidad = texto(req.body.unidad, 20) || 'UND';
      const activo = req.body.activo === false || req.body.activo === 0 ? 0 : 1;
      if (!codigo || !descripcion) return res.status(400).json({ mensaje: 'El código y la descripción son requeridos' });
      try {
        const [[dup]] = await pool.query(`SELECT ${id} FROM ${tabla} WHERE codigo = ? AND ${id} <> ?`, [codigo, req.params.id]);
        if (dup) return res.status(409).json({ mensaje: 'Ya existe otro registro con ese código' });
        let r;
        if (conSerie) {
          const [[previo]] = await pool.query('SELECT con_serie FROM materiales WHERE id_material = ?', [req.params.id]);
          if (!previo) return res.status(404).json({ mensaje: 'Registro no encontrado' });
          const nuevo = req.body.con_serie ? 1 : 0;
          if (nuevo !== previo.con_serie) {
            const [[tiene]] = await pool.query(
              `SELECT (SELECT COUNT(*) FROM series_material WHERE id_material = ?) +
                      (SELECT COUNT(*) FROM inventario_tecnico WHERE id_material = ? AND cantidad > 0) +
                      (SELECT COUNT(*) FROM actividad_materiales WHERE id_material = ?) AS n`, [req.params.id, req.params.id, req.params.id]);
            if (tiene.n > 0) return res.status(409).json({ mensaje: 'No se puede cambiar el control por serie: el material ya tiene existencias o usos' });
          }
          [r] = await pool.query('UPDATE materiales SET codigo=?, descripcion=?, unidad=?, activo=?, con_serie=? WHERE id_material=?', [codigo, descripcion, unidad, activo, nuevo, req.params.id]);
        } else {
          [r] = await pool.query(`UPDATE ${tabla} SET codigo=?, descripcion=?, unidad=?, activo=? WHERE ${id}=?`, [codigo, descripcion, unidad, activo, req.params.id]);
        }
        if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Registro no encontrado' });
        res.json({ mensaje: 'Registro actualizado correctamente' });
      } catch (e) { error500(res, `Error al actualizar ${tabla}:`, e); }
    },
    // Si ya se usó en alguna actividad solo se desactiva, para no perder el historial.
    eliminar: async (req, res) => {
      try {
        const [[uso]] = conSerie
          ? await pool.query(
              `SELECT (SELECT COUNT(*) FROM actividad_materiales WHERE id_material = ?) +
                      (SELECT COUNT(*) FROM series_material WHERE id_material = ? AND id_actividad IS NOT NULL) AS n`, [req.params.id, req.params.id])
          : await pool.query(`SELECT COUNT(*) AS n FROM ${usoTabla} WHERE ${id} = ?`, [req.params.id]);
        if (uso.n > 0) {
          await pool.query(`UPDATE ${tabla} SET activo = 0 WHERE ${id} = ?`, [req.params.id]);
          return res.json({ desactivado: true, mensaje: 'Ya se usó en actividades, por eso se desactivó en lugar de borrarse' });
        }
        if (tabla === 'materiales') {
          await pool.query('DELETE FROM inventario_tecnico WHERE id_material = ?', [req.params.id]);
          await pool.query('DELETE FROM series_material WHERE id_material = ?', [req.params.id]);
        }
        const [r] = await pool.query(`DELETE FROM ${tabla} WHERE ${id} = ?`, [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Registro no encontrado' });
        res.json({ mensaje: 'Registro eliminado correctamente' });
      } catch (e) { error500(res, `Error al eliminar de ${tabla}:`, e); }
    },
  };
}
const mat = catalogo('materiales', 'id_material', 'actividad_materiales', true);
const mo = catalogo('mano_obra_catalogo', 'id_mano_obra', 'actividad_mano_obra');

// Importa una lista pegada (o el catálogo sugerido) sin duplicar lo que ya existe.
const importarCatalogo = (tabla, sugeridos) => async (req, res) => {
  try {
    const items = req.body.sugeridos ? sugeridos : leerLineas(req.body.texto);
    if (items.length === 0) return res.status(400).json({ mensaje: 'Escribe al menos una línea para importar' });
    const r = await fusionarCatalogo(pool, tabla, items);
    res.status(201).json({ ...r, mensaje: `${r.agregados} agregado(s)` + (r.existian ? `; ${r.existian} ya existían y se omitieron` : '') });
  } catch (e) { error500(res, `Error al importar en ${tabla}:`, e); }
};
const importarMateriales = importarCatalogo('materiales', MATERIALES);
const importarManoObra = importarCatalogo('mano_obra_catalogo', MANO_OBRA);

// ---------------------------------------------------------------- existencias del técnico
async function verInventarioTecnico(req, res) {
  const idTecnico = Number(req.params.idTecnico);
  if (!esGestor(req.usuario.rol) && idTecnico !== req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: 'Solo puedes ver tu propio inventario' });
  }
  try {
    const [filas] = await pool.query(
      `SELECT m.id_material, m.codigo, m.descripcion, m.unidad, m.con_serie, COALESCE(i.cantidad, 0) + 0 AS cantidad
       FROM materiales m LEFT JOIN inventario_tecnico i ON i.id_material = m.id_material AND i.id_tecnico = ?
       WHERE m.activo = 1 ORDER BY m.descripcion`, [idTecnico]);
    const [series] = await pool.query(
      `SELECT s.id_serie, s.serie, s.id_material, s.id_actividad, a.orden_trabajo
       FROM series_material s LEFT JOIN actividades a ON s.id_actividad = a.id_actividad
       WHERE s.id_tecnico = ? ORDER BY s.serie`, [idTecnico]);
    res.json(filas.map((f) => {
      if (!f.con_serie) return { ...f, cantidad: Number(f.cantidad) };
      const propias = series.filter((s) => s.id_material === f.id_material);
      return { ...f, cantidad: propias.filter((s) => !s.id_actividad).length, series: propias };
    }));
  } catch (e) { error500(res, 'Error al consultar el inventario:', e); }
}

async function fijarInventarioTecnico(req, res) {
  const idTecnico = Number(req.params.idTecnico);
  const id_material = Number(req.body.id_material);
  const cantidad = numero(req.body.cantidad);
  if (!idTecnico || !id_material || !(cantidad >= 0)) return res.status(400).json({ mensaje: 'Material y cantidad (número entero, 0 o más) son requeridos' });
  try {
    if (!(await tecnicoValido(idTecnico))) return res.status(400).json({ mensaje: 'El técnico no existe o está inactivo' });
    const [[m]] = await pool.query('SELECT id_material, con_serie FROM materiales WHERE id_material = ?', [id_material]);
    if (!m) return res.status(404).json({ mensaje: 'Material no encontrado' });
    if (m.con_serie) return res.status(400).json({ mensaje: 'Este material se controla por número de serie: agrega las series en lugar de una cantidad' });
    await pool.query(
      `INSERT INTO inventario_tecnico (id_tecnico, id_material, cantidad) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)`, [idTecnico, id_material, cantidad]);
    res.json({ mensaje: 'Existencias actualizadas' });
  } catch (e) { error500(res, 'Error al actualizar existencias:', e); }
}

// Suma la misma cantidad de un material (sin serie) a todos los técnicos y supervisores activos.
async function agregarATodos(req, res) {
  const id_material = Number(req.body.id_material);
  const cantidad = entero(req.body.cantidad);
  if (!id_material || !(cantidad > 0)) return res.status(400).json({ mensaje: 'Elige el material e indica una cantidad entera mayor a 0' });
  try {
    const [[m]] = await pool.query('SELECT con_serie FROM materiales WHERE id_material = ? AND activo = 1', [id_material]);
    if (!m) return res.status(404).json({ mensaje: 'Material no encontrado' });
    if (m.con_serie) return res.status(400).json({ mensaje: 'Este material se controla por serie: agrégalo técnico por técnico con su escáner' });
    const [tecnicos] = await pool.query(
      `SELECT u.id_usuario FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.activo = 1 AND r.nombre IN ('tecnico', 'supervisor')`);
    if (tecnicos.length === 0) return res.status(400).json({ mensaje: 'No hay técnicos activos' });
    await pool.query(
      `INSERT INTO inventario_tecnico (id_tecnico, id_material, cantidad) VALUES ?
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
      [tecnicos.map((t) => [t.id_usuario, id_material, cantidad])]);
    res.json({ tecnicos: tecnicos.length, mensaje: `Se sumaron ${cantidad} a ${tecnicos.length} técnico(s)` });
  } catch (e) { error500(res, 'Error al agregar a todos:', e); }
}

async function devolverExistencia(conexion, idTecnico, idMaterial, cantidad) {
  await conexion.query(
    `INSERT INTO inventario_tecnico (id_tecnico, id_material, cantidad) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`, [idTecnico, idMaterial, cantidad]);
}

// ---------------------------------------------------------------- mano de obra de la actividad
async function conActividad(req, res, accion) {
  try {
    const act = await buscarActividad(req.params.id);
    if (!act) return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    if (!puedeVer(req, act)) return res.status(403).json({ mensaje: 'Esta actividad no es tuya' });
    const negado = permisoLineas(req, act);
    if (negado) return res.status(negado.codigo).json({ mensaje: negado.mensaje });
    await accion(act);
  } catch (e) { error500(res, 'Error en la actividad:', e); }
}

const agregarManoObra = (req, res) => conActividad(req, res, async (act) => {
  const id_mano_obra = Number(req.body.id_mano_obra);
  const cantidad = numero(req.body.cantidad);
  if (!id_mano_obra || !(cantidad > 0)) return res.status(400).json({ mensaje: 'Elige la mano de obra e indica una cantidad entera mayor a 0' });
  const [[m]] = await pool.query('SELECT id_mano_obra FROM mano_obra_catalogo WHERE id_mano_obra = ? AND activo = 1', [id_mano_obra]);
  if (!m) return res.status(404).json({ mensaje: 'Mano de obra no encontrada en el catálogo' });
  await pool.query(
    `INSERT INTO actividad_mano_obra (id_actividad, id_mano_obra, cantidad) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`, [act.id_actividad, id_mano_obra, cantidad]);
  res.status(201).json({ mensaje: 'Mano de obra agregada' });
});

const cambiarManoObra = (req, res) => conActividad(req, res, async (act) => {
  const cantidad = numero(req.body.cantidad);
  if (!(cantidad > 0)) return res.status(400).json({ mensaje: 'La cantidad debe ser un número entero mayor a 0' });
  const [r] = await pool.query('UPDATE actividad_mano_obra SET cantidad = ? WHERE id_linea = ? AND id_actividad = ?', [cantidad, req.params.idLinea, act.id_actividad]);
  if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Línea no encontrada' });
  res.json({ mensaje: 'Cantidad actualizada' });
});

const quitarManoObra = (req, res) => conActividad(req, res, async (act) => {
  const [r] = await pool.query('DELETE FROM actividad_mano_obra WHERE id_linea = ? AND id_actividad = ?', [req.params.idLinea, act.id_actividad]);
  if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Línea no encontrada' });
  res.json({ mensaje: 'Mano de obra quitada' });
});

// ---------------------------------------------------------------- material (inventario) de la actividad
// Lo instalado sale de las existencias del técnico responsable de la actividad.
async function movimientoMaterial(req, res, act, ejecutar) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await ejecutar(conexion);
    if (resultado && resultado.codigo) { await conexion.rollback(); return res.status(resultado.codigo).json({ mensaje: resultado.mensaje }); }
    await conexion.commit();
    res.status(resultado.creado ? 201 : 200).json({ mensaje: resultado.mensaje });
  } catch (e) {
    await conexion.rollback().catch(() => {});
    error500(res, 'Error al mover material:', e);
  } finally { conexion.release(); }
}

async function descontar(conexion, idTecnico, idMaterial, cantidad) {
  const [[stock]] = await conexion.query('SELECT cantidad + 0 AS cantidad FROM inventario_tecnico WHERE id_tecnico = ? AND id_material = ? FOR UPDATE', [idTecnico, idMaterial]);
  const disponible = stock ? Number(stock.cantidad) : 0;
  if (disponible < cantidad) return { codigo: 400, mensaje: `Existencias insuficientes: el técnico tiene ${disponible} disponible(s)` };
  await conexion.query('UPDATE inventario_tecnico SET cantidad = cantidad - ? WHERE id_tecnico = ? AND id_material = ?', [cantidad, idTecnico, idMaterial]);
  return null;
}

const agregarMaterial = (req, res) => conActividad(req, res, (act) => {
  const id_material = Number(req.body.id_material);
  const cantidad = numero(req.body.cantidad);
  if (!id_material || !(cantidad > 0)) return res.status(400).json({ mensaje: 'Elige el material e indica una cantidad entera mayor a 0' });
  return movimientoMaterial(req, res, act, async (conexion) => {
    const [[m]] = await conexion.query('SELECT id_material, con_serie FROM materiales WHERE id_material = ? AND activo = 1', [id_material]);
    if (!m) return { codigo: 404, mensaje: 'Material no encontrado en el catálogo' };
    if (m.con_serie) return { codigo: 400, mensaje: 'Este material se registra eligiendo su número de serie' };
    const falla = await descontar(conexion, act.id_tecnico, id_material, cantidad);
    if (falla) return falla;
    await conexion.query(
      `INSERT INTO actividad_materiales (id_actividad, id_material, cantidad) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`, [act.id_actividad, id_material, cantidad]);
    return { creado: true, mensaje: 'Material registrado como instalado' };
  });
});

const cambiarMaterial = (req, res) => conActividad(req, res, (act) => {
  const cantidad = numero(req.body.cantidad);
  if (!(cantidad > 0)) return res.status(400).json({ mensaje: 'La cantidad debe ser un número entero mayor a 0' });
  return movimientoMaterial(req, res, act, async (conexion) => {
    const [[linea]] = await conexion.query('SELECT id_material, cantidad + 0 AS cantidad FROM actividad_materiales WHERE id_linea = ? AND id_actividad = ? FOR UPDATE', [req.params.idLinea, act.id_actividad]);
    if (!linea) return { codigo: 404, mensaje: 'Línea no encontrada' };
    const diferencia = cantidad - Number(linea.cantidad);
    if (diferencia > 0) {
      const falla = await descontar(conexion, act.id_tecnico, linea.id_material, diferencia);
      if (falla) return falla;
    } else if (diferencia < 0) {
      await devolverExistencia(conexion, act.id_tecnico, linea.id_material, -diferencia);
    }
    await conexion.query('UPDATE actividad_materiales SET cantidad = ? WHERE id_linea = ?', [cantidad, req.params.idLinea]);
    return { mensaje: 'Cantidad actualizada' };
  });
});

const quitarMaterial = (req, res) => conActividad(req, res, (act) =>
  movimientoMaterial(req, res, act, async (conexion) => {
    const [[linea]] = await conexion.query('SELECT id_material, cantidad + 0 AS cantidad FROM actividad_materiales WHERE id_linea = ? AND id_actividad = ? FOR UPDATE', [req.params.idLinea, act.id_actividad]);
    if (!linea) return { codigo: 404, mensaje: 'Línea no encontrada' };
    await devolverExistencia(conexion, act.id_tecnico, linea.id_material, Number(linea.cantidad));
    await conexion.query('DELETE FROM actividad_materiales WHERE id_linea = ?', [req.params.idLinea]);
    return { mensaje: 'Material devuelto a las existencias del técnico' };
  })
);

// ---------------------------------------------------------------- material con número de serie
// El administrador carga las series que tiene cada técnico (una por línea).
async function agregarSeriesTecnico(req, res) {
  const idTecnico = Number(req.params.idTecnico);
  const id_material = Number(req.body.id_material);
  const lista = Array.isArray(req.body.series) ? req.body.series : String(req.body.series || '').split(/[\n,;]+/);
  const series = [...new Set(lista.map((x) => String(x).trim().slice(0, 80)).filter(Boolean))].slice(0, 500);
  if (!idTecnico || !id_material || series.length === 0) return res.status(400).json({ mensaje: 'Elige el material y escribe al menos una serie' });
  try {
    if (!(await tecnicoValido(idTecnico))) return res.status(400).json({ mensaje: 'El técnico no existe o está inactivo' });
    const [[m]] = await pool.query('SELECT con_serie FROM materiales WHERE id_material = ?', [id_material]);
    if (!m) return res.status(404).json({ mensaje: 'Material no encontrado' });
    if (!m.con_serie) return res.status(400).json({ mensaje: 'Este material se controla por cantidad, no por serie' });
    const [existentes] = await pool.query('SELECT serie FROM series_material WHERE id_material = ? AND serie IN (?)', [id_material, series]);
    const repetidas = new Set(existentes.map((e) => e.serie));
    const nuevas = series.filter((x) => !repetidas.has(x));
    if (nuevas.length > 0) await pool.query('INSERT INTO series_material (id_material, serie, id_tecnico) VALUES ?', [nuevas.map((x) => [id_material, x, idTecnico])]);
    res.status(201).json({
      agregadas: nuevas.length, repetidas: [...repetidas],
      mensaje: `${nuevas.length} serie(s) agregada(s)` + (repetidas.size ? `; ${repetidas.size} ya existían y se omitieron` : ''),
    });
  } catch (e) { error500(res, 'Error al agregar series:', e); }
}

async function eliminarSerie(req, res) {
  try {
    const [r] = await pool.query('DELETE FROM series_material WHERE id_serie = ? AND id_actividad IS NULL', [req.params.idSerie]);
    if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'La serie no existe o ya está instalada en una actividad' });
    res.json({ mensaje: 'Serie eliminada' });
  } catch (e) { error500(res, 'Error al eliminar la serie:', e); }
}

// El responsable elige qué series (unidades) usó en la actividad.
const usarSeries = (req, res) => conActividad(req, res, async (act) => {
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : [req.body.id_serie]).map(Number).filter(Boolean))];
  if (ids.length === 0) return res.status(400).json({ mensaje: 'Elige al menos una serie' });
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [libres] = await conexion.query(
      'SELECT id_serie FROM series_material WHERE id_serie IN (?) AND id_tecnico = ? AND id_actividad IS NULL FOR UPDATE', [ids, act.id_tecnico]);
    if (libres.length !== ids.length) {
      await conexion.rollback();
      return res.status(409).json({ mensaje: 'Alguna serie ya no está disponible para este técnico' });
    }
    await conexion.query('UPDATE series_material SET id_actividad = ? WHERE id_serie IN (?)', [act.id_actividad, ids]);
    await conexion.commit();
    res.status(201).json({ mensaje: ids.length === 1 ? 'Serie registrada como instalada' : `${ids.length} series registradas como instaladas` });
  } catch (e) {
    await conexion.rollback().catch(() => {});
    throw e;
  } finally { conexion.release(); }
});

const quitarSerie = (req, res) => conActividad(req, res, async (act) => {
  const [r] = await pool.query('UPDATE series_material SET id_actividad = NULL WHERE id_serie = ? AND id_actividad = ?', [req.params.idSerie, act.id_actividad]);
  if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Serie no encontrada en esta actividad' });
  res.json({ mensaje: 'Serie devuelta a las existencias del técnico' });
});

module.exports = {
  listarActividades, obtenerActividad, crearActividad, actualizarActividad, eliminarActividad,
  enRutaActividad, iniciarActividad, completarActividad, reabrirActividad, agregarATodos, listarTecnicos,
  listarMateriales: mat.listar, crearMaterial: mat.crear, actualizarMaterial: mat.actualizar, eliminarMaterial: mat.eliminar,
  listarManoObra: mo.listar, crearManoObra: mo.crear, actualizarManoObra: mo.actualizar, eliminarManoObra: mo.eliminar,
  importarMateriales, importarManoObra, verInventarioTecnico, fijarInventarioTecnico, agregarSeriesTecnico, eliminarSerie, usarSeries, quitarSerie,
  agregarManoObra, cambiarManoObra, quitarManoObra, agregarMaterial, cambiarMaterial, quitarMaterial,
};
