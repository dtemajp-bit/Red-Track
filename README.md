# Red-Track — Proyecto base

Sistema de gestión de infraestructura de red (postes, cables, nodos), mapa de cobertura, rutas de técnicos e incidencias.

## Estructura

```
red-track/
├── backend/     Node.js + Express + MySQL (API REST)
└── frontend/    React (Vite)
```

## 1. Base de datos (MySQL)

1. Abre MySQL Workbench o consola y ejecuta:
   ```
   mysql -u root -p < backend/src/db/schema.sql
   ```
   Esto crea la base `red_track` con todas las tablas y datos semilla (roles y zonas).

2. Crea un usuario de prueba manualmente (la contraseña se guarda con bcrypt, no en texto plano). Ejemplo con Node:
   ```js
   const bcrypt = require('bcryptjs');
   bcrypt.hash('123456', 10).then(console.log);
   ```
   Luego inserta en MySQL:
   ```sql
   INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, id_rol, id_zona)
   VALUES ('Daylin Temaj', 'daylin@redtrack.com', '<hash_generado>', 1, 1);
   ```

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # edita usuario/clave de MySQL
npm run dev                # http://localhost:4000
```

Prueba: `GET http://localhost:4000/api/salud` debe responder `{ "estado": "ok" }`.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Inicia sesión con el usuario que creaste y verás el listado de nodos (crear/listar funcionando end-to-end).

## Qué ya está programado

- **Backend**: conexión a MySQL, JWT, login, CRUD completo de nodos (patrón para replicar en cables, rutas, incidencias, etc.)
- **Frontend**: enrutamiento con React Router, contexto de autenticación, pantalla de login y pantalla de nodos (listar + crear) conectadas a la API real
- **Base de datos**: esquema completo con las 6 entidades principales alineadas a los 8 casos de uso del DERCAS

## Siguientes pasos sugeridos

- Replicar el patrón de `nodoController.js` / `nodoRoutes.js` para: cables, rutas, incidencias, usuarios y zonas
- Agregar mapa de cobertura (Leaflet o Google Maps) usando la tabla `nodos`
- Implementar registro local y sincronización (`registros_pendientes_sync`) para modo offline
