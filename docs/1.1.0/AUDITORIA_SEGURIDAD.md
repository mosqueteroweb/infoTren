# InfoTren 1.1.0 — auditoría de seguridad

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: la publicada al separar el repositorio (commit `1a84f89`).

## Alcance

Código de la página (`index.html`, `app.js`), service worker, peticiones de red, almacenamiento local, uso de los datos externos en el HTML y el mapa, y los flujos de GitHub Actions.

## Hallazgos corregidos

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | El parámetro `?proxy=` de la URL cambiaba la fuente de los datos. Un enlace compartido podía hacer que la app mostrara retrasos, paradas o posiciones inventados. | Medio (suplantación de datos) | Eliminado. Un proxy propio solo se puede configurar desde la consola del navegador, y solo con una dirección `https://`. |
| 2 | Los datos que devolvían los proxies públicos se aceptaban sin comprobar su forma y se guardaban en el dispositivo. Un proxy defectuoso o malicioso podía dejar la app sin funcionar o con datos falsos guardados. | Medio | Validación de la flota y los recorridos: lista de trenes, códigos cortos y coordenadas válidas. Las respuestas inválidas se descartan y se prueba la siguiente fuente; también al leer la copia guardada y la de respaldo. |
| 3 | Sin política de seguridad de contenido (CSP). | Medio | CSP que limita los scripts a este sitio y a Leaflet 1.9.4, las conexiones a Renfe y los proxies, las imágenes a las teselas de OpenStreetMap, y bloquea `object`, `base` y formularios. Mantiene `'unsafe-inline'` por los `onclick` del HTML (pendiente para una versión posterior). |
| 4 | Las fuentes se cargaban de Google Fonts, lo que enviaba la IP de cada visitante a Google. | Bajo (privacidad) | Fuentes Plus Jakarta Sans y JetBrains Mono (licencia OFL) servidas desde el propio sitio, solo con los alfabetos latinos. |
| 5 | La copia de datos cada 2 horas guardaba cualquier respuesta de más de 1.000 bytes, también páginas de error. | Bajo (respaldo roto) | Solo se guarda si es JSON con una lista de trenes no vacía y de menos de 5 MB. |
| 6 | Acciones de GitHub referenciadas por etiqueta y `htmlhint` sin versión fija. | Bajo (cadena de suministro) | Acciones fijadas por SHA, `htmlhint@1.9.2` y permisos de solo lectura en la integración continua. |

## Comprobaciones sin hallazgos

- Todos los datos externos que se insertan como HTML (tablas, chips, recorrido, ventanas del mapa) pasan por `escapeHTML`. El número de tren buscado se limpia con `sanitizeInput`.
- Sin claves, tokens ni credenciales en el código.
- Leaflet se carga con integridad SRI.
- El service worker solo guarda en caché recursos de este sitio y de Leaflet; nunca las respuestas de los proxies.

## Riesgos aceptados

- Los datos en directo siguen pasando por proxies CORS públicos (`cors-anywhere.fly.dev`, `allorigins`, `codetabs`). Ven qué datos se piden (no hay datos personales) y pueden fallar. El proxy propio de `proxy-worker/` lo resolvería; está pendiente de desplegar en Cloudflare.
