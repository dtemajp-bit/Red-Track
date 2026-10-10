// Prepara la base de datos al arrancar el servidor. Es idempotente: puede
// ejecutarse cada vez sin borrar ni duplicar nada.
//  1) Crea las tablas que falten (usa schema.sql sin CREATE DATABASE / USE).
//  2) Agrega columnas que bases antiguas pudieran no tener.
//  3) Siembra roles y zonas iniciales si no existen.
//  4) Crea el primer administrador si defines ADMIN_EMAIL y ADMIN_PASSWORD.
const fs = require('fs');
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

async function inicializarBaseDeDatos() {
  for (const sentencia of sentenciasDelEsquema()) {
    await pool.query(sentencia);
  }

  await asegurarColumna('nodos', 'observaciones', 'TEXT NULL');
  await asegurarColumna('nodos', 'foto_url', 'VARCHAR(255) NULL');
  await asegurarColumna('usuarios', 'foto_perfil', 'VARCHAR(255) NULL');

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
