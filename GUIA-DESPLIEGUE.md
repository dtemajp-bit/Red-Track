# Red-Track — Guía para publicarlo y que los técnicos lo usen

Orden: **1) Backend + base de datos (Railway)** → **2) Web (Vercel)** → **3) App móvil (APK)**.
Los nombres de menús de Railway/Vercel/Expo pueden cambiar un poco; la idea es la misma.

---
## 1. Backend y base de datos en Railway

1. Sube la carpeta `red-track` (con `backend/` y `frontend/`) a un repositorio de GitHub.
   El archivo `.env` NO se sube (ya está en `.gitignore`).
2. En railway.app: **New Project → Provision MySQL**.
3. En el mismo proyecto: **New → GitHub Repo →** elige tu repositorio.
   En el servicio nuevo, **Settings → Root Directory = `backend`**.
4. En ese servicio, pestaña **Variables**, agrega:

| Variable | Valor |
|---|---|
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (referencia al servicio MySQL; ajusta "MySQL" si tu servicio tiene otro nombre) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | una cadena larga y aleatoria (mínimo 32 caracteres) |
| `ADMIN_EMAIL` | tu correo de administrador |
| `ADMIN_PASSWORD` | contraseña del administrador (mínimo 8 caracteres) |
| `ADMIN_NAME` | tu nombre (opcional) |

5. **Settings → Networking → Generate Domain.** Abre `https://TU-DOMINIO/api/salud`:
   debe responder `"estado":"ok"` y `"baseDeDatos":"conectada"`.
6. **Fotos (importante):** el disco de Railway se borra en cada despliegue. Crea un **Volume**
   en el servicio con Mount Path `/data` y agrega la variable `UPLOADS_DIR=/data/uploads`.

Al arrancar, el backend **crea solo las tablas**, los roles, las zonas iniciales y tu usuario
administrador. No hay que importar ningún SQL ni ejecutar `migracion_fotos.sql`.

## 2. Web en Vercel

1. vercel.com → **Add New → Project →** tu repositorio → **Root Directory = `frontend`**.
2. Variable de entorno: `VITE_API_URL` = `https://TU-DOMINIO-RAILWAY/api` (termina en `/api`).
3. Deploy. Ese es el **link de la página web** que pide el Ing.
4. Vuelve a Railway y agrega `CORS_ORIGINS` = la URL de Vercel (ej. `https://red-track.vercel.app`).

## 3. App móvil (APK para los técnicos)

1. En `red-track-movil/eas.json` cambia `https://TU-BACKEND.up.railway.app/api` por tu URL de Railway
   (en `preview` y `production`).
2. En una terminal, dentro de `red-track-movil`:
   ```
   npm install
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build -p android --profile preview
   ```
3. Al terminar, Expo te da un enlace para descargar el **APK**. Envíalo a los técnicos
   (ellos deben permitir "instalar apps de orígenes desconocidos").
   Ya no necesitan Expo Go, ni tu computadora, ni tu hotspot.

## 4. Primer uso

1. Entra a la web con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **Administración → Zonas:** crea las zonas reales. **Usuarios → Nuevo usuario:** crea a cada técnico
   (rol `tecnico`, con su zona y una contraseña temporal de 8+ caracteres).
3. Los técnicos entran a la app y registran infraestructura (con foto y GPS).
4. **Administración → Rutas → Nueva ruta:** asigna técnico, fecha y puntos. El técnico la ve en su **Panel**
   y va marcando los puntos visitados.
5. **Reportes** muestra rutas por técnico, infraestructura e incidencias por zona.

## Qué cambió respecto a tu versión anterior

- Backend listo para producción: variables de entorno, creación automática de tablas, CORS configurable,
  `JWT_SECRET` obligatorio, límite de intentos de login, validaciones y errores claros.
- Permisos: solo el administrador elimina nodos y gestiona usuarios/zonas/rutas; un técnico solo marca
  puntos de **su** ruta.
- Corregido: reporte "Rutas por técnico" inflaba las rutas completadas; incidencias sin nodo no entraban en
  ningún reporte por zona; el estado de la ruta no volvía a "pendiente" al desmarcar.
- Web: nueva pestaña **Rutas** (antes no había forma de asignar rutas) y alta de **zonas**; el menú
  Administración solo aparece al administrador; URL del backend por variable `VITE_API_URL`.
- Móvil: **Panel del técnico, Mapa de cobertura y Reportes ahora usan datos reales** (antes eran de
  ejemplo); si no hay señal, los registros e incidencias se guardan en el teléfono y se envían desde
  **Sincronización**; sesión vencida regresa al login; URL por `EXPO_PUBLIC_API_URL`.

## Límites que conviene saber

- El "mapa" dibuja los puntos por coordenadas (sin mapa de calles), igual que en la web.
- Las fotos tomadas sin señal se envían desde la caché del teléfono: sincroniza el mismo día.
- No pude probar en un teléfono físico ni en tu cuenta de Railway: probé la API completa contra una base
  MySQL real (incluido modo estricto de MySQL 8) y verifiqué que web y móvil compilan.
- Cambia la contraseña del administrador inicial después de crear tus usuarios reales.

## Novedades de esta versión (v8)

- **Reportes:** nuevo "Desempeño por técnico" (rutas, puntos visitados, % cumplimiento, infraestructura e incidencias, última actividad), con filtros de fechas, zona y técnico. **Exportar Excel** genera un libro de 7 hojas con formato (resumen, totales, filtros, colores por estado). Un técnico solo ve sus propios datos.
- **Administración:** el administrador ahora puede **editar** usuarios (nombre, correo, rol, zona y restablecer contraseña), zonas, rutas, puntos de infraestructura e incidencias, y **eliminar** zonas, rutas, puntos e incidencias.
- **Sincronización:** la web también guarda sin conexión (registro de infraestructura e incidencias) y envía solo al volver la señal; se agregó historial de actividad y, para el administrador, un resumen por técnico. Los reintentos ya no duplican registros.
- **Base de datos:** al arrancar, el backend agrega solo las columnas nuevas (quién registró cada punto, fecha de captura, identificador anti-duplicado). Los puntos que ya existían quedan como "Sin registrar" en el reporte por técnico; los nuevos sí se asignan.

**Para publicar:** sube los cambios a GitHub; Railway y Vercel redespliegan solos. En Railway no hay variables nuevas. Hay que instalar la nueva app móvil (v8) para que los técnicos usen el envío sin duplicados.
