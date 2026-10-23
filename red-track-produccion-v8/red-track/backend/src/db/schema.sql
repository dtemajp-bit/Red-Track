-- Base de datos Red-Track
-- Sistema de gestion de infraestructura de red

CREATE DATABASE IF NOT EXISTS red_track
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE red_track;

-- ==========================================
-- Usuarios y zonas (CU: administracion de usuarios y zonas)
-- ==========================================
CREATE TABLE zonas (
  id_zona INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo VARCHAR(150) NOT NULL,
  correo VARCHAR(150) NOT NULL UNIQUE,
  contrasena_hash VARCHAR(255) NOT NULL,
  id_rol INT NOT NULL,
  id_zona INT,
  activo BOOLEAN DEFAULT TRUE,
  foto_perfil VARCHAR(255),
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
  FOREIGN KEY (id_zona) REFERENCES zonas(id_zona)
);

-- ==========================================
-- Infraestructura (CU: registro de infraestructura, mapa de cobertura)
-- ==========================================
CREATE TABLE nodos (
  id_nodo INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  tipo ENUM('poste', 'nodo_central', 'caja_distribucion') NOT NULL,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  estado ENUM('activo', 'inactivo', 'mantenimiento') DEFAULT 'activo',
  observaciones TEXT,
  foto_url VARCHAR(255),
  id_zona INT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_zona) REFERENCES zonas(id_zona)
);

CREATE TABLE cables (
  id_cable INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  id_nodo_origen INT NOT NULL,
  id_nodo_destino INT NOT NULL,
  tipo_cable VARCHAR(50),
  longitud_metros DECIMAL(8,2),
  estado ENUM('activo', 'danado', 'en_reparacion') DEFAULT 'activo',
  FOREIGN KEY (id_nodo_origen) REFERENCES nodos(id_nodo),
  FOREIGN KEY (id_nodo_destino) REFERENCES nodos(id_nodo)
);

-- ==========================================
-- Rutas de tecnicos (CU: gestion de rutas)
-- ==========================================
CREATE TABLE rutas (
  id_ruta INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_tecnico INT NOT NULL,
  fecha_programada DATE NOT NULL,
  estado ENUM('pendiente', 'en_progreso', 'completada') DEFAULT 'pendiente',
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_tecnico) REFERENCES usuarios(id_usuario)
);

CREATE TABLE ruta_nodos (
  id_ruta_nodo INT AUTO_INCREMENT PRIMARY KEY,
  id_ruta INT NOT NULL,
  id_nodo INT NOT NULL,
  orden INT NOT NULL,
  visitado BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (id_ruta) REFERENCES rutas(id_ruta),
  FOREIGN KEY (id_nodo) REFERENCES nodos(id_nodo)
);

-- ==========================================
-- Incidencias (CU: incidencias)
-- ==========================================
CREATE TABLE incidencias (
  id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
  id_nodo INT,
  id_cable INT,
  id_usuario_reporta INT NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
  estado ENUM('abierta', 'en_atencion', 'resuelta', 'cerrada') DEFAULT 'abierta',
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  resuelto_en DATETIME NULL,
  FOREIGN KEY (id_nodo) REFERENCES nodos(id_nodo),
  FOREIGN KEY (id_cable) REFERENCES cables(id_cable),
  FOREIGN KEY (id_usuario_reporta) REFERENCES usuarios(id_usuario)
);

-- ==========================================
-- Registro local / sincronizacion (CU: registro local y sincronizacion)
-- ==========================================
CREATE TABLE registros_pendientes_sync (
  id_registro INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo_entidad ENUM('nodo', 'cable', 'incidencia') NOT NULL,
  datos_json JSON NOT NULL,
  sincronizado BOOLEAN DEFAULT FALSE,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  sincronizado_en DATETIME NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- ==========================================
-- Datos semilla basicos
-- ==========================================
INSERT INTO roles (nombre) VALUES ('administrador'), ('tecnico'), ('supervisor');

INSERT INTO zonas (nombre, descripcion) VALUES
  ('Zona 19', 'Zona de cobertura La Florida'),
  ('Zona 1', 'Centro historico');
