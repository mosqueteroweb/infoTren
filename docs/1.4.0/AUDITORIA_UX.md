# InfoTren 1.4.0 — auditoría de UX (repetida)

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.3.1.

## Por qué se repite

La auditoría de UX de la 1.2.0 solo revisó la pantalla de móvil y no desplegó las secciones de la ficha. Se le escaparon la tabla cortada en tablet y escritorio (corregida en 1.3.1) y los fallos de esta lista.

## Método

Seis pantallas y estados (inicio, autocompletado, ficha, ficha con mapa, itinerario y datos técnicos desplegados, tren no encontrado y lista «En circulación») a tres anchos: móvil 390 px, tablet 768 px y escritorio 1280 px. También el tren con más paradas del momento (90) y la tabla a 800, 1000, 1280 y 1600 px.

## Hallazgos corregidos

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | El itinerario estaba en una caja de altura fija con desplazamiento propio: en un tren de 6 paradas la última (el destino) quedaba oculta, en los tres anchos. | Sin desplazamiento interno: se ven todas las paradas pendientes. |
| 2 | Con trenes regionales de 50-90 paradas, el itinerario completo se hace interminable. | Las paradas ya superadas se pliegan salvo la última, con un botón «Ver las N paradas anteriores». |
| 3 | La leyenda del mapa tapaba «© OpenStreetMap», atribución que exige la licencia del mapa. | Leyenda arriba a la derecha. |
| 4 | La misma llegada aparecía como 12:13 en «Próxima parada» y 12:14 en el itinerario (dato de Renfe frente a horario + retraso). | El itinerario usa la misma hora estimada de Renfe. |
| 5 | La hora del recuadro del itinerario no decía qué era; junto a «Est. 12:14» confundía. | Rotulada como «Prog.» (programada). |
| 6 | En el móvil, la tarjeta de origen y destino partía «Pamplona Iruña» y «Llegada: 13:59» en varias líneas. | Origen encima del destino en pantallas estrechas; las horas no se parten. |
| 7 | En la lista de móvil y tablet el destino quedaba en el borde derecho, separado de la flecha. | «Madrid Atocha → Pamplona Iruña» en una sola línea. |

## Comprobado

- Sin desplazamiento horizontal ni contenido cortado en los tres anchos.
- axe-core sin incumplimientos en móvil y escritorio; la app carga sin errores en consola.
