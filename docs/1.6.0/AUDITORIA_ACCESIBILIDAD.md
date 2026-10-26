# InfoTren 1.6.0 — auditoría de accesibilidad (repetida)

Fecha: 26 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.5.0.

## Por qué se repite

La auditoría de la 1.3.0 pasó axe solo en tres pantallas, sin abrir el autocompletado ni el mapa, sin las reglas de WCAG 2.2 y sin revisar teclado, lector de pantalla ni movimiento más allá de la lista de trenes.

## Método

- axe-core con WCAG 2.0, 2.1 y 2.2 A/AA y buenas prácticas, en cinco estados (inicio, autocompletado abierto, ficha con mapa, itinerario y datos desplegados, tren no encontrado y lista) a tres anchos: 390, 768 y 1280 px.
- Revisión de títulos, zonas de la página, pestañas, autocompletado, avisos en vivo, orden y visibilidad del foco con 25 pulsaciones de Tab, tamaño de los controles, «reducir movimiento» y ajuste a 320 px.

## Hallazgos corregidos

| # | Hallazgo | Criterio | Corrección |
|---|---|---|---|
| 1 | El buscador no seguía el patrón de cuadro combinado: el lector de pantalla no sabía que había sugerencias, cuántas ni cuál estaba elegida con las flechas. La lista no tenía nombre. | 4.1.2 Nombre, función, valor | `role="combobox"`, `aria-expanded`, `aria-controls` y `aria-activedescendant`; opciones con `aria-selected`; lista «Trenes que coinciden». |
| 2 | Los puntos de parada del mapa se podían pulsar pero no tenían nombre (hasta 52 en un tren). | 4.1.2 | Cada punto se anuncia como «Parada …». |
| 3 | Esos puntos medían 14 px. | 2.5.8 Tamaño del objetivo (WCAG 2.2) | Zona de pulsación de 24 px; el punto visible sigue igual. |
| 4 | Las pestañas no respondían a las flechas y las dos recibían el foco con Tab. | Patrón de pestañas ARIA | Flechas, Inicio y Fin cambian de pestaña; solo la activa está en el orden de Tab. |
| 5 | Sin respuesta a «reducir movimiento»: marcador pulsante, fundidos, desplazamientos suaves y animación del mapa. | 2.3.3 Animación por interacción | Animaciones y desplazamientos suaves desactivados cuando el sistema lo pide, también en el JavaScript y en el mapa. |
| 6 | Enlaces del pie de 17-19 px de alto. | 2.5.8 (excepción de texto en línea) | 24 px de alto para pulsarlos con comodidad. |

## Comprobado

- axe-core: 0 incumplimientos en los 15 casos (5 estados × 3 anchos).
- Títulos H1 → H2 → H3 ordenados; zonas de cabecera, principal, navegación y pie; idioma `es`.
- Avisos en vivo para el estado de conexión y el retraso, y alerta para tren no encontrado.
- Foco visible en todo el recorrido con teclado; sin desplazamiento horizontal a 320 px.
- Todos los controles funcionan sin errores en la consola.
