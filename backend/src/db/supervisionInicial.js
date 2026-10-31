// Check list de supervisión que viene cargado de fábrica. El administrador puede editarlo desde Actividades.
const PUNTOS = [
  'Llegó puntual a la ventana de entrega acordada',
  'Usa el uniforme e identificación completos',
  'Se presentó y trató al cliente con cortesía',
  'Usa el equipo de protección y trabaja con seguridad en alturas',
  'Instaló y fijó el cableado de forma ordenada y con grapas',
  'Dejó las conexiones y la roseta correctamente identificadas',
  'Verificó la potencia óptica y el servicio antes de retirarse',
  'Probó internet, televisión y teléfono con el cliente',
  'Registró el material y la mano de obra correctamente en la orden',
  'Dejó el área limpia y explicó el uso al cliente',
];

// Migración única: el flujo anterior (pendiente -> en_ruta -> cerrado) pasa a
// pendiente -> en_ruta -> iniciada -> completada. Lo que estaba "en ruta" ya estaba trabajándose, por eso pasa a "iniciada".
async function prepararSupervision(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS supervision_items (
       id_item INT AUTO_INCREMENT PRIMARY KEY,
       descripcion VARCHAR(255) NOT NULL,
       orden INT NOT NULL DEFAULT 0,
       activo TINYINT(1) NOT NULL DEFAULT 1
     )`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS supervisiones (
       id_supervision INT AUTO_INCREMENT PRIMARY KEY,
       id_actividad INT NOT NULL,
       id_supervisor INT NOT NULL,
       fecha DATE NOT NULL,
       estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
       puntaje DECIMAL(5,2) NULL,
       comentario TEXT NULL,
       calificado_en DATETIME NULL,
       id_creador INT NULL,
       creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_sup_actividad (id_actividad, id_supervisor, fecha),
       INDEX idx_sup_fecha (fecha, id_supervisor)
     )`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS supervision_resultados (
       id_supervision INT NOT NULL,
       id_item INT NOT NULL,
       descripcion VARCHAR(255) NOT NULL,
       respuesta VARCHAR(12) NOT NULL,
       PRIMARY KEY (id_supervision, id_item)
     )`);
  await pool.query('CREATE TABLE IF NOT EXISTS catalogos_semilla (clave VARCHAR(40) NOT NULL PRIMARY KEY)');

  const [[estados]] = await pool.query("SELECT COUNT(*) AS n FROM catalogos_semilla WHERE clave = 'estados_v2'");
  if (estados.n === 0) {
    await pool.query("UPDATE actividades SET estado = 'completada' WHERE estado = 'cerrado'");
    await pool.query("UPDATE actividades SET estado = 'iniciada' WHERE estado = 'en_ruta'");
    await pool.query("INSERT INTO catalogos_semilla (clave) VALUES ('estados_v2')");
  }
  const [[check]] = await pool.query("SELECT COUNT(*) AS n FROM catalogos_semilla WHERE clave = 'checklist_v1'");
  if (check.n === 0) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM supervision_items');
    if (n === 0) await pool.query('INSERT INTO supervision_items (descripcion, orden) VALUES ?', [PUNTOS.map((d, i) => [d, i + 1])]);
    await pool.query("INSERT INTO catalogos_semilla (clave) VALUES ('checklist_v1')");
  }
}

module.exports = { prepararSupervision, PUNTOS };
