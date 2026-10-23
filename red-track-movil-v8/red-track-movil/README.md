# Red-Track Móvil

## Instalación y ejecución

1. Instala dependencias:

```bash
npm install
```

2. Si Expo solicita corregir versiones, ejecuta:

```bash
npx expo install
```

3. Inicia limpiando la caché:

```bash
npx expo start -c
```

4. Escanea el QR desde Expo Go.

## Backend desde el teléfono

En `src/api/cliente.js`, `BASE_URL` debe usar la IP local de la computadora, por ejemplo:

```js
const BASE_URL = 'http://192.168.1.15:4000/api';
```

El teléfono y la computadora deben estar conectados a la misma red Wi-Fi y el backend debe escuchar en la red local.
