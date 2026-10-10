-- Ejecutar una sola vez en phpMyAdmin (pestaña SQL, base de datos red_track).
-- Agrega las columnas necesarias para guardar observaciones y la foto del punto.
ALTER TABLE nodos
  ADD COLUMN observaciones TEXT NULL AFTER estado,
  ADD COLUMN foto_url VARCHAR(255) NULL AFTER observaciones;
