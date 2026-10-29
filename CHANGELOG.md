# Historial de cambios

## 1.8.1 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Búsqueda por estación más completa: «Próximas salidas» filtradas por una estación incluyen también los trenes que ya salieron de su origen pero que Renfe no sigue en directo (unos 4 de cada 10 a mediodía, sobre todo Media Distancia y Regionales), siempre que aún no hayan pasado por esa estación. Aparecen con la hora prevista en la estación y el estado «Sin datos en directo», nunca como «En hora». Corrección: unos 160 trenes salían dos veces en «Próximas salidas», porque Renfe publica dos variantes del mismo tren y salida; ahora se juntan en una (la de más paradas) y se tienen en cuenta las cancelaciones de las dos.

## 1.8.0 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Auditorías de seguridad y de UX repetidas tras los cambios de la 1.7. Seguridad: las cancelaciones solo llegan por el proxy propio (un proxy ajeno podía inventarlas), el proxy de Cloudflare solo atiende a la app, se retiran dos proxies públicos que ya no respondían y el script de horarios limita el tamaño de la descarga. UX: «Próximas salidas» filtradas por una estación se ordenan por la hora en esa estación y sin los trenes que ya pasaron; los avisos «Programado» y «Sin datos en directo» dejan de ser verdes; un tren sin datos en directo indica dónde debería estar según el horario; los cancelados se distinguen en la lista. [Seguridad](docs/1.8.0/AUDITORIA_SEGURIDAD.md) · [UX](docs/1.8.0/AUDITORIA_UX.md).

## 1.7.4 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección importante: la app descartaba los trenes en doble composición (dos unidades acopladas), unos 10 de cada 70 en circulación. Su material llega como `103004,103005`, 13 caracteres, y la validación de la 1.5.0 solo admitía 12. Entre ellos estaban AVE como el 03113 o el 03122, que en vez de verse en directo con su retraso salían como «programados». Ahora se aceptan y la matrícula se muestra como `103004 + 103005`. Además, un tren programado cuya hora de salida ya ha pasado y que no aparece en directo dice «Sin datos en directo» en vez de «Aún no ha salido», porque no se puede saber si salió.

## 1.7.3 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección: tras publicar una versión, el navegador podía cargar la página nueva con el `app.js` o el `style.css` anteriores durante unos 10 minutos (lo que tardan en caducar en GitHub Pages), y se veían pantallas a medio actualizar. Ahora los dos archivos llevan el número de versión en la dirección (`app.js?v=1.7.3`), así que cada página carga siempre los suyos. La comprobación automática de GitHub falla si la versión no coincide en `index.html` y `sw.js`.

## 1.7.2 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Búsqueda por estación: los filtros miran ahora todas las paradas, no solo origen y destino, así que «Tarragona» encuentra los AVE Madrid–Barcelona que paran allí. Escribir una ciudad en el buscador principal y pulsar Consultar abre la lista filtrada por esa estación (los trenes en circulación o, si no hay, las próximas salidas) en lugar de «Tren #tarragona no encontrado». En «Próximas salidas» filtradas por una parada intermedia se ve la hora en esa estación. Las sugerencias incluyen también trenes programados.

## 1.7.1 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección: en el móvil, cuando un filtro de «En circulación» no daba resultados se veía una tarjeta en blanco. El mensaje («No se encontraron trenes…», «Cargando…», «Se muestran las 200 primeras…») iba en una fila de una sola casilla, y esa casilla se ocultaba como el botón «Ver Tren», que en el móvil es invisible porque se pulsa la tarjeta entera.

## 1.7.0 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Trenes programados de las próximas 24 horas. Hasta ahora solo salían los que ya circulaban; ahora un número que aún no ha salido abre su ficha con la salida y el itinerario previstos, y «En circulación» tiene el chip «Próximas salidas». Los horarios salen del GTFS abierto de Renfe (data.renfe.com, CC BY 4.0), que el flujo de GitHub reduce cada 2 horas a `data/programados.json`. Las cancelaciones llegan en directo del GTFS-RT de Renfe por el proxy propio; como el aviso no dice el día, solo se marcan las salidas de hoy. Renfe no publica retrasos antes de la salida, así que un tren programado aparece sin retraso hasta que empieza a circular. Nuevos tipos: Proximidad, Trencelta y Avant Exprés. Atribución de los datos en el pie.

## 1.6.3 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección: el filtro de «En circulación» y el buscador principal distinguían las tildes, así que «Valencia», «Malaga», «Cadiz», «Leon» o «Chamartin» no encontraban nada. Ahora no importan tildes, mayúsculas ni guiones («madrid chamartin» encuentra «Madrid-Chamartín-Clara Campoamor»). Si un chip está marcado y el texto no da resultados, el mensaje lo dice y sugiere «Todos».

## 1.6.2 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Los datos en directo llegan ahora por el proxy propio de Cloudflare (`infotren-cors-proxy.mosqueteroweb.workers.dev`), limitado a los dos archivos de Renfe y con caché de 30 segundos. Los proxies públicos quedan solo de reserva: en la prueba previa dos de los tres no respondían. La CSP permite solo ese worker en lugar de cualquier `*.workers.dev`. Se comprobó que los datos abiertos de data.renfe.com (GTFS-RT) no evitan el proxy: tampoco permiten llamadas desde el navegador y traen menos información.

## 1.6.1 — 29 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección: en el móvil, el aviso de «tren no encontrado» quedaba debajo de los consultados recientemente y no se veía sin desplazar. Ahora sale un aviso corto en rojo justo bajo el buscador, el campo se marca como erróneo para el lector de pantalla y el aviso se borra al volver a escribir. La tarjeta con consejos sigue debajo.

## 1.6.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de accesibilidad repetida (WCAG 2.2, 5 estados × 3 anchos): buscador como cuadro combinado accesible, paradas del mapa con nombre y zona de 24 px, pestañas con flechas, respeto a «reducir movimiento» y enlaces del pie más fáciles de pulsar. axe-core sin incumplimientos. [Auditoría](docs/1.6.0/AUDITORIA_ACCESIBILIDAD.md).

## 1.5.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de seguridad repetida: proxy de Cloudflare limitado a los dos archivos de Renfe (antes aceptaba `evilrenfe.com`), CSP sin scripts en línea, validación de todos los campos usados y del historial de búsquedas, y retirada de código muerto. [Auditoría](docs/1.5.0/AUDITORIA_SEGURIDAD.md).

## 1.4.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de UX repetida en móvil, tablet y escritorio: itinerario completo sin caja con desplazamiento y con las paradas superadas plegadas, atribución de OpenStreetMap visible, una sola hora estimada, hora programada rotulada, origen y destino legibles en el móvil y en la lista. [Auditoría](docs/1.4.0/AUDITORIA_UX.md).

## 1.3.1 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Corrección: en tablet y escritorio la tabla «En circulación» medía 890 px en un espacio de 859 y la columna «Acción» quedaba cortada. Ahora la fila entera abre el tren (como en el móvil) y el botón se mantiene para teclado y lector de pantalla. Revisado a 800, 1000, 1280 y 1600 px; la auditoría de 1.3.0 solo había comprobado el ancho de móvil.

## 1.3.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de accesibilidad: etiquetas de servicio con contraste suficiente y diseño que no se rompe con letra grande (cabecera, pestañas, etiquetas y tarjetas). axe-core sin incumplimientos. [Auditoría](docs/1.3.0/AUDITORIA_ACCESIBILIDAD.md).

## 1.2.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de UX: lista «En circulación» compacta (de casi media pantalla por tren a tres líneas) y trenes sin posición GPS incluidos en la búsqueda. [Auditoría](docs/1.2.0/AUDITORIA_UX.md).

## 1.1.0 — 26 de octubre de 2026

**Autor: Mosqueteroweb.** Auditoría de seguridad: sin cambio de fuente de datos por URL, validación de los datos de los proxies, política de seguridad de contenido, fuentes servidas desde el propio sitio, copia de respaldo solo con datos válidos y acciones de GitHub fijadas. [Auditoría](docs/1.1.0/AUDITORIA_SEGURIDAD.md).

## 1.0.0 — 26 de octubre de 2026

InfoTren como repositorio independiente, procedente de la carpeta `Renfe/` de [mosqueteroweb/Web](https://github.com/mosqueteroweb/Web).
