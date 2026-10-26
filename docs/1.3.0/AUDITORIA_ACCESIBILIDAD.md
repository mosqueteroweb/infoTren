# InfoTren 1.3.0 — auditoría de usabilidad y accesibilidad

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.2.0.

## Método

- Análisis automático con axe-core (WCAG 2.1 A y AA) en inicio, «En circulación» y ficha de un tren, en Chrome con pantalla de móvil.
- Uso solo con teclado de la lista de trenes.
- Texto grande: botón A+ de la app al máximo (124 %) y letra del navegador al 200 %.

## Hallazgos corregidos

| # | Hallazgo | Criterio | Corrección |
|---|---|---|---|
| 1 | Etiquetas de servicio con texto blanco sin contraste suficiente: Alvia 2,85:1, Diurno 2,94:1, Talgo 3,3:1, Altaria 3,56:1, Tren Hotel 3,74:1, Avant 4,1:1 (86 casos). | Contraste 4,5:1 (WCAG 1.4.3) | Tonos algo más oscuros del mismo color, todos por encima de 4,6:1. |
| 2 | Con letra al 200 %, la fila de botones de la cabecera medía 495 px en una pantalla de 390 y desplazaba toda la página: el contenido quedaba cortado por la izquierda. | Ajuste del contenido (WCAG 1.4.10) | Los botones de la cabecera pasan a la línea siguiente. |
| 3 | Con texto grande, el contador de «En Circulación» se montaba sobre el texto de la pestaña y las etiquetas rápidas de trenes se solapaban. | WCAG 1.4.4 | Pestañas, etiquetas y tarjetas pasan a varias líneas en lugar de solaparse. |

## Comprobaciones sin hallazgos

- axe-core: 0 incumplimientos tras las correcciones en las tres pantallas.
- Lista de trenes con teclado: el botón «Ver ficha del tren #…» recibe el foco (resaltado en la tarjeta) y abre la ficha.
- Pestañas con `role="tab"` y `aria-selected`; botones con nombre accesible; mapa con alternativa en el itinerario.
