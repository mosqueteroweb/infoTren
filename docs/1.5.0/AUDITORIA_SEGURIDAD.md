# InfoTren 1.5.0 — auditoría de seguridad (repetida)

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.4.0.

## Por qué se repite

La auditoría de la 1.1.0 revisó los puntos conocidos (proxies, CSP, fuentes) pero no todo el código. No miró el proxy de Cloudflare, dejó la CSP con `'unsafe-inline'` para los scripts y no validó todos los campos que usa la app.

## Método

Inventario de todos los puntos donde se inserta HTML, de todos los campos de datos externos que se usan, de las lecturas del almacenamiento local y de los manejadores de eventos; revisión del proxy `proxy-worker/` con pruebas de URL; pruebas de cada control de la app bajo la CSP final.

## Hallazgos corregidos

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | El proxy de Cloudflare aceptaba cualquier dominio que terminara en `renfe.com` (también `evilrenfe.com`) y cualquier dirección de Renfe. Desplegado, habría sido un proxy abierto. | Alto (si se despliega) | Solo sirve las dos direcciones exactas de los datos de Renfe; el resto responde 403. Probado con `evilrenfe.com`, otra página de renfe.com y las dos válidas. |
| 2 | 27 manejadores `onclick`, `oninput`, `onsubmit`… en el HTML obligaban a permitir `'unsafe-inline'` en la CSP, que deja ejecutar cualquier script insertado en la página. | Medio | Eventos asignados desde `app.js` (`data-action` y escuchadores). La CSP ya no permite scripts en línea. |
| 3 | Campos usados sin validar: hora estimada de llegada, horas de cada parada y tipo de producto. Un tipo inesperado (por ejemplo, un número donde va texto) rompía la app en `.split()`. | Bajo | Validación de tipo y longitud de esos campos; los trenes o paradas que no cumplen se descartan. |
| 4 | El historial de búsquedas se leía del almacenamiento local sin comprobar su forma y se volvía a mostrar en la página. | Bajo | Solo entradas con número y servicio de texto corto, máximo 10. |
| 5 | Código muerto que leía datos de respaldo de variables globales (`window.EMBEDDED_*`), de la antigua versión en un solo archivo. | Informativo | Eliminado. |

## Comprobado

- Todos los puntos que insertan HTML escapan los datos (`escapeHTML`).
- Con la nueva CSP funcionan A+, pestañas, filtros, búsqueda en la lista, autocompletado, borrar, consultar, mapa y sus botones, «Buscar otro» y la cabecera con teclado. Sin errores ni violaciones de CSP en la consola.
- axe-core sin incumplimientos en móvil y escritorio.

## Riesgos aceptados

- `style-src` mantiene `'unsafe-inline'` por los estilos en línea de las plantillas (colores de servicio). Los estilos no ejecutan código.
- GitHub Pages no permite cabeceras propias: no hay `frame-ancestors` (protección frente a incrustar la app en otra web). Riesgo bajo, porque la app no tiene acciones sensibles.
- Los datos en directo siguen pasando por proxies públicos mientras no se despliegue el proxy propio, ya corregido.
