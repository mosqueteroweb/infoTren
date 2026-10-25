# 🚆 Auditoría Integral de Software: InfoTren Renfe

- **Proyecto**: `renfe` (InfoTren)
- **Ruta local**: `/Users/pedro/renfe`
- **Fecha de auditoría**: Octubre 2026
- **Tipo de aplicación**: PWA Web estática (Vanilla JS + Leaflet + Service Worker)
- **Calificación Global**: **7.5 / 10**

---

## 1. Resumen Ejecutivo y Ficha Técnica

InfoTren Renfe es una aplicación web interactiva (PWA) orientada a la consulta y seguimiento en tiempo real de trenes de Renfe en España (puntualidad, composición, material rodante y posición GPS interactiva). Está concebida para alojarse de forma 100% estática en GitHub Pages (`mosqueteroweb.github.io/web/Renfe/`).

El núcleo de la aplicación es funcional, ligero y accesible, pero adolece de dependencias críticas en proxys CORS públicos no confiables, falta de modularidad en el código JavaScript y archivos duplicados/experimentales en el repositorio.

---

## 2. Seguridad y Privacidad

- **Calificación**: **7.0 / 10**

### Hallazgos
1. **Dependencia de Proxys CORS Públicos de Terceros (Riesgo Alto)**:
   - En `app.js` (líneas 12-17), se utilizan proxys públicos (`cors-anywhere.fly.dev`, `api.allorigins.win`, `api.codetabs.com`).
   - *Impacto*: Los datos de las consultas y la IP del cliente viajan a través de servicios externos sin SLA ni garantía de privacidad. Si un proxy es vulnerado o sustituido, podría inyectar payloads JSON maliciosos (XSS indirecto) o provocar denegación de servicio por caída/rate-limiting.
2. **Encabezados de Seguridad y CSP**:
   - `index.html` incluye `<meta name="referrer" content="strict-origin-when-cross-origin">` y `<meta http-equiv="X-Content-Type-Options" content="nosniff">`, lo cual es una excelente práctica.
   - Sin embargo, carece de una política de seguridad de contenido estricta (`Content-Security-Policy`), lo que permitiría que scripts externos no controlados se ejecuten si un CDN o proxy resulta comprometido.
3. **Manejo de Secretos y Credenciales**:
   - **Limpio**: No se detectaron API keys, contraseñas ni tokens privados hardcodeados en el repositorio.

---

## 3. Arquitectura y Calidad de Código

- **Calificación**: **6.5 / 10**

### Hallazgos
1. **Monolito en `app.js` (1.524 líneas)**:
   - Toda la lógica (mapeo de modelos, llamadas de red con reintentos de proxys, manipulación del DOM, inicialización del mapa Leaflet, timers de polling y lógica de PWA) reside en un único archivo.
   - *Recomendación*: Modularizar en ES Modules (`src/config.js`, `src/api.js`, `src/map.js`, `src/ui.js`).
2. **Archivo Monolítico Duplicado `infotren_ag.html` (3.703 líneas - 369 KB)**:
   - Coexiste en la carpeta `Renfe/` junto a `index.html`. Embebe todo el CSS y JS en un único fichero masivo. Además, está incluido en el precache del `sw.js`, duplicando el consumo de almacenamiento y ancho de banda en la instalación PWA.
3. **Contaminación de la raíz del repositorio**:
   - En la raíz `/Users/pedro/renfe` conviven archivos de cálculo solar (`solar.html`, `solar2.html`, `Solar_G38FH.html`, `ArgonComp.html`, `solar.md`) que no guardan relación con la app de Renfe.

---

## 4. Dependencias y Ciclo de Vida

- **Calificación**: **8.5 / 10**

### Hallazgos
1. **Zero-Dependencies locales**:
   - No depende de `node_modules` ni de gestores de paquetes como npm. No hay riesgo directo de vulnerabilidades en cadena de suministro de paquetes npm.
2. **CDN Externo de Leaflet**:
   - Usa Leaflet 1.9.4 vía `unpkg.com` con hash de integridad SRI (`integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="`). Es una práctica correcta y segura contra manipulación en tránsito.
3. **Soporte Offline con Datos Locales**:
   - Incluye copias locales de respaldo (`flotaLD.json`, `trenesConEstacionesLD.json`, `stations.json`) en caso de fallo de conexión.

---

## 5. Rendimiento y PWA

- **Calificación**: **7.5 / 10**

### Hallazgos
1. **Pre-cacheo excesivo en Service Worker (`sw.js`)**:
   - `sw.js` descarga en el evento `install` casi 1 MB de assets estáticos de una sola vez, incluyendo `infotren_ag.html` (innecesario si la app corre sobre `index.html`) y archivos JSON grandes.
2. **Estrategia de Caché**:
   - Utiliza *Network-First* con fallback a Cache. Para APIs de telemetría en tiempo real es adecuado, pero ante una red inestable o proxies lentos, la UI puede quedar bloqueada esperando el timeout de red antes de mostrar los datos en caché.
3. **Optimización de Fuentes**:
   - Carga fuentes de Google (`Plus Jakarta Sans` y `JetBrains Mono`) mediante `preconnect`. Buena práctica.

---

## 6. Mantenibilidad y CI/CD

- **Calificación**: **7.0 / 10**

### Hallazgos
1. **Ausencia de Pipeline de CI / Pruebas Automatizadas**:
   - No hay GitHub Actions configuradas para linting (HTMLHint, ESLint) ni comprobación de enlaces o JSONs de estaciones.
2. **Documentación**:
   - `Renfe/README.md` es excelente, documenta claramente la funcionalidad, el material rodante y las instrucciones para GitHub Pages.

---

## 7. Plan de Acción y Recomendaciones (Estado: Implementado)

### 🔴 Crítico / Prioridad Alta
- [x] **Sustituir o asegurar el mecanismo CORS**: Implementado Cloudflare Worker dedicado en `proxy-worker/` con validación de seguridad hacia `renfe.com` y caché Edge de 30s. Añadido soporte dinámico de proxy configurable vía `localStorage` o URL en `app.js`. Mejorada la GitHub Action `.github/workflows/update-trains.yml` a sincronización cada 2 horas para mantener la telemetría local de respaldo siempre al día.
- [x] **Limpiar `infotren_ag.html` del caché PWA**: Eliminado `./infotren_ag.html` del array `ASSETS` en `Renfe/sw.js` y actualizada la versión de caché a `infotren-pwa-v6`, reduciendo ~370 KB de descarga en la instalación.

### 🟡 Medio / Importante
- [x] **Modularizar `app.js`**: Desacoplado en arquitectura modular ES6 bajo `Renfe/src/` (`config.js`, `state.js`, `utils.js`, `api.js`, `map.js`, `main.js`), manteniendo retrocompatibilidad total con `app.js`.
- [x] **Separar archivos solares de la raíz**: Reubicados todos los prototipos y comparativas solares (`solar*.html`, `*Comp.html`, `solar.md`) dentro de su propio directorio `solar/`.

### 🟢 Bajo / Mejora Continua
- [x] **Implementar CI con GitHub Actions**: Creado `.github/workflows/ci.yml` para validar automáticamente en cada push y PR la sintaxis de JavaScript (`node --check`), la integridad de todos los archivos JSON del repositorio y las reglas estructurales de HTML con HTMLHint.
- [x] **Identidad y Autoría Oficial Mosqueteroweb**: Integrada la autoría de Pedro Mosqueteroweb al pie de la pantalla principal (`Renfe/index.html` e `infotren_ag.html`), con el logotipo circular oficial (`logo_mosqueteroweb.png`), enlaces a GitHub, email y licencia GPL-3.0.
