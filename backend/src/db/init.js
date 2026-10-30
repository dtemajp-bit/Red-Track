// Prepara la base de datos al arrancar el servidor. Es idempotente: puede
// ejecutarse cada vez sin borrar ni duplicar nada.
//  1) Crea las tablas que falten (usa schema.sql sin CREATE DATABASE / USE).
//  2) Agrega columnas que bases antiguas pudieran no tener.
//  3) Siembra roles y zonas iniciales si no existen.
//  4) Crea el primer administrador si defines ADMIN_EMAIL y ADMIN_PASSWORD.
const fs = require('fs');
const { cargarCatalogosIniciales } = require('./catalogoInicial');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function sentenciasDelEsquema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  return sql
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^CREATE DATABASE/i.test(s) && !/^USE\s/i.test(s) && !/^INSERT INTO/i.test(s))
    .map((s) => s.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS '));
}

async function asegurarColumna(tabla, columna, definicion) {
  const [filas] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  if (filas.length === 0) {
    await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`Columna agregada: ${tabla}.${columna}`);
  }
}

async function asegurarIndiceUnico(tabla, nombre, columna) {
  const [filas] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tabla, nombre]
  );
  if (filas.length === 0) {
    await pool.query(`ALTER TABLE ${tabla} ADD UNIQUE INDEX ${nombre} (${columna})`);
    console.log(`Índice agregado: ${tabla}.${nombre}`);
  }
}

async function inicializarBaseDeDatos() {
  for (const sentencia of sentenciasDelEsquema()) {
    await pool.query(sentencia);
  }

  // Fotos de puntos y de perfil: se guardan aquí para que no se pierdan al desplegar.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS fotos (
       nombre VARCHAR(120) NOT NULL PRIMARY KEY,
       tipo VARCHAR(60) NOT NULL,
       datos LONGBLOB NOT NULL,
       creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
     )`
  );


  // Actividades (órdenes de trabajo) del técnico, con su mano de obra e inventario usado.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS actividades (
       id_actividad INT AUTO_INCREMENT PRIMARY KEY,
       orden_trabajo VARCHAR(60) NOT NULL,
       tipo VARCHAR(60) NULL,
       caja_terminal VARCHAR(60) NULL,
       id_tecnico INT NOT NULL,
       fecha_programada DATE NOT NULL,
       ventana_inicio VARCHAR(5) NULL,
       ventana_fin VARCHAR(5) NULL,
       cliente VARCHAR(150) NULL,
       telefono VARCHAR(30) NULL,
       direccion VARCHAR(255) NULL,
       descripcion TEXT NULL,
       estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
       iniciado_en DATETIME NULL,
       cerrado_en DATETIME NULL,
       notas_cierre TEXT NULL,
       id_creador INT NULL,
       creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_actividades_tecnico (id_tecnico, fecha_programada)
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS materiales (
       id_material INT AUTO_INCREMENT PRIMARY KEY,
       codigo VARCHAR(60) NOT NULL UNIQUE,
       descripcion VARCHAR(255) NOT NULL,
       unidad VARCHAR(20) NOT NULL DEFAULT 'UND',
       activo TINYINT(1) NOT NULL DEFAULT 1,
       con_serie TINYINT(1) NOT NULL DEFAULT 0
     )`
  );
  await asegurarColumna('materiales', 'con_serie', 'TINYINT(1) NOT NULL DEFAULT 0');
  // Material con número de serie (ONT, aparatos): cada unidad es una fila.
  // id_tecnico = quién la tiene; id_actividad = actividad donde se instaló (NULL = disponible).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS series_material (
       id_serie INT AUTO_INCREMENT PRIMARY KEY,
       id_material INT NOT NULL,
       serie VARCHAR(80) NOT NULL,
       id_tecnico INT NOT NULL,
       id_actividad INT NULL,
       UNIQUE KEY uq_material_serie (id_material, serie),
       INDEX idx_series_tecnico (id_tecnico, id_actividad)
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS inventario_tecnico (
       id_tecnico INT NOT NULL,
       id_material INT NOT NULL,
       cantidad DECIMAL(12,2) NOT NULL DEFAULT 0,
       PRIMARY KEY (id_tecnico, id_material)
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS actividad_materiales (
       id_linea INT AUTO_INCREMENT PRIMARY KEY,
       id_actividad INT NOT NULL,
       id_material INT NOT NULL,
       cantidad DECIMAL(12,2) NOT NULL,
       UNIQUE KEY uq_actividad_material (id_actividad, id_material)
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS mano_obra_catalogo (
       id_mano_obra INT AUTO_INCREMENT PRIMARY KEY,
       codigo VARCHAR(60) NOT NULL UNIQUE,
       descripcion VARCHAR(255) NOT NULL,
       unidad VARCHAR(20) NOT NULL DEFAULT 'UND',
       activo TINYINT(1) NOT NULL DEFAULT 1
     )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS actividad_mano_obra (
       id_linea INT AUTO_INCREMENT PRIMARY KEY,
       id_actividad INT NOT NULL,
       id_mano_obra INT NOT NULL,
       cantidad DECIMAL(12,2) NOT NULL,
       UNIQUE KEY uq_actividad_mano_obra (id_actividad, id_mano_obra)
     )`
  );

  // Estado de la cuenta: activo, suspendido o inactivo (ya no está). "activo" sigue indicando si puede entrar.
  await asegurarColumna('usuarios', 'estado_cuenta', "VARCHAR(20) NOT NULL DEFAULT 'activo'");
  await pool.query("UPDATE usuarios SET estado_cuenta = 'inactivo' WHERE activo = 0 AND estado_cuenta = 'activo'");

  try {
    await cargarCatalogosIniciales(pool);
  } catch (error) {
    console.error('No se pudieron cargar los catálogos iniciales:', error.message);
  }

  await asegurarColumna('nodos', 'observaciones', 'TEXT NULL');
  await asegurarColumna('nodos', 'foto_url', 'VARCHAR(255) NULL');
  await asegurarColumna('usuarios', 'foto_perfil', 'VARCHAR(255) NULL');

  // Quién registró cada punto/incidencia y cuándo se capturó realmente en campo
  // (si se guardó sin señal, capturado_en es anterior a creado_en).
  // uuid_cliente evita duplicados si un envío se reintenta.
  await asegurarColumna('nodos', 'id_usuario_registra', 'INT NULL');
  await asegurarColumna('nodos', 'capturado_en', 'DATETIME NULL');
  await asegurarColumna('nodos', 'uuid_cliente', 'VARCHAR(64) NULL');
  await asegurarColumna('incidencias', 'capturado_en', 'DATETIME NULL');
  await asegurarColumna('incidencias', 'uuid_cliente', 'VARCHAR(64) NULL');
  await asegurarIndiceUnico('nodos', 'uq_nodos_uuid_cliente', 'uuid_cliente');
  await asegurarIndiceUnico('incidencias', 'uq_incidencias_uuid_cliente', 'uuid_cliente');

  await pool.query("INSERT IGNORE INTO roles (nombre) VALUES ('administrador'), ('tecnico'), ('supervisor')");

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM zonas');
  if (total === 0) {
    await pool.query(
      `INSERT INTO zonas (nombre, descripcion) VALUES
         ('Zona 19', 'Zona de cobertura La Florida'),
         ('Zona 1', 'Centro historico')`
    );
  }

  const correo = (process.env.ADMIN_EMAIL || '').trim();
  const clave = process.env.ADMIN_PASSWORD || '';
  if (correo && clave) {
    const [existe] = await pool.query('SELECT 1 FROM usuarios WHERE correo = ?', [correo]);
    if (existe.length === 0) {
      const [[rol]] = await pool.query("SELECT id_rol FROM roles WHERE nombre = 'administrador'");
      const hash = await bcrypt.hash(clave, 10);
      await pool.query(
        'INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, id_rol) VALUES (?, ?, ?, ?)',
        [process.env.ADMIN_NAME || 'Administrador', correo, hash, rol.id_rol]
      );
      console.log(`Administrador inicial creado: ${correo}`);
    }
  }
}

// Railway puede tardar unos segundos en tener MySQL listo: reintenta.
async function inicializarConReintentos(intentos = 10, esperaMs = 3000) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await inicializarBaseDeDatos();
      console.log('Base de datos lista');
      return;
    } catch (error) {
      console.error(`Base de datos no disponible (intento ${i}/${intentos}): ${error.message}`);
      if (i === intentos) throw error;
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

module.exports = { inicializarConReintentos };
