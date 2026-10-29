# 🛡️ Proxy CORS Dedicado para InfoTren Renfe

Este directorio contiene la solución recomendada en el **Plan de Acción de la Auditoría** para eliminar la dependencia de proxies CORS públicos de terceros (`cors-anywhere.fly.dev`, `allorigins`, etc.), los cuales sufren cortes periódicos y límites de peticiones.

## 🚀 Despliegue en Cloudflare Workers (100% Gratuito)

Cloudflare ofrece **100.000 peticiones diarias gratis**, sin tarjetas de crédito y con latencia ultrabaja (Edge global).

### Opción A: Despliegue en 2 minutos desde el panel web de Cloudflare
1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com/) y accede a **Workers & Pages**.
2. Pulsa en **Create application** > **Create Worker**.
3. Dale un nombre (ej. `infotren-proxy`).
4. Haz clic en **Deploy**.
5. Pulsa en **Edit code**, pega el contenido de [`worker.js`](worker.js) y pulsa **Deploy**.
6. Copia tu URL asignada (ej. `https://infotren-proxy.tu-usuario.workers.dev`).

### Opción B: Despliegue mediante CLI Wrangler
```bash
cd proxy-worker
npx wrangler login
npx wrangler deploy
```

---

## ⚙️ Cómo usar tu proxy en InfoTren

InfoTren usa por defecto el worker desplegado en `https://infotren-cors-proxy.mosqueteroweb.workers.dev/?url=` (primero de `CORS_PROXIES` en `app.js`). Si cambia la dirección, hay que actualizarla también en `connect-src` de la CSP de `index.html`.

Para probar otro worker sin tocar el código (y con su dirección añadida a la CSP), desde la consola del navegador:
```javascript
localStorage.setItem('infotren_custom_proxy', 'https://otro-worker.tu-usuario.workers.dev/?url=');
```

El worker incluye además:
- **Solo para InfoTren**: responde a `https://mosqueteroweb.github.io` y a `localhost` (desarrollo); otras webs reciben un 403. Si la app cambia de dirección, hay que añadirla en `ALLOWED_ORIGINS`.
- **Validación de seguridad**: solo sirve `flotaLD.json`, `trenesConEstacionesLD.json` y `trip_updates_LD.json` (cancelaciones) de Renfe; cualquier otra dirección recibe un 403.
- **Caché Edge de 30 segundos**: Acelera drásticamente las respuestas y evita sobrecargar los servidores de Renfe.
