# InfoTren 1.8.0 — auditoría de seguridad (repetida)

Fecha: 29 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.7.4.

## Por qué se repite

Desde la 1.5.0 la app tiene tres fuentes nuevas (el proxy propio de Cloudflare, los horarios GTFS de Renfe y las cancelaciones GTFS-RT), un script que genera `data/programados.json` en GitHub Actions y la búsqueda por estación. Además, la validación de la 1.5.0 resultó demasiado estricta: descartaba los trenes en doble composición (corregido en 1.7.4).

## Método

Inventario de todos los puntos que insertan HTML y de todos los datos externos nuevos; revisión del worker con pruebas en Node (caché y Renfe simulados) para cada origen y dirección; revisión del script de horarios y de los dos flujos de GitHub; prueba de los proxies públicos de reserva; comparación de los trenes que envía Renfe con los que acepta la app.

## Hallazgos corregidos

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | Las cancelaciones podían llegar por un proxy público. Un proxy malicioso podía inventarlas, y un «cancelado» falso puede hacer que alguien no vaya a coger un tren que sí sale. | Medio | Las cancelaciones solo se leen del proxy propio. Si falla, no se marca ninguna (no hay copia local: una lista vieja sería igual de engañosa). |
| 2 | El proxy de Cloudflare respondía a cualquier web (`Access-Control-Allow-Origin: *`). Otra página podía usarlo y agotar las 100.000 peticiones gratuitas del día, dejando la app en los proxies de reserva. | Bajo | Solo responde a `mosqueteroweb.github.io` y a `localhost` (desarrollo); el resto recibe 403. La copia en caché no guarda cabeceras CORS y se añade `Vary: Origin`. Un script puede falsear el origen: esto frena a otras webs, no a un atacante decidido. |
| 3 | Dos de los tres proxies públicos de reserva (allorigins.win y codetabs.com) no respondían; cada intento fallido tardaba 5,5 s y mantenía dos terceros con acceso a los datos. | Bajo | Retirados de la app y de la CSP. Queda cors-anywhere.fly.dev como reserva. |
| 4 | El script de horarios descargaba y descomprimía el ZIP de Renfe sin límite de tamaño. | Bajo | Máximo 30 MB comprimido y 400 MB descomprimido (hoy: 1 MB y 40 MB). Si se supera, se conserva el archivo anterior. |
| 5 | El worker devolvía el texto interno del error (`details: err.message`) cuando fallaba la conexión con Renfe. | Informativo | Se registra en Cloudflare y no se envía. |
| 6 | (Corregido en 1.7.4.) La validación de la 1.5.0 limitaba el material a 12 caracteres y descartaba los trenes con dos unidades acopladas (`103004,103005`): unos 10 de cada 70. | Disponibilidad | Material validado como dígitos y comas, hasta 60 caracteres. Comprobado: de 74 trenes del visor, la app acepta los 74. |

## Comprobado

- Todos los `innerHTML` escapan los datos con `escapeHTML` o usan textos fijos, también en las filas de «Próximas salidas», el autocompletado con trenes programados y el mensaje que nombra el chip activo.
- `data/programados.json` se valida en la app (tipos, longitudes, horas y fechas) antes de usarse; de las cancelaciones solo se guardan identificadores, que nunca se muestran.
- Worker, en pruebas simuladas: la app y `localhost` reciben datos con su propio origen en la cabecera; otra web, un dominio que imita al de la app (`mosqueteroweb.github.io.evil.example`) y una petición sin origen reciben 403; una dirección fuera de la lista recibe 403; la segunda petición sale de la caché sin volver a Renfe.
- Leaflet se carga con integridad SRI; los flujos de GitHub usan acciones fijadas por SHA y no manejan secretos aparte del `GITHUB_TOKEN`.

## Riesgos aceptados

- Los trenes en circulación pueden seguir llegando por cors-anywhere.fly.dev si el proxy propio falla. Los datos se validan, pero un proxy ajeno podría alterar retrasos o posiciones.
- `style-src` mantiene `'unsafe-inline'` y no hay `frame-ancestors` (GitHub Pages no permite cabeceras propias), como en la 1.5.0.
- Al marcar cancelaciones solo se usan las salidas de hoy, porque el aviso de Renfe no trae la fecha; un tren cancelado mañana no se marca.
