# 🚆 InfoTren — trenes de Renfe en tiempo real

[![Abrir InfoTren](https://img.shields.io/badge/Abrir-InfoTren-571661?style=for-the-badge)](https://mosqueteroweb.github.io/infoTren/)

Aplicación web (PWA) para seguir los trenes de Larga y Media Distancia de Renfe: retraso, próxima parada, recorrido, material rodante y posición en el mapa. Pensada para leerse bien a cualquier edad, se instala en el móvil como una app.

**Autor: Mosqueteroweb.** Licencia [GPLv3](LICENSE).

## Qué hace

- **Busca tu tren** por número comercial o por ciudad.
- **Puntualidad**: retraso en minutos y próxima parada con su hora estimada.
- **Recorrido completo** con las paradas pasadas y pendientes.
- **Mapa** con la posición GPS del tren (Leaflet y OpenStreetMap).
- **Trenes en circulación**: lista filtrable de toda la flota que viaja en ese momento.
- **Sin conexión**: si no hay red, usa la última copia de los datos.

## Cómo funciona

Es una web estática alojada en GitHub Pages. Los datos salen del visor público de Renfe (`tiempo-real.largorecorrido.renfe.com`). Como Renfe no permite llamadas directas desde el navegador, la app los pide a través de un proxy CORS. En [`proxy-worker/`](proxy-worker/) hay un proxy propio para Cloudflare Workers.

El flujo `update-trains.yml` guarda cada 2 horas una copia de respaldo en `data/`, que la app usa si no puede leer los datos en directo.

## Desarrollo

No necesita compilación: basta con servir la carpeta.

```sh
python3 -m http.server 8000
```

y abrir `http://localhost:8000/`. La integración continua comprueba la sintaxis de JavaScript, los JSON y el HTML.

## Historia

InfoTren nació dentro del repositorio [`mosqueteroweb/Web`](https://github.com/mosqueteroweb/Web) (carpeta `Renfe/`), donde se conserva su historial hasta el 25 de octubre de 2026. La auditoría de entonces está en [`docs/`](docs/).
