/**
 * Cloudflare Worker: Proxy CORS seguro para InfoTren Renfe
 * Proporciona acceso sin restricciones de CORS a las APIs de telemetría de Renfe
 * y añade caché de borde (Edge Cache) de 30 segundos para reducir la latencia y la carga.
 */

export default {
    async fetch(request, env, ctx) {
        // Manejo de preflight CORS (OPTIONS)
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Accept",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }

        const url = new URL(request.url);
        
        // El cliente pasa la URL de Renfe en el parámetro 'url' o en el path
        // Ejemplo: https://mi-proxy.workers.dev/?url=https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json
        let targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
            // Si no viene como parámetro, permitir paths directos /flota o /rutas
            if (url.pathname.includes("flota")) {
                targetUrl = "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json";
            } else if (url.pathname.includes("rutas") || url.pathname.includes("trenes")) {
                targetUrl = "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json";
            } else {
                return new Response(
                    JSON.stringify({ 
                        status: "ok", 
                        message: "Proxy CORS para InfoTren Renfe activo.",
                        usage: "/?url=https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json"
                    }), 
                    {
                        headers: { 
                            "Content-Type": "application/json; charset=utf-8",
                            "Access-Control-Allow-Origin": "*" 
                        }
                    }
                );
            }
        }

        // Validación de seguridad: permitir únicamente dominios oficiales de Renfe
        try {
            const parsedTarget = new URL(targetUrl);
            if (!parsedTarget.hostname.endsWith("renfe.com")) {
                return new Response(JSON.stringify({ error: "Dominio no permitido. Solo se aceptan peticiones a renfe.com" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: "URL inválida" }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // Configuración de caché Edge de Cloudflare (30 segundos)
        const cache = caches.default;
        const cacheKey = new Request(targetUrl, request);
        let response = await cache.match(cacheKey);

        if (!response) {
            try {
                const renfeResponse = await fetch(targetUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json"
                    }
                });

                if (!renfeResponse.ok) {
                    return new Response(JSON.stringify({ error: `Error Renfe: ${renfeResponse.status}` }), {
                        status: renfeResponse.status,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                    });
                }

                const data = await renfeResponse.text();
                response = new Response(data, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=30, s-maxage=30",
                        "X-Proxy-By": "InfoTren-Cloudflare-Worker"
                    }
                });

                // Guardar en la caché Edge
                ctx.waitUntil(cache.put(cacheKey, response.clone()));
            } catch (err) {
                return new Response(JSON.stringify({ error: "Fallo de conexión al servidor de Renfe", details: err.message }), {
                    status: 502,
                    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                });
            }
        }

        return response;
    }
};
