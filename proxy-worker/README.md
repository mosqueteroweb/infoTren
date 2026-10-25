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

Una vez desplegado tu worker, puedes activarlo en InfoTren de dos formas:

1. **Vía parámetro de URL**:
   Añade `?proxy=https://infotren-proxy.tu-usuario.workers.dev/?url=` a la URL de InfoTren.
2. **Vía consola / localStorage** (permanente en tu navegador):
   ```javascript
   localStorage.setItem('infotren_custom_proxy', 'https://infotren-proxy.tu-usuario.workers.dev/?url=');
   ```

El worker incluye además:
- **Validación de seguridad**: Rechaza peticiones hacia dominios que no pertenezcan a `renfe.com`.
- **Caché Edge de 30 segundos**: Acelera drásticamente las respuestas y evita sobrecargar los servidores de Renfe.
