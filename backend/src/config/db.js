const mysql = require('mysql2/promise');
require('dotenv').config();

// Prioridad de configuración:
// 1) MYSQL_URL (Railway la entrega lista: mysql://usuario:clave@host:puerto/base)
// 2) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (desarrollo local con XAMPP)
// 3) MYSQLHOST / MYSQLPORT / ... (variables sueltas de Railway)
function configuracionConexion() {
  const e = process.env;
  const url = e.MYSQL_URL || e.DATABASE_URL;

  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }

  return {
    host: e.DB_HOST || e.MYSQLHOST || 'localhost',
    port: Number(e.DB_PORT || e.MYSQLPORT || 3306),
    user: e.DB_USER || e.MYSQLUSER || 'root',
    password: e.DB_PASSWORD ?? e.MYSQLPASSWORD ?? '',
    database: e.DB_NAME || e.MYSQLDATABASE || 'red_track',
  };
}

const pool = mysql.createPool({
  ...configuracionConexion(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true, // DECIMAL y SUM() llegan como número, no como texto
  charset: 'utf8mb4',
  dateStrings: ['DATE'], // las fechas (sin hora) llegan como 'AAAA-MM-DD', sin corrimiento de zona horaria
});

module.exports = pool;
