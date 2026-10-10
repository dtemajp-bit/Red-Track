const pool = require('../config/db');

async function infraestructuraPorZona(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT COALESCE(z.nombre, 'Sin zona') AS zona,
              COUNT(*) AS total,
              SUM(n.estado = 'activo') AS activos,
              SUM(n.estado = 'mantenimiento') AS en_mantenimiento,
              SUM(n.estado = 'inactivo') AS inactivos
       FROM nodos n
       LEFT JOIN zonas z ON n.id_zona = z.id_zona
       GROUP BY z.id_zona, z.nombre
       ORDER BY zona`
    );
    res.json(filas);
  } catch (error) {
    console.error('Error en reporte de infraestructura por zona:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function incidenciasPorZona(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT COALESCE(z.nombre, 'Sin zona') AS zona,
              COUNT(*) AS total,
              SUM(i.estado = 'abierta') AS abiertas,
              SUM(i.estado = 'en_atencion') AS en_atencion,
              SUM(i.estado IN ('resuelta', 'cerrada')) AS resueltas
       FROM incidencias i
       LEFT JOIN nodos n ON i.id_nodo = n.id_nodo
       LEFT JOIN usuarios ur ON i.id_usuario_reporta = ur.id_usuario
       LEFT JOIN zonas z ON z.id_zona = COALESCE(n.id_zona, ur.id_zona)
       GROUP BY z.id_zona, z.nombre
       ORDER BY zona`
    );
    res.json(filas);
  } catch (error) {
    console.error('Error en reporte de incidencias por zona:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

async function rutasPorTecnico(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT u.nombre_completo AS tecnico,
              COUNT(DISTINCT r.id_ruta) AS rutas,
              COUNT(DISTINCT CASE WHEN r.estado = 'completada' THEN r.id_ruta END) AS rutas_completadas,
              COUNT(DISTINCT rn.id_ruta_nodo) AS puntos,
              (SELECT COUNT(*) FROM incidencias WHERE id_usuario_reporta = u.id_usuario) AS incidencias
       FROM usuarios u
       JOIN roles rol ON u.id_rol = rol.id_rol AND rol.nombre = 'tecnico'
       LEFT JOIN rutas r ON r.id_tecnico = u.id_usuario
       LEFT JOIN ruta_nodos rn ON rn.id_ruta = r.id_ruta
       GROUP BY u.id_usuario, u.nombre_completo
       ORDER BY u.nombre_completo`
    );
    res.json(filas);
  } catch (error) {
    console.error('Error en reporte de rutas por técnico:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

module.exports = { infraestructuraPorZona, incidenciasPorZona, rutasPorTecnico };
