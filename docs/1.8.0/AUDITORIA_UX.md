# InfoTren 1.8.0 — auditoría de UX (repetida)

Fecha: 29 de octubre de 2026. Autor público: Mosqueteroweb. Versión evaluada: 1.7.4.

## Por qué se repite

Las versiones 1.7.x añadieron estados que la auditoría de la 1.4.0 no podía cubrir: tren programado, cancelado y «sin datos en directo», la lista «Próximas salidas» y la búsqueda por estación.

## Método

Ocho estados (ficha en directo de un tren en doble composición, programado, cancelado, sin datos en directo, número no encontrado, ciudad no encontrada, lista filtrada por ciudad y «Próximas salidas» con y sin filtro) a tres anchos: móvil 390 px, tablet 768 px y escritorio 1280 px. Medición de cuántos trenes de viaje no tienen datos en directo. Contraste de los colores nuevos calculado con la fórmula de WCAG.

## Medición: trenes de viaje sin datos en directo

A las 13:45, de los 89 trenes no cancelados que según el horario iban de camino, 52 estaban en el visor en directo (antes de la 1.7.4 eran 30 de 81). Los 37 restantes son sobre todo de Media Distancia (16) y Regionales (9). La otra fuente en directo de Renfe (`vehicle_positions_LD`) sigue exactamente los mismos trenes, así que esos 37 no se pueden obtener en directo de ningún sitio.

## Hallazgos corregidos

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | Filtrada por una estación, «Próximas salidas» se ordenaba por la hora de salida del origen, no por la hora en esa estación (13:56, 15:14, 14:33, 14:30…), y seguía mostrando trenes que ya habían pasado por ella. | Orden por la hora en la estación; se quitan los que pasaron hace más de 5 minutos. |
| 2 | Los avisos «PROGRAMADO» y «SIN DATOS EN DIRECTO» eran verdes, el color de «En hora». | Aviso neutro (gris), contraste 14:1. |
| 3 | Un tren sin datos en directo cuya salida ya había pasado decía «SALE DE: Madrid Atocha · Salida programada 10:05» a las 13:45. | «SEGÚN EL HORARIO, LLEGARÍA A: Jerez Frontera · 14:03 · Sin confirmar en directo», con el itinerario marcado «Superada según el horario» y «Próxima según el horario». |
| 4 | En «Próximas salidas», los cancelados (hasta un tercio de las filas hoy) pesaban igual que los que salen. | Origen, destino y hora en gris (7,6:1) y la hora tachada; «Cancelado» sigue en rojo (6,5:1). Se descartó bajar la opacidad: dejaba el texto en unos 3:1. |
| 5 | (Corregido en 1.7.x durante la jornada.) Tarjeta en blanco cuando un filtro no daba resultados en el móvil; búsqueda por ciudad tratada como número de tren; paradas intermedias fuera de la búsqueda; página nueva con `app.js` antiguo tras publicar. | Ver el historial de cambios de 1.7.1 a 1.7.3. |

## Comprobado

- Sin desplazamiento horizontal en ninguno de los ocho estados a 390, 768 y 1280 px; la tabla de escritorio cabe sin barra propia.
- La lista de «Próximas salidas» muestra 200 filas y avisa de cuántas hay; escribir una estación las reduce.

## Pendiente

- Los trenes de viaje sin datos en directo solo aparecen al buscar su número. Mostrarlos también en la búsqueda por estación queda a decisión del autor (solo los que aún no han pasado por ella, o todos).
- No se ha pasado axe-core en esta auditoría: la CSP no deja cargarlo en la página publicada. La última pasada sin incumplimientos es la de la 1.6.0.
