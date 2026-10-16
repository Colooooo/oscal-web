# Correcciones de seguridad y rendimiento — 16/10/2026

Se aplicaron las correcciones de código de la auditoría. La web conserva el catálogo de ejemplo y los pagos desactivados.

## Seguridad

| Hallazgo | Corrección y comprobación |
|---|---|
| S1: carrera en autenticación | Se adquiere el cupo de hash después de leer/validar el cuerpo, sin `await` entre comprobación e incremento. La reproducción de cinco solicitudes ahora acepta cuatro y rechaza una. |
| S2: clientes agrupados bajo proxy | IP obtenida de X-Real-IP solo desde proxies exactos configurados; las cabeceras de otros remitentes se ignoran. Límites persistentes y compartidos en SQLite. La API con PUBLIC_URL HTTPS exige configurar proxies; producción exige HTTPS. Prueba con 16 IPs distintas sin bloqueo colectivo. |
| S3: checkout y reservas | Clave de idempotencia persistida por intento; una preferencia/reserva por clave y un intento sin resolver por cuenta confirmada. Preferencias nuevas con vencimiento de 30 minutos. Mantenimiento cada diez minutos consulta al proveedor antes de liberar reservas vencidas hace más de 24 horas; no libera pagos pendientes, datos incompletos ni operaciones ambiguas. CLI local para revisión y conciliación. Tests de duplicados, timeout, stock y liberación única. |
| S4: webhook | HMAC SHA-256, timestamp reciente, identidad del evento, deduplicación y cuatro llamadas simultáneas como máximo al proveedor. Verificación de referencia, moneda, importe y entorno del pago. Una notificación sin firma es rechazada sin consultar a Mercado Pago. |
| S5: cabeceras | CSP compatible con el mapa, anti-frame, Referrer-Policy, Permissions-Policy y nosniff. HSTS al configurar origen HTTPS. Comprobación HTTP y mapa probado en el servidor local de producción, sin errores CSP observados. |
| S6: cuentas y operación | Confirmación de correo, recuperación con enlace de un solo uso/30 minutos, revocación de todas las sesiones al recuperar contraseña y botón para cerrar todas las sesiones. SMTP con TLS y concurrencia acotada; sin SMTP se informa que el servicio no está configurado. Herramientas locales para revisar/cancelar solicitudes, conciliar pagos, backup y restauración de prueba. |
| S7: importes extremos | Límite de importe por producto y por pedido; el total debe ser entero seguro y no superar UYU 10.000.000. Prueba del límite tras multiplicar cantidades. |

Además: lectura de cuerpos como bytes UTF-8, máximo 20 kB y 32 lectores pendientes; timeouts y conexiones acotadas. Índices para expiración de sesiones y límites. Los tokens de recuperación no se escriben en URLs HTTP ni se exponen en respuestas; se almacenan como hash. Las cuentas previas no se marcan como verificadas durante la migración.

## Rendimiento

| Medición | Antes | Después |
|---|---:|---:|
| Foto usada en hero | JPEG de 1.882.337 bytes | WebP: 22.386 / 51.070 / 87.556 bytes a 640/1280/1920 px |
| Archivo JS principal generado | 319.126 bytes | 267.026 bytes, con pantallas separadas |
| Transferencia del JS principal | 319.126 bytes sin compresión | 72.811 bytes con Brotli solicitado |
| Catálogo sintético de 5.000 productos | 1.228.933 bytes de JSON completo | 5.974 bytes por página de 24, incluyendo metadatos |
| Lectura en la misma ejecución local, 5.000 productos | 19,197 ms de mediana al leer todo | 3,933 ms por consulta de página sin caché |

Las imágenes se seleccionan con srcset/sizes. La foto original se conserva. Los archivos estáticos ya no consultan el catálogo ni usan lecturas síncronas por solicitud. Se sirven con Brotli/gzip, ETag y políticas de caché diferenciadas; los archivos con hash son inmutables durante un año. Las páginas de catálogo se cachean y se invalidan con cambios de producto, inventario o modo desde cualquier conexión SQLite.

El carrito consulta únicamente sus SKU (máximo 100); filtros y orden se resuelven en SQL y el catálogo monta como máximo 24 tarjetas y un único diálogo. La landing no solicita catálogo ni sesión al abrir; las rutas y el mapa se cargan de forma diferida. El mapa conserva el zoom fluido y los gestos existentes.

Estas mediciones son locales: no equivalen a una puntuación Lighthouse o a Web Vitals en celulares. El chunk grande de MapLibre permanece separado y se descarga al entrar el mapa en pantalla.

## Validación y datos

- 24 tests aprobados, lint y compilación aprobados.
- npm audit: cero vulnerabilidades conocidas reportadas después de agregar Nodemailer y Sharp.
- Probados en navegador: imagen optimizada, búsqueda sin acentos, diálogo, carrito persistido, checkout de ejemplo, guardado y mapa con CSP.
- Backup consistente creado y restaurado en una copia separada; integridad SQLite correcta. La base actual y sus pedidos anteriores se conservaron. El recorrido de navegador agregó un pedido con datos ficticios en modo demo.
- Métricas reproducibles: `output/auditoria-mediciones-optimizadas.json` y `node scripts/audit-local.mjs`.

## Configuración externa pendiente

No hay credenciales SMTP o Mercado Pago del negocio en este entorno. La recuperación/verificación por correo está implementada y probada con un emisor simulado; falta conectar SMTP y comprobar recepción real. Los pagos/webhooks/reservas están probados con un proveedor simulado; falta validarlos con la cuenta y entorno de Mercado Pago. Sin secreto del webhook no se habilitan cobros.

El proxy público debe sobrescribir X-Real-IP y figurar en TRUSTED_PROXIES; TLS, tráfico externo, entrega de correos y comportamiento real del proveedor no pueden darse por verificados desde esta prueba local. Configuración y comandos en `COMMERCE.md` y `.env.example`. No se desplegó la web ni se activaron pagos.

Las reservas ambiguas se mantienen en revisión deliberadamente hasta identificar su estado en Mercado Pago. No hay un comando para forzar la liberación ignorando un posible pago pendiente. Los backups locales deben copiarse fuera del equipo y programarse según la operación del negocio.
