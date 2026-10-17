# Oscal Importaciones

Landing de Oscal rediseñada con el logo vectorial actualizado, React, TypeScript, Vite, Tailwind CSS y ESLint. Paleta crema, azul y rojo; portada centrada con «Lo que buscás está en» y el logo sobre la fotografía proporcionada por el usuario, difuminada con CSS. Tipografía Fraunces en el hero y DM Sans en la navegación, ambas alojadas en el proyecto. Navbar flotante con transiciones rápidas, sección activa y menú móvil con cierre por Escape o al tocar el fondo. Incluye cuatro rubros, presentación, catálogo por WhatsApp, contacto y soporte de movimiento reducido. La flecha reutiliza el SVG y la animación del componente ScrollArrow del proyecto landing, con destino a los rubros.

## Desarrollo

```sh
npm install
npm run dev
```

La tienda necesita también la API: ejecutar `npm run api` en otra terminal.

### Base de datos Neon

La configuración privada vive en `.env.local`, excluido de Git. Los comandos de la API leen primero `.env` y luego `.env.local`. `DATABASE_URL` conecta el servidor a PostgreSQL mediante el pool de Neon; `DATABASE_URL_UNPOOLED` se usa para migraciones y backups. Nunca usar el prefijo `VITE_` para estas conexiones.

El proyecto es **Oscal SRL Importaciones**, ID `wandering-mud-45739368`, región São Paulo. El entorno local usa la rama **development** (`br-crimson-pond-b65ri4wy`); producción se configura por separado en el alojamiento. Las cuentas y sesiones existentes de la aplicación siguen gestionadas por la API de Oscal.

```sh
npm run db:migrate
npm run db:check
npm run test:postgres
```

Las migraciones se registran en `oscal_migrations` y se ejecutan una sola vez. Las pruebas PostgreSQL solo se habilitan con `NEON_BRANCH_NAME=development` y revierten sus datos al finalizar. Los pagos permanecen desactivados y el catálogo inicial contiene ocho ejemplos.

Sin `DATABASE_URL`, la API conserva el modo SQLite local. Para volver a ese modo, quitar las variables de conexión de `.env.local`. La copia inicial a Neon incluye la cuenta y los tres pedidos existentes, junto con catálogo e inventario. Se conserva un snapshot consistente en `server/backups/before-neon-*.sqlite`; la base SQLite original permanece intacta.

Para trasladar otra base SQLite a un entorno Neon nuevo, ejecutar `npm run db:import-sqlite` para revisar los conteos y `npm run db:import-sqlite -- --apply` para copiar. El script crea un backup, compara cada registro en destino y revierte toda la operación ante diferencias. Rechaza destinos con cuentas o pedidos para evitar sobrescribir datos.

## Validación y producción

### Vercel

`api/index.mjs` exporta la API como función Node 24. `vercel.json` envía `/api/*` a esa función y resuelve las rutas de React mediante `index.html`; los archivos estáticos se sirven desde `dist`. El pool PostgreSQL se reutiliza entre solicitudes y se integra con Fluid Compute. La región configurada es São Paulo (`gru1`), junto a la base Neon.

En el proyecto Vercel de `https://oscal-pink.vercel.app`, configurar estas variables en **Settings → Environment Variables → Production** y desplegar la versión actual del código:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Conexión con pool de la rama Neon **production**, guardada en `.env.production.local`. |
| `PUBLIC_URL` | `https://oscal-pink.vercel.app` |
| `PAYMENTS_ENABLED` | `false` |
| `MERCADOPAGO_MODE` | `test` |

Las variables de Production y Preview se configuran por separado. Para previews usar una rama Neon independiente; el origen autorizado se obtiene de `VERCEL_URL`, mientras que producción utiliza `PUBLIC_URL`. No subir los archivos `.env*` ni establecer estas conexiones con prefijo `VITE_`. Las variables de Vercel se aplican a nuevos despliegues; después de cambiarlas, desplegar nuevamente.

La rama Neon `production` (`br-patient-sunset-b6m4g3g3`) ya tiene el esquema y la copia verificada de la cuenta, los tres pedidos y los ocho productos locales. El archivo `.env.production.local` contiene sus conexiones privadas, separado del entorno local `development`. Las migraciones se ejecutan explícitamente con la conexión directa, antes de publicar:

```sh
node --env-file=.env.production.local scripts/migrate-postgres.mjs
node --env-file=.env.production.local scripts/check-database.mjs
```

Comprobar tras el despliegue: `/catalogo` y `/ingresar` deben abrir directamente; `/api/catalog` debe devolver JSON, `/api/auth/session` debe devolver `{ "user": null }` sin sesión y `/api/payments/config` debe informar `enabled: false`. Probar el ingreso con la cuenta migrada.

En Vercel, `DATABASE_URL` es obligatoria y nunca se crea un archivo SQLite. La IP se toma de la cabecera de Vercel `x-vercel-forwarded-for`; no se necesita `TRUSTED_PROXIES`. La verificación y recuperación por correo requieren las variables `SMTP_*`; el envío se registra mediante `waitUntil` para completar la tarea después de responder. El mantenimiento periódico de reservas del servidor local no se ejecuta en una función: antes de habilitar pagos debe configurarse su ejecución programada o una operación externa de conciliación.

Referencias: [funciones Node](https://vercel.com/docs/functions/runtimes/node-js), [pool y tareas posteriores a la respuesta](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [cabeceras de IP](https://vercel.com/docs/headers/request-headers).

```sh
npm run lint
npm run build
npm run preview
```

## Edición

- `src/App.tsx`: textos, secciones, rubros, enlaces de WhatsApp e ilustraciones SVG.
- `src/App.css`: diseño y estilos responsive.
- `src/index.css`: importación de Tailwind y estilos globales. Se pueden usar utilidades Tailwind en los componentes.
- `src/components/LocationMap.tsx` y su CSS: mapa interactivo negro y minimalista, con MapLibre, marcador con logo y controles. Zoom continuo con rueda y trackpad, sin sincronización entre motores ni saltos por niveles enteros.
- `src/components/ScrollArrow.tsx`: flecha animada de navegación desde el hero a los rubros.
- `src/components/Navbar.tsx` y su CSS: navegación fija, detección de sección y menú móvil.
- `public/oscal-hero-background.jpg`: foto proporcionada por el usuario (`pallavi-gondane-pYv65Fd4JW0-unsplash.jpg`), usada como fondo decorativo; el difuminado y la capa de contraste se aplican con CSS.
- `public/oscal-map-dark.json`: estilo vectorial propio sobre OpenFreeMap; fondo negro, calles en gris y nombres discretos.
- `src/config/location.json`: coordenadas oficiales usadas por el mapa y por todos los botones «Cómo llegar».
- `public/oscal-products-v2.png`: composición de productos de la portada anterior, conservada como recurso. El prompt se conserva en `scripts/hero-image-prompt.txt`.
- `public/oscal-logo.svg`: vector maestro reconstruido manualmente sobre la foto del cartel, con curvas Bézier continuas y segmentos rectos. La moñita y todas las letras son contornos SVG, sin dependencias de fuentes. Conserva la inclinación que se ve en la fotografía.
- `npm run export:logo`: regenera la vista previa y los PNG de 6000 píxeles (transparente y sobre azul) desde el SVG maestro. No se debe volver a trazar el mapa de píxeles de la foto: introduce bordes serrados.
- `index.html`: título, descripción y favicon.

Los datos de contacto y rubros se transcribieron de la fotografía proporcionada. Las ilustraciones son representativas; no constituyen un catálogo de productos reales. Confirmar con el cliente los textos comerciales antes de publicar. No se agregaron horarios ni precios sin información.

La tienda ahora tiene catálogo de ejemplo, carrito persistente, checkout y backend preparado para Mercado Pago. Ver COMMERCE.md para ejecución, procedencia de componentes y requisitos de activación. Los cobros están desactivados mientras el catálogo sea de muestra.

## Ajustar la ubicación

Editá latitud y longitud en `src/config/location.json`. El mapa y los botones «Cómo llegar» usan esas coordenadas. El editor visual fue retirado de la landing.

El punto inicial (-34.8887889, -56.1813232) proviene de una consulta puntual de Arenal Grande 2178 en Nominatim/OpenStreetMap (nodo 944570068). Es la coordenada de la dirección; se puede afinar a la entrada real del local. No se solicita la ubicación personal del visitante. Los datos vectoriales de OpenFreeMap se cargan al entrar en la sección. El control de atribución visible está desactivado; antes de publicar, revisar el cumplimiento de las licencias de los datos. La rueda controla el zoom cuando el cursor está sobre el mapa; también se puede usar los botones o gestos táctiles. El diseño omite edificios, comercios y números de puerta para mantener una cartografía mínima y legible.

Referencias: [zoom de MapLibre](https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/), [OpenFreeMap y MapLibre](https://openfreemap.org/quick_start/), [dirección en OpenStreetMap](https://www.openstreetmap.org/node/944570068).
