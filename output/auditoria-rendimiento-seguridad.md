# Auditoría local de rendimiento y seguridad — Oscal

Fecha: 16 de octubre de 2026. Node v24.14.0.

## Resultado

La base tiene controles útiles contra manipulación de precios y acceso a pedidos ajenos, pero hay problemas de disponibilidad y operación que deben resolverse antes de habilitar ventas reales. No se identificó una vía directa de acceso sin autorización a cuentas o pedidos en el alcance revisado; esto no equivale a una certificación de seguridad.

Se revisaron React, API Node, SQLite, autenticación, importación, carrito y pagos. Se ejecutaron compilación, lint, 12 tests y `npm audit` (cero vulnerabilidades reportadas). Se midieron respuestas del servidor que sirve `dist` en loopback y consultas con bases SQLite aisladas en memoria. Las reproducciones de autenticación crean datos exclusivamente en memoria; no se modificaron cuentas ni pedidos del proyecto. No se enviaron solicitudes a Mercado Pago.

No se inspeccionaron un dominio público, proxy HTTPS, CDN, permisos del servidor de producción o backups externos. No se midieron Lighthouse, LCP, INP ni CLS. Las latencias locales no representan tiempos desde celulares o Internet. El código funcional de la aplicación no se modificó durante esta auditoría.

## Seguridad y disponibilidad

### S1 — Alta: se puede superar el límite de operaciones de contraseña simultáneas

Ubicación: `server/auth.mjs:59–64`.

El control `activeHashes >= 4` ocurre antes de `await readBody(req)`, pero el contador se incrementa después. Varias solicitudes que esperan el cuerpo pasan el mismo control antes de que empiece el primer hash. No se vuelve a comprobar la disponibilidad al adquirir el trabajo.

Reproducción aislada: cinco solicitudes entraron al lector de cuerpos antes de liberar una barrera; las cinco registraron usuarios con respuesta 200. El límite anunciado de cuatro no se cumple. scrypt usa memoria y CPU considerables; un abuso puede degradar o agotar el proceso. No se realizó una prueba de saturación. El límite por IP sigue restringiendo volumen, pero no elimina la carrera.

Corregir con un semáforo adquirido de forma atómica después de validar el cuerpo y antes de derivar contraseñas, liberado en `finally`. Limitar también cuerpos pendientes, tiempos de lectura y solicitudes en el proxy. Agregar una regresión que intercale deliberadamente la lectura de varios cuerpos.

### S2 — Alta en el despliegue previsto: los límites agrupan a todos los clientes detrás del proxy

Ubicación: `server/auth.mjs:59`; `server/index.mjs:51–68`.

Los límites utilizan `req.socket.remoteAddress`. La API escucha en loopback y la documentación propone un proxy HTTPS: en esa arquitectura el socket corresponde al proxy, no al comprador. En una instancia, 15 intentos de ingreso en 15 minutos o 10 solicitudes de pedido/checkout por minuto pueden afectar a todos los clientes. Los contadores además son locales a cada proceso y se pierden al reiniciar.

Reproducción aislada: 16 solicitudes con distintos `X-Forwarded-For` y el mismo socket de proxy; la solicitud 16 recibió 429. Los límites por correo no sustituyen la identificación del origen.

Definir explícitamente los proxies confiables y obtener la dirección desde una cabecera que ese proxy sobrescriba. No confiar en cualquier cabecera enviada por Internet. Aplicar límites por cliente y un límite global separado; compartir contadores si se ejecutan varias instancias.

### S3 — Alta antes de activar cobros: reservas indefinidas y checkout sin idempotencia

Ubicación: `server/index.mjs:69–90`, comentarios de `reconcile`; `src/shop/Shop.tsx:95`.

El checkout de pago descuenta inventario y crea un pedido nuevo antes de abrir Mercado Pago. No recibe clave de idempotencia; repetir la solicitud crea otra reserva y otro pedido. Abandonar el pago conserva las unidades, y un error ambiguo las deja en `needs_review` sin una herramienta operativa de conciliación/liberación. Un cliente puede agotar existencias sin pagar. No significa que cualquier reintento cobre automáticamente dos veces: sí crea intentos independientes y retiene stock varias veces.

El problema está bloqueado actualmente por el modo demo y la configuración de pagos desactivada. Las solicitudes de `POST /api/orders` no reservan stock y sí tienen idempotencia; el hallazgo corresponde a `/api/checkout`.

Usar una clave estable de compra y una preferencia por intento, con reintentos controlados. Implementar conciliación y un procedimiento para caducar/cancelar preferencias y liberar reservas solo cuando ya no puedan liquidarse. No liberar por un simple temporizador mientras siga siendo posible un pago tardío.

### S4 — Media, condicionada a cobros activos: webhook sin firma ni límites de entrada

Ubicación: `server/index.mjs:93–100`.

El endpoint no valida `x-signature` ni limita frecuencia o llamadas concurrentes. Una solicitud no autenticada con un ID puede provocar una consulta a Mercado Pago, consumiendo recursos y cuota. Consultar el pago con el token privado y verificar referencia, importe y moneda protege contra la aprobación basada únicamente en un cuerpo falsificado; no autentica al emisor del webhook ni evita el abuso del endpoint.

Validar la firma HMAC, tratar reenvíos de forma idempotente y limitar/encolar consultas al proveedor. La documentación oficial describe la firma y validación del origen: [Mercado Pago Webhooks](https://www.mercadopago.com.uy/developers/en/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks).

### S5 — Media: protección del documento HTML incompleta

Ubicación: `server/index.mjs:123`.

En el servidor Node local no se observaron Content-Security-Policy, `frame-ancestors`/X-Frame-Options ni Referrer-Policy. Solo aparece `X-Content-Type-Options: nosniff`. Falta defensa frente a inclusión en frames y una política que limite el impacto de una eventual inyección. No se encontró una inyección HTML explotable en la revisión; el HTML del marcador y popup contiene constantes.

Definir una CSP compatible con los estilos, imágenes, worker y recursos del mapa, primero en modo de reporte, y añadir protección contra frames y política de referencia. HSTS debe verificarse en el dominio HTTPS/proxy real; su ausencia en una respuesta HTTP local no prueba una falla del despliegue público.

### S6 — Media: recuperación de cuentas y operación de pedidos aún incompletas

No hay verificación de correo ni recuperación de contraseña, y las sesiones solo tienen cierre individual. No se presenta el correo como verificado, lo cual es correcto. Faltan herramientas de revocación y soporte para pérdida de acceso. Tampoco hay panel para confirmar solicitudes, cotizar envíos o conciliar reservas. No se verificó una política de backups o restauración.

Completar estos procesos antes de abrir las cuentas y ventas al público. Se trata de limitaciones funcionales/operativas; no constituyen una reproducción de acceso indebido.

### S7 — Baja: falta límite monetario del total

Ubicación: `server/catalog.mjs:18`; `server/commerce.mjs:19`.

Se validan precio y cantidad como enteros seguros por separado, pero no el producto `precio × cantidad` ni la suma. Una importación administrativa con valores extremos puede producir un total fuera del rango entero exacto. El importador no es público, lo que reduce el riesgo externo. Definir máximos de negocio y validar cada importe y el total antes de guardar o enviar al proveedor.

## Rendimiento

### P1 — Alto impacto móvil: imagen del hero de 1.882.337 bytes

La misma fotografía JPEG de 4.160 × 3.120 se utiliza en landing y hero del catálogo. La landing marca prioridad alta, pero no ofrece `srcset`, `sizes` o una versión móvil. Se descarga una imagen grande aunque se muestre difuminada.

Preparar tamaños responsivos y versiones WebP/AVIF con una calidad verificada visualmente, conservando el encuadre. Es el primer candidato por peso de transferencia. La reducción exacta debe medirse después de convertir. [Referencia de formatos y verificación](https://web.dev/articles/serve-images-webp).

### P2 — Alto impacto al crecer: catálogo completo por cada solicitud

Ubicación: `server/index.mjs:43`; `server/catalog.mjs:47–51`.

Antes de decidir la ruta se lee y parsea todo el catálogo, incluso para `/api/auth/session`, archivos JS, fotos y rutas inexistentes. SQLite síncrono y el parseo ocupan el hilo de Node.

Medición de `readCatalog`, 30 iteraciones después de calentamiento, SQLite en memoria con productos sintéticos basados en la muestra:

| Productos | Mediana | Percentil 95 | JSON público |
|---:|---:|---:|---:|
| 8 | 0,085 ms | 0,106 ms | 1.876 bytes |
| 1.000 | 4,033 ms | 4,969 ms | 244.933 bytes |
| 5.000 | 16,424 ms | 19,568 ms | 1.228.933 bytes |

Esto no mide capacidad máxima ni latencia bajo carga. Con un catálogo mayor el trabajo se repite innecesariamente por cada recurso. Mover la lectura a las rutas que la necesitan; consultar solo los SKU del pedido; añadir filtros/paginación SQL y una caché invalidada al importar o modificar existencias. Mantener la validación y reserva de stock dentro de la operación transaccional, sin confiar en una caché antigua para cobrar.

### P3 — Alto impacto en transferencia: sin compresión ni política explícita de caché

Ubicación: `server/index.mjs:122–123`.

Solicitando `gzip, br`, el servidor devolvió el JS principal de 319.126 bytes sin `Content-Encoding`. La compilación calcula 99,25 kB con gzip: la cifra de Vite es un potencial comprimido, no lo que el servidor está entregando. Archivos estáticos tampoco traen Cache-Control ni ETag; no hay política explícita de reutilización, aunque el navegador puede aplicar heurísticas.

Configurar Brotli/gzip y servir assets con hash con caché larga e `immutable`; el HTML debe revalidarse y los archivos públicos sin hash necesitan una política/versionado diferente. Servir estáticos desde un proxy/CDN o con lectura asíncrona/streaming en Node. `readFileSync` carga cada recurso en memoria y bloquea el hilo; [documentación de Node](https://nodejs.org/api/fs.html).

Estas observaciones corresponden al servidor Node directo. Un proxy/CDN podría corregir compresión, caché y cabeceras sin cambiar la aplicación; no se verificó uno.

### P4 — Impacto creciente: todos los productos y diálogos se montan juntos

Ubicación: `src/shop/Catalog.tsx:14,28,34`; `src/shop/Shop.tsx:35`; `src/shop/CartContext.tsx:14–16`.

Se descarga el catálogo entero, filtra/ordena en React y se renderiza una tarjeta y un diálogo por producto. Las imágenes tienen carga diferida, pero esto no reduce los componentes, SVG, controles y diálogos que React construye. Hay búsquedas lineales repetidas para resolver líneas del carrito.

Con ocho ejemplos es pequeño. Para el PDF real, paginar (por ejemplo 24/48 por página), mantener un solo diálogo para el producto seleccionado y usar un índice de productos por ID. Los proveedores globales también descargan catálogo y sesión al entrar a la landing; separar las dependencias de tienda puede reducir trabajo inicial. La magnitud del coste de render debe medirse con el catálogo real.

### P5 — Oportunidad secundaria: división de rutas y coste del mapa

El JS inicial es 319,12 kB (99,25 kB gzip calculado). Las pantallas de tienda/cuenta y la landing se importan de forma anticipada. Se pueden diferir rutas para que el primer acceso no incluya todas las pantallas.

MapLibre está correctamente separado y solo se importa cuando el mapa entra en pantalla. Sus assets pesan 1.075,70 kB de JS más un worker de 507,96 kB y CSS de 82,96 kB, sin contar tiles. No deben sumarse como si todo se descargara al abrir el hero. Conservar el diferimiento y comprobar fluidez en un móvil real. El blur grande del hero es otro candidato a perfilado de GPU, sin un problema de frames demostrado en esta revisión.

## Controles existentes que conviene conservar

- SQL parametrizado; contraseñas con scrypt y sal aleatoria.
- Cookies HttpOnly/SameSite; Secure cuando el origen configurado es HTTPS.
- Token de sesión y token privado de pedido almacenados como hash en SQLite.
- Autorización por propietario o token aleatorio para consultar pedidos; historial vinculado al usuario, no al correo introducido.
- Comprobación de origen y JSON en escrituras, cuerpo limitado a 20 kB y secretos fuera de variables VITE.
- Precios recalculados en servidor; cantidades y SKU validados; reserva con actualización condicional dentro de transacción.
- Modo demo bloquea cobros; vuelta del proveedor no aprueba un pago por sí sola.
- Imports transaccionales y borradores fuera del catálogo público.
- MapLibre diferido y respeto por movimiento reducido en CSS.

## Orden recomendado

1. Resolver S1 y S2: concurrencia de autenticación y límites bajo proxy.
2. Antes de activar cobros, resolver S3 y S4: idempotencia, conciliación de reservas y firma del webhook.
3. Optimizar foto, caché/compresión y lectura del catálogo (P1–P3).
4. Incorporar paginación y un diálogo único junto con el catálogo real (P4).
5. Completar cabeceras, recuperación de cuentas, operación y restauración de backups; comprobar el despliegue HTTPS y medir Web Vitals en móvil.

## Evidencia reproducible

- `npm audit --json`: cero vulnerabilidades reportadas en el árbol auditado; no descarta fallas propias de lógica.
- `npm test`: 12 tests aprobados.
- `npm run lint` y `npm run build`: aprobados; advertencia de chunk grande de MapLibre.
- `node scripts/audit-local.mjs`: métricas y reproducciones en `output/auditoria-mediciones.json`. Requiere `dist` generado y API local disponible; `AUDIT_URL` permite indicar otro servidor local. Las pruebas HTTP son lecturas; las pruebas de autenticación y catálogo usan bases en memoria.
