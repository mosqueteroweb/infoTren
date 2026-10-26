# InfoTren 1.2.0 — auditoría de UX

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.1.0.

## Método

Recorrido en Chrome con pantalla de móvil (390 × 844) y datos reales: inicio, búsqueda con autocompletado, ficha de un tren y lista «En circulación».

## Hallazgos corregidos

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | En el móvil cada tren de «En circulación» ocupaba casi media pantalla (siete filas con etiqueta y un botón). Con más de 120 trenes la lista medía unos 49.000 píxeles: unas 130 pantallas de desplazamiento. | Tarjeta de tres líneas: número, servicio y retraso; origen → destino; próxima parada. Caben 6-7 trenes por pantalla. La tarjeta entera abre el tren; el botón se mantiene para teclado y lector de pantalla. El material se consulta en la ficha. |
| 2 | Los trenes que Renfe publica sin posición GPS (`trenesNoPosicionados`) no aparecían ni se podían buscar, aunque sí tienen retraso y próxima parada. | Se incluyen en la búsqueda y en la lista; simplemente no tienen marcador en el mapa. |

## Sin cambios

La ficha del tren (estado de retraso destacado, próxima parada, origen y destino, secciones plegables de mapa, itinerario y datos técnicos) y el buscador con autocompletado funcionan bien y se mantienen.
