const pool = require('../config/db');

const esAdmin = (rol) => rol === 'administrador';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RESPUESTAS = ['cumple', 'no_cumple', 'na'];
const error500 = (res, m, e) => { console.error(m, e); res.status(500).json({ mensaje: 'Error interno del servidor' }); };

const COLUMNAS = `s.id_supervision, s.id_actividad, s.id_supervisor, DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha,
  s.estado, s.puntaje + 0 AS puntaje, s.comentario, a.orden_trabajo, a.tipo, a.cliente, a.direccion,
  a.ventana_inicio, a.ventana_fin, a.estado AS estado_actividad, t.nombre_completo AS tecnico, sp.nombre_completo AS supervisor`;
const UNIONES = `FROM supervisiones s JOIN actividades a ON s.id_actividad = a.id_actividad
  JOIN usuarios t ON a.id_tecnico = t.id_usuario JOIN usuarios sp ON s.id_supervisor = sp.id_usuario`;

// Ruta de supervisión del día: el supervisor ve la suya; el administrador ve todas (o filtra por supervisor).
async function listar(req, res) {
  const { fecha, id_supervisor } = req.query;
  const cond = [];
  const val = [];
  if (esAdmin(req.usuario.rol)) {
    if (id_supervisor) { cond.push('s.id_supervisor = ?'); val.push(Number(id_supervisor)); }
  } else { cond.push('s.id_supervisor = ?'); val.push(req.usuario.id_usuario); }
  if (fecha && FECHA.test(fecha)) { cond.push('s.fecha = ?'); val.push(fecha); }
  try {
    const [filas] = await pool.query(
      `SELECT ${COLUMNAS} ${UNIONES} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY s.fecha DESC, (a.ventana_inicio IS NULL), a.ventana_inicio, s.id_supervision LIMIT 500`, val);
    res.json(filas.map((f) => ({ ...f, puntaje: f.puntaje === null ? null : Number(f.puntaje) })));
  } catch (e) { error500(res, 'Error al listar supervisiones:', e); }
}

async function supervisores(req, res) {
  try {
    const [f] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE r.nombre = 'supervisor' AND u.activo = 1 ORDER BY u.nombre_completo`);
    res.json(f);
  } catch (e) { error500(res, 'Error al listar supervisores:', e); }
}

// Agrega una visita a la ruta. El supervisor la crea para sí mismo; el administrador elige al supervisor.
async function crear(req, res) {
  const id_actividad = Number(req.body.id_actividad);
  const fecha = String(req.body.fecha || '');
  if (!id_actividad || !FECHA.test(fecha)) return res.status(400).json({ mensaje: 'Elige la orden y la fecha de la visita' });
  const id_supervisor = esAdmin(req.usuario.rol) ? Number(req.body.id_supervisor) : req.usuario.id_usuario;
  if (!id_supervisor) return res.status(400).json({ mensaje: 'Elige el supervisor que hará la visita' });
  try {
    const [[act]] = await pool.query('SELECT id_actividad, id_tecnico FROM actividades WHERE id_actividad = ?', [id_actividad]);
    if (!act) return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    const [[sup]] = await pool.query(
      `SELECT u.id_usuario FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol WHERE u.id_usuario = ? AND r.nombre = 'supervisor' AND u.activo = 1`, [id_supervisor]);
    if (!sup) return res.status(400).json({ mensaje: 'El supervisor elegido no existe o está inactivo' });
    if (act.id_tecnico === id_supervisor) return res.status(400).json({ mensaje: 'Un supervisor no puede calificar su propia orden' });
    const [[previa]] = await pool.query('SELECT id_supervision FROM supervisiones WHERE id_actividad = ? AND id_supervisor = ? AND fecha = ?', [id_actividad, id_supervisor, fecha]);
    if (previa) return res.json({ id_supervision: previa.id_supervision, existente: true, mensaje: 'Esa orden ya estaba en la ruta de supervisión' });
    const [r] = await pool.query(
      'INSERT INTO supervisiones (id_actividad, id_supervisor, fecha, id_creador) VALUES (?, ?, ?, ?)',
      [id_actividad, id_supervisor, fecha, req.usuario.id_usuario]);
    res.status(201).json({ id_supervision: r.insertId, mensaje: 'Visita agregada a la ruta de supervisión' });
  } catch (e) { error500(res, 'Error al crear supervisión:', e); }
}

async function buscar(id) {
  const [[s]] = await pool.query(`SELECT ${COLUMNAS} ${UNIONES} WHERE s.id_supervision = ?`, [id]);
  return s || null;
}
const puedeVer = (req, s) => esAdmin(req.usuario.rol) || s.id_supervisor === req.usuario.id_usuario;

async function obtener(req, res) {
  try {
    const s = await buscar(req.params.id);
    if (!s || !puedeVer(req, s)) return res.status(s ? 403 : 404).json({ mensaje: s ? 'Esta visita no es tuya' : 'Visita no encontrada' });
    let puntos;
    if (s.estado === 'completada') {
      [puntos] = await pool.query('SELECT id_item, descripcion, respuesta FROM supervision_resultados WHERE id_supervision = ? ORDER BY id_item', [s.id_supervision]);
    } else {
      [puntos] = await pool.query('SELECT id_item, descripcion, NULL AS respuesta FROM supervision_items WHERE activo = 1 ORDER BY orden, id_item');
    }
    res.json({ ...s, puntaje: s.puntaje === null ? null : Number(s.puntaje), puntos, puede_calificar: s.id_supervisor === req.usuario.id_usuario || esAdmin(req.usuario.rol) });
  } catch (e) { error500(res, 'Error al obtener la visita:', e); }
}

async function quitar(req, res) {
  try {
    const s = await buscar(req.params.id);
    if (!s || !puedeVer(req, s)) return res.status(s ? 403 : 404).json({ mensaje: s ? 'Esta visita no es tuya' : 'Visita no encontrada' });
    await pool.query('DELETE FROM supervision_resultados WHERE id_supervision = ?', [s.id_supervision]);
    await pool.query('DELETE FROM supervisiones WHERE id_supervision = ?', [s.id_supervision]);
    res.json({ mensaje: 'Visita quitada de la ruta' });
  } catch (e) { error500(res, 'Error al quitar la visita:', e); }
}

// Califica: puntaje = cumple / (cumple + no cumple) en %. Los "no aplica" no cuentan.
async function calificar(req, res) {
  const conexion = await pool.getConnection();
  try {
    const s = await buscar(req.params.id);
    if (!s || !puedeVer(req, s)) return res.status(s ? 403 : 404).json({ mensaje: s ? 'Esta visita no es tuya' : 'Visita no encontrada' });
    const resp = req.body.respuestas && typeof req.body.respuestas === 'object' ? req.body.respuestas : {};
    const [items] = await pool.query('SELECT id_item, descripcion FROM supervision_items WHERE activo = 1 ORDER BY orden, id_item');
    if (items.length === 0) return res.status(400).json({ mensaje: 'El check list está vacío' });
    const faltan = items.filter((i) => !RESPUESTAS.includes(resp[i.id_item]));
    if (faltan.length > 0) return res.status(400).json({ mensaje: 'Contesta todos los puntos del check list' });
    const cumple = items.filter((i) => resp[i.id_item] === 'cumple').length;
    const aplican = items.filter((i) => resp[i.id_item] !== 'na').length;
    const puntaje = aplican ? Math.round((cumple / aplican) * 10000) / 100 : null;
    const comentario = req.body.comentario ? String(req.body.comentario).trim().slice(0, 2000) : null;
    await conexion.beginTransaction();
    await conexion.query('DELETE FROM supervision_resultados WHERE id_supervision = ?', [s.id_supervision]);
    await conexion.query('INSERT INTO supervision_resultados (id_supervision, id_item, descripcion, respuesta) VALUES ?',
      [items.map((i) => [s.id_supervision, i.id_item, i.descripcion, resp[i.id_item]])]);
    await conexion.query("UPDATE supervisiones SET estado = 'completada', puntaje = ?, comentario = ?, calificado_en = NOW() WHERE id_supervision = ?", [puntaje, comentario, s.id_supervision]);
    await conexion.commit();
    res.json({ puntaje, mensaje: puntaje === null ? 'Calificación guardada' : `Calificación guardada: ${puntaje}%` });
  } catch (e) {
    await conexion.rollback().catch(() => {});
    error500(res, 'Error al calificar:', e);
  } finally { conexion.release(); }
}

// ------------------------------------------------ puntos del check list (administrador)
async function listarItems(req, res) {
  try {
    const [f] = await pool.query(`SELECT id_item, descripcion, orden, activo FROM supervision_items ${req.query.todos && esAdmin(req.usuario.rol) ? '' : 'WHERE activo = 1'} ORDER BY orden, id_item`);
    res.json(f);
  } catch (e) { error500(res, 'Error al listar el check list:', e); }
}
async function crearItem(req, res) {
  const d = String(req.body.descripcion || '').trim().slice(0, 255);
  if (!d) return res.status(400).json({ mensaje: 'Escribe el punto a verificar' });
  try {
    const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(orden), 0) AS m FROM supervision_items');
    const [r] = await pool.query('INSERT INTO supervision_items (descripcion, orden) VALUES (?, ?)', [d, m + 1]);
    res.status(201).json({ id_item: r.insertId, mensaje: 'Punto agregado al check list' });
  } catch (e) { error500(res, 'Error al crear el punto:', e); }
}
async function actualizarItem(req, res) {
  const d = String(req.body.descripcion || '').trim().slice(0, 255);
  if (!d) return res.status(400).json({ mensaje: 'Escribe el punto a verificar' });
  try {
    const [r] = await pool.query('UPDATE supervision_items SET descripcion = ?, activo = ? WHERE id_item = ?', [d, req.body.activo === false || req.body.activo === 0 ? 0 : 1, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Punto no encontrado' });
    res.json({ mensaje: 'Punto actualizado' });
  } catch (e) { error500(res, 'Error al actualizar el punto:', e); }
}
async function eliminarItem(req, res) {
  try {
    // Las calificaciones guardan una copia del texto, por eso borrar un punto no las altera.
    const [r] = await pool.query('DELETE FROM supervision_items WHERE id_item = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ mensaje: 'Punto no encontrado' });
    res.json({ mensaje: 'Punto eliminado del check list' });
  } catch (e) { error500(res, 'Error al eliminar el punto:', e); }
}

module.exports = { listar, supervisores, crear, obtener, quitar, calificar, listarItems, crearItem, actualizarItem, eliminarItem };
