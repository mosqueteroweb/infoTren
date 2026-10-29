const CACHE_NAME = 'infotren-1.7.2';
const ASSETS = [
    './',
    './index.html',
    './logo_mosqueteroweb.png',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    './style.css',
    './fonts/fonts.css',
    './fonts/plus-jakarta-sans-latin.woff2',
    './fonts/jetbrains-mono-latin.woff2',
    './app.js',
    './data/stations.json',
    './data/flotaLD.json',
    './data/trenesConEstacionesLD.json',
    './data/programados.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (
                    response &&
                    response.status === 200 &&
                    (event.request.url.startsWith(self.location.origin) || event.request.url.includes('unpkg.com/leaflet'))
                ) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
