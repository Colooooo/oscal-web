# Oscal Importaciones

Landing de Oscal rediseñada con el logo vectorial actualizado, React, TypeScript, Vite, Tailwind CSS y ESLint. Paleta crema, azul y rojo; portada con composición de productos, cuatro rubros, presentación, catálogo por WhatsApp y contacto. Incluye navegación móvil y soporte de movimiento reducido.

## Desarrollo

```sh
npm install
npm run dev
```

## Validación y producción

```sh
npm run lint
npm run build
npm run preview
```

## Edición

- `src/App.tsx`: textos, secciones, rubros, enlaces de WhatsApp e ilustraciones SVG.
- `src/App.css`: diseño y estilos responsive.
- `src/index.css`: importación de Tailwind y estilos globales. Se pueden usar utilidades Tailwind en los componentes.
- `src/components/LocationMap.tsx` y su CSS: mapa interactivo negro y minimalista, con MapLibre, marcador rojo, controles y editor local. Zoom continuo con rueda y trackpad, sin sincronización entre motores ni saltos por niveles enteros.
- `public/oscal-map-dark.json`: estilo vectorial propio sobre OpenFreeMap; fondo negro, calles en gris y nombres discretos.
- `src/config/location.json`: coordenadas oficiales usadas por el mapa y por todos los botones «Cómo llegar».
- `public/oscal-products-v2.png`: composición representativa de los cuatro rubros para la portada, generada con la herramienta integrada ImageGen. El prompt se conserva en `scripts/hero-image-prompt.txt`.
- `public/oscal-logo.svg`: vector maestro reconstruido manualmente sobre la foto del cartel, con curvas Bézier continuas y segmentos rectos. La moñita y todas las letras son contornos SVG, sin dependencias de fuentes. Conserva la inclinación que se ve en la fotografía.
- `npm run export:logo`: regenera la vista previa y los PNG de 6000 píxeles (transparente y sobre azul) desde el SVG maestro. No se debe volver a trazar el mapa de píxeles de la foto: introduce bordes serrados.
- `index.html`: título, descripción y favicon.

Los datos de contacto y rubros se transcribieron de la fotografía proporcionada. Las ilustraciones son representativas; no constituyen un catálogo de productos reales. Confirmar con el cliente los textos comerciales antes de publicar. No se agregaron horarios ni precios sin información.

Los botones de catálogo abren WhatsApp con un mensaje preparado. No hay PDF de catálogo ni backend conectado.

## Ajustar la ubicación

Con `npm run dev`, abrí la sección de contacto y pulsá **Ajustar ubicación** debajo del mapa. Arrastrá el marcador, tocá el punto preciso en el mapa o ingresá latitud y longitud. **Guardar ubicación** escribe el ajuste en `src/config/location.json`; permanece al recargar y se incorpora a la siguiente compilación. **Cancelar** restaura el punto guardado. El editor y su endpoint de escritura sólo existen en el servidor local de desarrollo; la landing publicada muestra el mapa y los controles de navegación.

El punto inicial (-34.8887889, -56.1813232) proviene de una consulta puntual de Arenal Grande 2178 en Nominatim/OpenStreetMap (nodo 944570068). Es la coordenada de la dirección; se puede afinar a la entrada real del local. No se solicita la ubicación personal del visitante. Los datos vectoriales de OpenFreeMap se cargan al entrar en la sección, con atribución visible. La rueda controla el zoom cuando el cursor está sobre el mapa; también se puede usar los botones o gestos táctiles. El diseño omite edificios, comercios y números de puerta para mantener una cartografía mínima y legible.

Referencias: [zoom de MapLibre](https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/), [OpenFreeMap y MapLibre](https://openfreemap.org/quick_start/), [dirección en OpenStreetMap](https://www.openstreetmap.org/node/944570068).

