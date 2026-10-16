# Tienda Oscal

## Probar localmente

- `npm run dev`: landing y tienda en http://localhost:5173.
- `npm run api`, en otra terminal: servidor de pedidos en 127.0.0.1:3001. Vite deriva `/api` a este servidor.
- `npm test`, `npm run lint`, `npm run build`: validaciones.
- Node 24: el servidor utiliza SQLite incorporado. Los datos están en `server/data/orders.sqlite`, fuera de Git.

Rutas: `/catalogo`, `/carrito`, `/checkout`, `/pedido`. La tienda usa Tailwind 4 y conserva el diseño de la landing. Las ilustraciones son representativas; no son fotografías de productos reales.

## Reutilización

- Carrito persistente por ID, saneamiento de datos y selector de cantidades: adaptados a TypeScript desde `../Ferreteria-pro/src/context/CartContext.jsx` y `components/QuantitySelector.jsx`.
- Ficha con diálogo nativo: adaptada desde `../Ferreteria-pro/src/components/ProductCard.jsx`.
- Retiro/envío, comentarios, paso de revisión y cotización de envío: adaptados desde `../Ferreteria-pro/src/pages/Checkout.jsx`.
- La flecha de la landing continúa basada en el proyecto `landing`.

Ferretería Pro solo coordinaba el pedido por WhatsApp. El checkout de Ferretería original simulaba una compra; esa simulación no se utiliza para confirmar pagos reales.

## Catálogo de ejemplo

SQLite es la fuente de verdad del catálogo: `products`, `inventory`, `catalog_settings` y `catalog_imports`. `shared/catalog.json` solo carga ocho ejemplos en el primer arranque. Las migraciones conservan cuentas, pedidos e inventario existentes. La tienda consume `GET /api/catalog`; no hay que recompilar para cambiar productos (recargar la página).

Los pedidos incluyen una copia de los artículos, cantidades y precios para que una importación posterior no modifique compras anteriores. `POST /api/orders` guarda solicitudes de invitados o clientes con cuenta y usa una clave aleatoria para evitar duplicados al reintentar. Los invitados consultan su pedido con un token privado guardado en la sesión del navegador; los clientes también desde su historial. Nunca se asigna un pedido por el correo escrito en el formulario.

En demo todos se guardan como `demo`, sin cobro. En modo real las solicitudes quedan `received` o `awaiting_shipping`, sin pago ni reserva de stock; requieren confirmar disponibilidad y, cuando corresponda, envío. El checkout de pago inmediato conserva su propia reserva transaccional. Todavía no hay panel administrativo ni conversión automática de solicitudes a enlaces de pago.

### Cuando llegue el PDF

1. Extraer referencias, nombres, rubros, descripciones, precios y fotos a JSON; registrar archivo y página de origen. No inventar stock ni precios faltantes: dejarlos pendientes de revisión, sin publicar.
2. Usar el formato de `shared/catalog.import.example.json`. `published: false` mantiene el artículo fuera de la tienda. Los importes actuales son **pesos UYU enteros**; si el PDF usa centésimos u otra moneda, adaptar el modelo antes de importar.
3. Validar sin modificar datos: `npm run catalog:import -- ruta/catalogo.json`.
4. Tras revisar datos, importar: `npm run catalog:import -- ruta/catalogo.json --apply`. Los SKU existentes se actualizan, sin reponer stock accidentalmente.
5. Para sustituir todos los ejemplos por el catálogo real: `npm run catalog:import -- ruta/catalogo.json --apply --replace --reset-stock`. `--replace` oculta los productos anteriores sin borrarlos. `--reset-stock` establece explícitamente las existencias indicadas; usarlo después de revisar reservas abiertas. Cambiar de modo exige ambas opciones.

Las importaciones son transaccionales: un error revierte todo. Los SKU son estables y únicos; no reutilizar el SKU de un producto para otro. Las fotos pueden ser rutas `/productos/foto.jpg` (archivos en `public/productos`) o URLs HTTPS. La página del PDF se conserva internamente, fuera de la API pública. Los productos reales se importan como borradores salvo `published: true` explícito.

Hacer una copia consistente de SQLite antes de importar: detener la API y copiar `server/data` completo, incluidos WAL/SHM si existen. Producción requiere disco persistente y backups externos; no guardar la base en Git ni servir esa carpeta públicamente.

## Mercado Pago: integración preparada, pendiente de activar

Se usa Checkout Pro con redirección al proveedor. No hay campos de tarjeta en Oscal.

1. Copiar `.env.example` a `.env` y configurar la credencial privada únicamente en el servidor. Nunca usar `VITE_` para secretos.
2. Preparar un dominio HTTPS con proxy al servidor Node y almacenamiento SQLite persistente. El servidor también sirve `dist` con fallback para las rutas React.
3. Reemplazar el catálogo de muestra e inicializar el inventario real. Definir el procedimiento operativo de preparación de pedidos y conciliación de reservas antes de habilitar ventas.
4. Configurar la aplicación de Mercado Pago y comprobar con sus cuentas de prueba la creación de preferencias, rechazo, pendiente, aprobación y notificaciones. No se ejecutaron pruebas contra una cuenta real porque todavía no hay credenciales.
5. Solo después de validar, establecer `demo: false`, `PAYMENTS_ENABLED=true` y `PUBLIC_URL=https://dominio-real`.

El servidor recalcula precios a partir del catálogo, valida cantidades y reserva existencias en una transacción SQLite. Conserva pedidos y sus referencias. Una notificación o la URL de regreso nunca basta para aprobar: consulta `/v1/payments/{id}` con la credencial privada y verifica referencia, importe y moneda. La consulta del pedido requiere el token aleatorio de la sesión del comprador; no devuelve datos personales.

Las preferencias nuevas vencen a los 30 minutos. Cada diez minutos se revisan hasta diez reservas cuya preferencia venció hace más de 24 horas: solo se liberan tras consultar al proveedor y comprobar que no existen pagos pendientes/aprobados ni resultados incompletos. Las reservas ambiguas sin preferencia identificada permanecen en revisión. No se libera stock únicamente por tiempo. Hay herramientas locales de operación y backup; todavía no hay panel administrativo web, reposición automática ni integración con transportistas. Estos puntos deben resolverse al incorporar catálogo y operación reales; no activar ventas sin ese procedimiento.

Solo retiro tiene importe final conocido. Para envío se conserva el flujo de Ferretería Pro: guardar la solicitud y cotizar cobertura y costo antes del cobro; no se inventa una tarifa ni se cobra el subtotal como si incluyera envío.

Referencia oficial: https://www.mercadopago.com.uy/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post

## Cuentas de clientes

Registro e ingreso por correo y contraseña en `/ingresar`; dirección e historial en `/cuenta`. Las contraseñas se derivan con scrypt y sal aleatoria; las sesiones duran siete días y usan cookies HttpOnly/SameSite=Lax (Secure cuando PUBLIC_URL es HTTPS). El servidor controla el origen de las escrituras y limita los intentos de autenticación. Los pedidos pertenecen al ID del usuario autenticado; nunca se asignan por el correo escrito en checkout.

En modo de muestra se guardan pedidos con estado `demo` tanto para clientes como invitados, sin reservar inventario ni llamar a Mercado Pago. Las direcciones guardadas pueden copiarse explícitamente al formulario de entrega. Los estados de pago de pedidos reales siguen verificándose en el servidor.

La confirmación de correo, recuperación de contraseña y cierre de todas las sesiones están implementados. El envío real requiere configurar SMTP; Google OAuth no está implementado. No se presenta un correo registrado como verificado. Antes de abrir el registro al público, conectar un servicio de correo para verificación/recuperación y preparar backups de `server/data`. No hay credenciales de Mercado Pago en este checkout local; las ventas permanecen bloqueadas hasta completar la configuración y las pruebas del proveedor. La API escucha únicamente en loopback: producción requiere un proxy HTTPS al proceso Node y un PUBLIC_URL exacto.


## Seguridad y operación después de la auditoría

- `TRUSTED_PROXIES` contiene exclusivamente IPs de proxies controlados. En un nginx local, por ejemplo, configurar `proxy_set_header X-Real-IP $remote_addr;` y `TRUSTED_PROXIES=127.0.0.1`. El proxy debe sobrescribir la cabecera, y no ser accesible a través de otro salto sin revisar esa topología. Sin esta opción se ignoran cabeceras reenviadas. Los límites de API/auth/pedidos persisten y se comparten mediante SQLite.
- La API limita cuerpos a 20 kB, lecturas pendientes a 32 y trabajo de scrypt a cuatro operaciones por proceso. Usa timeouts de cabeceras/cuerpo y conexiones acotadas. El proxy debe aplicar límites de conexiones, tamaño y tráfico antes de llegar a Node.
- Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` para los enlaces de verificación/recuperación de 30 minutos, un solo uso, token almacenado como hash. El enlace usa un fragmento para que el token no llegue a logs HTTP. Recuperar contraseña revoca todas las sesiones. La falta de SMTP se informa y no habilita un mecanismo de recuperación inseguro.
- El pago inmediato exige una cuenta con correo confirmado. Los pedidos sin pago y de ejemplo siguen admitiendo invitados. No se convierten los correos existentes en verificados durante la migración.
- Configurar `MERCADOPAGO_WEBHOOK_SECRET` y `MERCADOPAGO_MODE=test|production`; el servidor valida HMAC, antigüedad de firma, identidad del evento y entorno real del pago. Sin secreto, los cobros permanecen bloqueados. Las llamadas al proveedor están limitadas a cuatro simultáneas.
- El checkout persiste una referencia por intento en el navegador y reutiliza una preferencia/reserva. Solo admite un intento sin resolver por cuenta confirmada. Un timeout ambiguo no crea automáticamente otro pago. Para ver pedidos abiertos: `npm run ops -- orders`; detalle: `npm run ops -- show ID`; actualizar un pago identificado: `npm run ops -- reconcile ID`; revisar y liberar una reserva vencida con las mismas comprobaciones: `npm run ops -- close-reservation ID`. No hay un comando para forzar liberaciones ambiguas. Un operador debe investigar en Mercado Pago cuando falta un ID de preferencia/pago.
- `npm run ops -- cancel-request ID` cancela únicamente solicitudes sin pago/reserva. Los comandos son de uso local del operador y no están expuestos en HTTP.
- `npm run ops -- backup` crea una copia SQLite consistente, incluyendo transacciones del WAL, en `server/backups`, fuera de Git y de `dist`. `npm run ops -- check-backup ruta.sqlite` comprueba integridad y restaura una copia separada para ensayo. Se ejecutó este ensayo sin reemplazar la base actual. Programar backups fuera del equipo y retención según operación real. Para recuperación: detener TODAS las instancias, conservar el directorio de datos anterior completo y restaurar la copia verificada como `orders.sqlite` en un directorio de datos nuevo sin WAL/SHM antiguos; apuntar `OSCAL_DATA_DIR` al nuevo directorio y comprobar la aplicación antes de retomar ventas.
- El servidor sirve JS/CSS/HTML con Brotli/gzip y ETag; assets con hash llevan un año de caché, HTML revalidación y archivos sin hash una hora. Las cabeceras CSP, anti-frame y referencia se aplican en Node. HSTS se activa cuando `PUBLIC_URL` es HTTPS. Se verificó el mapa con la CSP en el servidor local de producción; el editor de desarrollo sigue siendo exclusivo de Vite.
- `GET /api/catalog` ahora es paginado (24 artículos), admite `q`, `categoria`, `orden`, `page`. `GET /api/catalog/selection?ids=...` devuelve solo los artículos del carrito, hasta 100. Las consultas de stock/precios para pedidos usan los SKU solicitados. La caché de páginas se invalida por cambios de productos, inventario o modo, también desde el importador en otro proceso.
- `npm run images:optimize` regenera WebP de 640, 1280 y 1920 px. El original se conserva. La landing no consulta catálogo/sesión al abrirse; el mapa y las pantallas de tienda se cargan de forma diferida.

Las pruebas con Mercado Pago y entrega de correos reales siguen pendientes de las credenciales del negocio. Las pruebas automatizadas usan un proveedor y envío de correo simulados; no certifican comportamiento de una cuenta real ni del proxy público.
