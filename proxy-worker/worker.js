/**
 * Cloudflare Worker: Proxy CORS seguro para InfoTren Renfe
 * Proporciona acceso sin restricciones de CORS a las APIs de telemetría de Renfe
 * y añade caché de borde (Edge Cache) de 30 segundos para reducir la latencia y la carga.
 */

// Only InfoTren itself (and a local copy while developing) may use the worker: any other website could otherwise
// spend the 100,000 free requests a day and leave the app on the backup proxies. Scripts can fake the Origin header,
// so this stops other web pages, not a determined abuser.
const ALLOWED_ORIGINS = [/^https:\/\/mosqueteroweb\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    };
}

function jsonError(status, message, origin) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...(origin ? corsHeaders(origin) : {}) }
    });
}

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get("Origin") || "";
        if (!ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
            return jsonError(403, "Este proxy solo atiende a InfoTren.", null);
        }

        // Manejo de preflight CORS (OPTIONS)
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        const url = new URL(request.url);

        // Only these public Renfe files can be fetched (live fleet, routes, and GTFS-RT updates with cancellations).
        // The old check (hostname ends with "renfe.com") also let through "evilrenfe.com" and any other Renfe address,
        // turning the worker into an open proxy.
        const ALLOWED = {
            flota: "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json",
            rutas: "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json",
            avisos: "https://gtfsrt.renfe.com/trip_updates_LD.json",
        };
        const requested = url.searchParams.get("url");
        let targetUrl = null;
        if (requested) {
            // ?url= keeps working for the app, but only with an exact allowed address (cache-busting query ignored).
            const clean = requested.split("?")[0];
            targetUrl = Object.values(ALLOWED).find((u) => u === clean) || null;
        } else if (url.pathname.includes("flota")) {
            targetUrl = ALLOWED.flota;
        } else if (url.pathname.includes("rutas") || url.pathname.includes("trenes")) {
            targetUrl = ALLOWED.rutas;
        } else if (url.pathname.includes("avisos")) {
            targetUrl = ALLOWED.avisos;
        }
        if (!targetUrl) {
            return jsonError(403, "Solo se permiten flotaLD.json, trenesConEstacionesLD.json y trip_updates_LD.json de Renfe.", origin);
        }

        // Configuración de caché Edge de Cloudflare (30 segundos). The cached copy has no CORS headers:
        // they depend on who asks and are added below.
        const cache = caches.default;
        const cacheKey = new Request(targetUrl, { method: "GET" });
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
                    return jsonError(renfeResponse.status, `Error Renfe: ${renfeResponse.status}`, origin);
                }

                const data = await renfeResponse.text();
                response = new Response(data, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "public, max-age=30, s-maxage=30",
                        "X-Proxy-By": "InfoTren-Cloudflare-Worker"
                    }
                });

                // Guardar en la caché Edge
                ctx.waitUntil(cache.put(cacheKey, response.clone()));
            } catch (err) {
                // The error text could describe Cloudflare internals: log it, do not send it.
                console.error("Fallo al leer Renfe", err);
                return jsonError(502, "Fallo de conexión al servidor de Renfe", origin);
            }
        }

        const headers = new Headers(response.headers);
        Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
        return new Response(response.body, { status: response.status, headers });
    }
};
