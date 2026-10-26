/**
 * INFOTREN RENFE - APLICACIÓN EN TIEMPO REAL (PWA)
 * Consulta y telemetría accesible de trenes en circulación en la red española.
 */

// ============================================================================
// CONFIGURACIÓN Y MAPEOS
// ============================================================================

// A personal proxy (e.g. the Cloudflare worker in proxy-worker/) can be set from the browser console:
//   localStorage.setItem('infotren_custom_proxy', 'https://….workers.dev/?url=')
// It is no longer accepted from the page URL: a shared link could otherwise feed the app invented delays and positions.
const customProxy = (() => {
    try {
        const value = localStorage.getItem('infotren_custom_proxy');
        return value && /^https:\/\/[^\s"'<>]+$/.test(value) ? value : null;
    } catch (e) { return null; }
})();

const CONFIG = {
    CORS_PROXIES: [
        ...(customProxy ? [customProxy] : []),
        'https://cors-anywhere.fly.dev/',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        ''
    ],
    CURRENT_PROXY_INDEX: 0,
    POLL_INTERVAL: 30000, // 30 segundos
    FLEET_URL: 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json',
    ROUTES_URL: 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json',
    LOCAL_FLEET_URL: './data/flotaLD.json',
    LOCAL_ROUTES_URL: './data/trenesConEstacionesLD.json',
    STATIONS_URL: './data/stations.json'
};

const PRODUCTS = {
    1: { name: 'Largo Recorrido', badge: 'largo', color: '#475569' },
    2: { name: 'AVE', badge: 'ave', color: '#d32f2f' },
    3: { name: 'Avant', badge: 'avant', color: '#027ab8' },
    4: { name: 'Talgo', badge: 'talgo', color: '#12843c' },
    5: { name: 'Altaria', badge: 'altaria', color: '#c84b0a' },
    6: { name: 'Euromed', badge: 'euromed', color: '#1e3a8a' },
    7: { name: 'Diurno', badge: 'diurno', color: '#9d6b03' },
    8: { name: 'Estrella', badge: 'estrella', color: '#9333ea' },
    9: { name: 'Tren Hotel', badge: 'trenhotel', color: '#0b8177' },
    10: { name: 'Trenhotel', badge: 'trenhotel', color: '#0b8177' },
    11: { name: 'Alvia', badge: 'alvia', color: '#b25e14' },
    12: { name: 'Arco', badge: 'arco', color: '#475569' },
    13: { name: 'Intercity', badge: 'intercity', color: '#475569' },
    14: { name: 'Talgo 200', badge: 'talgo', color: '#12843c' },
    15: { name: 'Media Distancia', badge: 'md', color: '#0b8177' },
    16: { name: 'Media Distancia', badge: 'md', color: '#0b8177' },
    17: { name: 'Cercanías', badge: 'cercanias', color: '#e11d48' },
    18: { name: 'Regional', badge: 'regional', color: '#12843c' },
    19: { name: 'Regional Exprés', badge: 'regional', color: '#2563eb' },
    20: { name: 'Alaris', badge: 'alaris', color: '#b25e14' },
    25: { name: 'AVE TGV', badge: 'ave', color: '#b91c1c' },
    28: { name: 'AVLO', badge: 'avlo', color: '#8e44ad' },
    29: { name: 'Trenhotel', badge: 'trenhotel', color: '#0b8177' }
};

// Sin paréntesis para evitar saltos de línea rotos en móvil
const ROLLING_STOCK = {
    '100': 'Alstom Serie 100 · AVE',
    '102': 'Talgo 350 Serie 102',
    '103': 'Siemens Velaro Serie 103 · AVE',
    '106': 'Talgo Avril Serie 106',
    '107': 'Talgo Avril Serie 107',
    '112': 'Talgo 350 Serie 112',
    '114': 'Alstom Serie 114 · Avant',
    '120': 'CAF Serie 120 · Alvia',
    '121': 'CAF Serie 121 · Avant y MD',
    '130': 'Talgo 250 Serie 130 · Alvia',
    '730': 'Talgo 250 Dual Serie 730',
    '449': 'CAF Serie 449 · Media Distancia',
    '599': 'CAF Serie 599 · MD Diésel',
    '598': 'CAF Nexios Serie 598',
    '448': 'Serie 448 · Regional Exprés',
    '470': 'Serie 470 · Regional Exprés'
};

// ============================================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================

const state = {
    fleet: [],
    routes: [],
    stations: {},
    currentTrain: null,
    map: null,
    mapLayers: {
        trainMarker: null,
        routeLine: null,
        stationMarkers: []
    },
    activeTab: 'search',
    fleetFilter: 'all',
    fleetSearchQuery: '',
    pollTimer: null,
    lastUpdated: null,
    fontScaleIndex: 0, // 0 = 100%, 1 = 112%, 2 = 124%
    deferredInstallPrompt: null,
    autocompleteSelectedIndex: -1
};

const RECENT_KEY = 'infotren_recent_searches';
const FONT_SCALE_KEY = 'infotren_font_scale';
const CACHE_FLEET_KEY = 'infotren_cached_fleet';
const CACHE_ROUTES_KEY = 'infotren_cached_routes';

// ============================================================================
// FUNCIONES DE UTILIDAD, SEGURIDAD Y NORMALIZACIÓN
// ============================================================================

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Data arrives through third-party proxies: keep only well-formed trains before showing or caching it.
const isShortText = (v, max = 40) => typeof v === 'string' && v.length > 0 && v.length <= max;
const isCode = (v) => v === undefined || v === null || isShortText(String(v), 12);

const isTimeText = (v) => v === undefined || v === null || (typeof v === 'string' && v.length <= 25);

function validTrain(t) {
    if (!t || typeof t !== 'object' || !isShortText(t.codComercial, 10)) return false;
    if (!isTimeText(t.horaLlegadaSigEst)) return false;
    if (t.codProduct !== undefined && !Number.isInteger(t.codProduct)) return false;
    if (![t.codOrigen, t.codDestino, t.codEstSig, t.codEstAnt, t.mat, t.ultRetraso].every(isCode)) return false;
    const hasPosition = t.latitud !== undefined || t.longitud !== undefined;
    return !hasPosition || (Number.isFinite(t.latitud) && Number.isFinite(t.longitud) &&
        Math.abs(t.latitud) <= 90 && Math.abs(t.longitud) <= 180);
}

function validateFleet(data) {
    if (!data || !Array.isArray(data.trenes)) return null;
    const unpositioned = Array.isArray(data.trenesNoPosicionados) ? data.trenesNoPosicionados.filter(validTrain) : [];
    return { ...data, trenes: data.trenes.filter(validTrain).slice(0, 2000), trenesNoPosicionados: unpositioned.slice(0, 2000) };
}

function validateRoutes(data) {
    if (!data || !Array.isArray(data.trenes)) return null;
    const trenes = data.trenes.filter((r) => r && isShortText(String(r.idTren), 10) && Array.isArray(r.estaciones))
        .map((r) => ({ ...r, estaciones: r.estaciones.filter((s) => s && isShortText(String(s.p), 12) && isTimeText(s.h) && isTimeText(s.hs)).slice(0, 200) }))
        .slice(0, 2000);
    return { ...data, trenes };
}

function sanitizeInput(str) {
    if (!str) return '';
    return String(str).trim().replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ.-]/g, '').substring(0, 20);
}

function normalizeTrainId(val) {
    if (!val) return '';
    const clean = String(val).trim().replace(/^0+/, '');
    return clean || '0';
}

function getProductInfo(code) {
    return PRODUCTS[code] || { name: 'Tren Renfe', badge: 'renfe', color: '#571661' };
}

function getMaterialInfo(mat) {
    if (!mat) return { name: 'Composición Renfe', code: '--' };
    const strMat = String(mat);
    const prefix = strMat.substring(0, 3);
    const series = ROLLING_STOCK[prefix] || `Serie ${prefix}`;
    return {
        name: series,
        code: strMat
    };
}

/**
 * Obtiene el objeto estación a partir de su código (con o sin ceros iniciales).
 */
function lookupStation(code) {
    if (!code) return null;
    const cleanCode = String(code).trim();
    const normCode = cleanCode.replace(/^0+/, '') || '0';
    const entry = state.stations[cleanCode] || state.stations[normCode];
    if (!entry) return null;
    if (Array.isArray(entry)) {
        return { n: entry[0], lat: entry[1], lon: entry[2] };
    }
    return entry;
}

/**
 * Resuelve el nombre limpio de una estación (acepta tanto código numérico como nombre).
 * Elimina cualquier paréntesis residual como "(apd)".
 */
function getStationName(codeOrName) {
    if (!codeOrName) return 'Estación';
    const clean = String(codeOrName).trim();
    const st = lookupStation(clean);
    if (st && st.n) {
        return String(st.n).replace(/\s*\([^)]*\)/g, '').trim();
    }
    if (/^\d+$/.test(clean)) {
        return `Estación ${clean}`;
    }
    return clean.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Formatea y acorta nombres de estaciones para personas mayores (+80 años):
 * - Estrictamente MÁXIMO 15 caracteres.
 * - Nombres claros de ciudad sin paréntesis ni cortes bruscos.
 * - Funciona tanto si recibe un código ("60000") como un nombre ("Madrid-Puerta De Atocha").
 */
function formatStationMax15(codeOrName) {
    if (!codeOrName) return '--';
    const raw = getStationName(codeOrName);
    if (!raw || raw === 'Estación') return '--';

    const lower = raw.toLowerCase();

    // Reglas específicas de ciudades y grandes estaciones
    if (lower.includes('puerta de atocha') || lower.includes('atocha')) return 'Madrid Atocha';
    if (lower.includes('chamartin') || lower.includes('chamartín')) return 'M. Chamartín';
    if (lower.includes('principe pio') || lower.includes('príncipe pío')) return 'M. Príncipe Pío';
    if (lower.includes('barcelona') && lower.includes('sants')) return 'Barcelona Sants';
    if (lower.includes('barcelona') && (lower.includes('franca') || lower.includes('frança'))) return 'Barna França';
    if (lower.includes('figueres')) return 'Figueres';
    if (lower.includes('joaquín sorolla') || lower.includes('joaquin sorolla')) return 'Valencia J.S.';
    if (lower.includes('valencia') && lower.includes('nord')) return 'Valencia Nord';
    if (lower.includes('santa justa')) return 'Sevilla S.J.';
    if (lower.includes('zaragoza') && lower.includes('delicias')) return 'Zaragoza Del.';
    if (lower.includes('zaragoza') && lower.includes('miraflores')) return 'Z. Miraflores';
    if (lower.includes('zaragoza') && lower.includes('portillo')) return 'Z. Portillo';
    if (lower.includes('campo grande')) return 'Valladolid';
    if (lower.includes('zambrano')) return 'Málaga M.Z.';
    if (lower.includes('camp de tarragona')) return 'Camp Tarragona';
    if (lower.includes('lleida')) return 'Lleida';
    if (lower.includes('santiago de compostela')) return 'Santiago Comp.';
    if (lower.includes('donostia') || lower.includes('san sebastián') || lower.includes('san sebastian')) return 'San Sebastián';
    if (lower.includes('alacant') || lower.includes('alicante')) return 'Alicante';
    if (lower.includes('castelló') || lower.includes('castellon')) return 'Castellón';
    if (lower.includes('elx') || lower.includes('elche')) return 'Elche AV';
    if (lower.includes('fernando zóbel') || lower.includes('fernando zobel')) return 'Cuenca F.Z.';
    if (lower.includes('guiomar')) return 'Segovia Guiomar';
    if (lower.includes('sanabria')) return 'Sanabria AV';
    if (lower.includes('puente genil')) return 'Puente Genil';
    if (lower.includes('antequera') && lower.includes('santa ana')) return 'Antequera S.A.';
    if (lower.includes('antequera')) return 'Antequera';
    if (lower.includes('jerez de la frontera')) return 'Jerez Frontera';
    if (lower.includes('puerto de santa')) return 'El Puerto S.M.';
    if (lower.includes('san fernando')) return 'San Fernando';
    if (lower.includes('alcázar de san juan') || lower.includes('alcazar de san juan')) return 'Alcázar S.Juan';
    if (lower.includes('medina del campo')) return 'Medina Campo';
    if (lower.includes('miranda de ebro')) return 'Miranda Ebro';
    if (lower.includes('tudela de navarra')) return 'Tudela Navarra';
    if (lower.includes('villafranca de los barros')) return 'Villafranca B.';
    if (lower.includes('villanueva de córdoba') || lower.includes('villanueva de cordoba')) return 'Villanueva Cór.';

    let cleaned = raw.replace(/\s*[-–—/]\s*/g, ' ').trim();
    if (cleaned.length <= 15) return cleaned;

    const firstPart = raw.split(/[-–—/]/)[0].trim();
    if (firstPart.length >= 4 && firstPart.length <= 15) return firstPart;

    cleaned = firstPart.replace(/\b(De La|De Los|De Las|Del|De)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 15) return cleaned;

    return cleaned.substring(0, 15).trim();
}

function cleanStationName(codeOrName) {
    return formatStationMax15(codeOrName);
}

function getStationCoords(code) {
    const st = lookupStation(code);
    if (st && st.lat && st.lon) {
        return [st.lat, st.lon];
    }
    return null;
}

function formatDelay(delayStr) {
    const min = parseInt(delayStr, 10);
    if (isNaN(min) || min === 0) {
        return { text: 'En hora · Sin retraso', class: 'ontime', min: 0 };
    }
    if (min < 0) {
        return { text: `Adelantado ${Math.abs(min)} min`, class: 'ontime', min };
    }
    if (min <= 5) {
        return { text: `Retraso leve +${min} min`, class: 'ontime', min };
    }
    if (min <= 15) {
        return { text: `Retraso +${min} min`, class: 'slight', min };
    }
    return { text: `Retraso +${min} min`, class: 'heavy', min };
}

function addMinutesToTime(hhmm, minutesToAdd) {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm) || !minutesToAdd || minutesToAdd <= 0) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const total = (h * 60 + m + minutesToAdd) % (24 * 60);
    const nh = String(Math.floor(total / 60)).padStart(2, '0');
    const nm = String(total % 60).padStart(2, '0');
    return `${nh}:${nm}`;
}

// ============================================================================
// ESCALADO DE FUENTE ACCESIBLE (A+) Y BÚSQUEDAS RECIENTES
// ============================================================================

function applyFontScale(idx) {
    state.fontScaleIndex = idx % 3;
    const html = document.documentElement;
    const btn = document.getElementById('fontScaleBtn');
    html.classList.remove('font-large', 'font-xlarge');

    if (state.fontScaleIndex === 1) {
        html.classList.add('font-large');
        if (btn) {
            btn.textContent = 'A++';
            btn.classList.add('active');
        }
    } else if (state.fontScaleIndex === 2) {
        html.classList.add('font-xlarge');
        if (btn) {
            btn.textContent = 'A-';
            btn.classList.add('active');
        }
    } else {
        if (btn) {
            btn.textContent = 'A+';
            btn.classList.remove('active');
        }
    }
    try {
        localStorage.setItem(FONT_SCALE_KEY, String(state.fontScaleIndex));
    } catch (e) {}
}

function cycleFontScale() {
    applyFontScale(state.fontScaleIndex + 1);
}

function loadSavedFontScale() {
    try {
        const saved = parseInt(localStorage.getItem(FONT_SCALE_KEY), 10);
        if (!isNaN(saved) && saved >= 0 && saved <= 2) {
            applyFontScale(saved);
        }
    } catch (e) {}
}

function getRecentSearches() {
    try {
        const stored = localStorage.getItem(RECENT_KEY);
        const list = stored ? JSON.parse(stored) : [];
        // Only well-formed entries: this list is rendered back into the page.
        return Array.isArray(list) ? list.filter((r) => r && isShortText(String(r.num), 10) && isShortText(String(r.prod), 40)).slice(0, 10) : [];
    } catch (e) {
        return [];
    }
}

function saveRecentSearch(trainNumber, prodName) {
    if (!trainNumber) return;
    try {
        const clean = sanitizeInput(trainNumber);
        let recents = getRecentSearches().filter(r => r.num !== clean);
        recents.unshift({ num: clean, prod: prodName || 'Tren' });
        recents = recents.slice(0, 4);
        localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
        renderRecentSearches();
    } catch (e) {}
}

function renderRecentSearches() {
    const box = document.getElementById('recentAccess');
    const container = document.getElementById('recentChips');
    if (!box || !container) return;

    const recents = getRecentSearches();
    if (!recents || recents.length === 0) {
        box.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    recents.forEach(r => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip recent-chip';
        chip.innerHTML = `<span>#${escapeHTML(r.num)}</span> <small style="color:var(--text-muted);font-weight:800;">· ${escapeHTML(r.prod)}</small>`;
        chip.onclick = () => {
            const input = document.getElementById('trainInput');
            if (input) input.value = r.num;
            searchTrain(r.num);
        };
        container.appendChild(chip);
    });
    box.style.display = 'flex';
}

async function shareTrain() {
    if (!state.currentTrain) return;
    const url = window.location.href;
    const btn = document.getElementById('shareBtnText');
    const trainNum = state.currentTrain.codComercial;
    const prod = getProductInfo(state.currentTrain.codProduct);
    const orig = formatStationMax15(state.currentTrain.codOrigen);
    const dest = formatStationMax15(state.currentTrain.codDestino);

    if (navigator.share) {
        try {
            await navigator.share({
                title: `InfoTren - ${prod.name} #${trainNum}`,
                text: `Sigue en tiempo real el tren ${prod.name} #${trainNum} de ${orig} a ${dest}`,
                url: url
            });
            return;
        } catch (e) {}
    }

    try {
        await navigator.clipboard.writeText(url);
        if (btn) {
            btn.textContent = '¡Copiado!';
            setTimeout(() => { btn.textContent = 'Compartir'; }, 2200);
        }
    } catch (e) {
        const temp = document.createElement('input');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        if (btn) {
            btn.textContent = '¡Copiado!';
            setTimeout(() => { btn.textContent = 'Compartir'; }, 2200);
        }
    }
}

// ============================================================================
// CARGA DE DATOS (FETCHING CON FALLBACKS Y CACHÉ OFFLINE)
// ============================================================================

async function fetchWithFallback(url, localFallbackUrl, cacheKey, validate) {
    // 1. Probar con la lista de proxies CORS en tiempo real
    for (let i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
        const proxyIndex = (CONFIG.CURRENT_PROXY_INDEX + i) % CONFIG.CORS_PROXIES.length;
        const proxy = CONFIG.CORS_PROXIES[proxyIndex];
        const cacheBust = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
        const fullUrl = proxy ? (proxy.includes('?') ? proxy + encodeURIComponent(cacheBust) : proxy + cacheBust) : cacheBust;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5500);

            const res = await fetch(fullUrl, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = validate(await res.json());
                if (!data) continue; // A proxy that answers with something other than Renfe data is skipped
                CONFIG.CURRENT_PROXY_INDEX = proxyIndex;
                if (cacheKey) {
                    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
                }
                return { data, source: 'live' };
            }
        } catch (err) {
            // Continuar con el siguiente proxy
        }
    }

    // 2. Si no hay red o fallan los proxies, probar última caché guardada en el dispositivo
    if (cacheKey) {
        try {
            const cached = localStorage.getItem(cacheKey);
            const data = cached && validate(JSON.parse(cached));
            if (data) {
                return { data, source: 'cache' };
            }
        } catch (e) {}
    }

    // 3. Probar archivo local de respaldo en el repositorio
    if (localFallbackUrl) {
        try {
            const localRes = await fetch(localFallbackUrl);
            const data = localRes.ok && validate(await localRes.json());
            if (data) {
                return { data, source: 'fallback' };
            }
        } catch (e) {}
    }


    throw new Error('No se pudo conectar a los servicios de Renfe.');
}

async function loadStations() {
    if (Object.keys(state.stations).length > 500) {
        return; // Ya están cargadas en memoria (ej. PWA en archivo único)
    }
    try {
        const res = await fetch(CONFIG.STATIONS_URL);
        if (res.ok) {
            state.stations = await res.json();
        }
    } catch (e) {
        console.warn('No se pudo cargar el catálogo de estaciones externo:', e);
    }
}

async function refreshData(silent = false) {
    if (!silent) {
        updateStatusIndicator('connecting', 'Actualizando...');
    }

    try {
        const [fleetResult, routesResult] = await Promise.all([
            fetchWithFallback(CONFIG.FLEET_URL, CONFIG.LOCAL_FLEET_URL, CACHE_FLEET_KEY, validateFleet),
            fetchWithFallback(CONFIG.ROUTES_URL, CONFIG.LOCAL_ROUTES_URL, CACHE_ROUTES_KEY, validateRoutes)
        ]);

        const fleetRes = fleetResult.data;
        const routesRes = routesResult.data;

        // Trains without a GPS fix still have delay and next stop: keep them searchable (they just get no map marker).
        state.fleet = [...(fleetRes?.trenes || []), ...(fleetRes?.trenesNoPosicionados || [])];
        state.routes = routesRes?.trenes || (Array.isArray(routesRes) ? routesRes : []);
        state.lastUpdated = new Date();

        if (fleetResult.source === 'live') {
            updateStatusIndicator('online', 'Conectado');
        } else {
            updateStatusIndicator('online', 'Datos locales');
        }
        updateHeaderTime();
        renderQuickChips();
        updateFleetTable();

        const countEl = document.getElementById('totalTrainsCount');
        if (countEl) countEl.textContent = state.fleet.length;

        if (state.currentTrain) {
            const updated = findTrain(state.currentTrain.codComercial);
            if (updated) {
                displayTrain(updated, false);
            }
        }
    } catch (error) {
        console.error('Error al actualizar datos:', error);
        updateStatusIndicator('offline', 'Sin conexión');
    }
}

// ============================================================================
// BÚSQUEDA Y SELECCIÓN DE TREN
// ============================================================================

function findTrain(query) {
    if (!query) return null;
    const cleanQ = String(query).trim();
    const normQ = normalizeTrainId(cleanQ);

    // 1. Buscar por código comercial exacto o sin ceros a la izquierda en la flota activa
    let match = state.fleet.find(t => 
        String(t.codComercial).trim() === cleanQ || 
        normalizeTrainId(t.codComercial) === normQ
    );

    if (match) return match;

    // 2. Si no está en flota activa, buscar en las rutas programadas del día
    const routeMatch = state.routes.find(r => 
        String(r.idTren).trim() === cleanQ || 
        normalizeTrainId(r.idTren) === normQ
    );

    if (routeMatch) {
        const first = routeMatch.estaciones?.[0]?.p;
        const last = routeMatch.estaciones?.[routeMatch.estaciones.length - 1]?.p;
        return {
            codComercial: routeMatch.idTren,
            codProduct: 1,
            codOrigen: first,
            codDestino: last,
            ultRetraso: '0',
            synthetic: true
        };
    }

    return null;
}

function searchTrain(query) {
    if (!query) return;
    const clean = sanitizeInput(query);
    if (!clean) return;

    // Asegurar que estamos en la pestaña de búsqueda
    if (state.activeTab !== 'search') {
        switchTab('search');
    }

    const found = findTrain(clean);

    const detailContainer = document.getElementById('trainDetailContainer');
    const emptyPrompt = document.getElementById('emptySearchPrompt');
    const notFoundState = document.getElementById('notFoundState');
    const searchCard = document.getElementById('searchCard');

    if (found) {
        emptyPrompt.style.display = 'none';
        notFoundState.style.display = 'none';
        detailContainer.style.display = 'block';
        displayTrain(found);

        try {
            const url = new URL(window.location);
            url.searchParams.set('tren', found.codComercial);
            window.history.replaceState({}, '', url);
        } catch (e) {}
    } else {
        // Si no se encuentra el tren, mantener visible el buscador para que pueda corregir el número
        if (searchCard) searchCard.style.display = 'block';
        emptyPrompt.style.display = 'none';
        detailContainer.style.display = 'none';
        notFoundState.style.display = 'block';
        document.getElementById('notFoundTitle').textContent = `Tren #${clean} no encontrado`;
        document.getElementById('notFoundMsg').textContent = 
            `Actualmente no hay datos activos para el tren número ${clean}. Revisa el número de tu billete o consulta la lista de trenes en circulación.`;
    }
}

function showSearchForm() {
    if (state.activeTab !== 'search') {
        switchTab('search');
    }
    const searchCard = document.getElementById('searchCard');
    if (searchCard) {
        searchCard.style.display = 'block';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const input = document.getElementById('trainInput');
    if (input) {
        setTimeout(() => {
            input.focus();
            input.select();
        }, 150);
    }
}

function displayTrain(train, resetMapView = true) {
    state.currentTrain = train;
    const prod = getProductInfo(train.codProduct);
    const delay = formatDelay(train.ultRetraso);
    const mat = getMaterialInfo(train.mat);

    // Ocultar formulario de búsqueda para dejar la tarjeta única limpia y visible arriba
    const searchCard = document.getElementById('searchCard');
    if (searchCard) searchCard.style.display = 'none';

    // Guardar en búsquedas recientes
    saveRecentSearch(train.codComercial, prod.name);

    // 1. Cabecera del tren
    const badge = document.getElementById('detailProductBadge');
    if (badge) {
        badge.textContent = prod.name;
        badge.className = `product-badge ${prod.badge}`;
        badge.style.backgroundColor = prod.color;
    }

    const numEl = document.getElementById('detailTrainNumber');
    if (numEl) numEl.textContent = `Tren #${train.codComercial}`;
    const servEl = document.getElementById('detailServiceName');
    if (servEl) {
        servEl.textContent = train.synthetic
            ? `${prod.name} · Horario programado`
            : `${prod.name} · En circulación`;
    }

    // 2. RETRASO Y ESTADO (PRIMERO EN LA TARJETA)
    const delayIconEl = document.getElementById('detailDelayIcon');
    const delayTextEl = document.getElementById('detailDelayText');
    const delayBanner = document.getElementById('detailDelayBanner');

    let delayClass = 'delay-ontime';
    let icon = '🟢';
    let text = 'EN HORA · Sin retraso';

    if (train.synthetic) {
        delayClass = 'delay-ontime';
        icon = '🕒';
        text = 'PROGRAMADO · Sin retraso registrado';
    } else if (delay.min === 0) {
        delayClass = 'delay-ontime';
        icon = '🟢';
        text = 'EN HORA · Sin retraso';
    } else if (delay.min < 0) {
        delayClass = 'delay-ontime';
        icon = '🟢';
        text = `ADELANTADO · ${Math.abs(delay.min)} min`;
    } else if (delay.min <= 5) {
        delayClass = 'delay-slight';
        icon = '🟡';
        text = `RETRASO LEVE · +${delay.min} min`;
    } else if (delay.min <= 15) {
        delayClass = 'delay-slight';
        icon = '🟡';
        text = `RETRASO · +${delay.min} min`;
    } else {
        delayClass = 'delay-heavy';
        icon = '🔴';
        text = `RETRASO IMPORTANTE · +${delay.min} min`;
    }

    if (delayIconEl) delayIconEl.textContent = icon;
    if (delayTextEl) delayTextEl.textContent = text;
    if (delayBanner) {
        delayBanner.className = `delay-highlight ${delayClass}`;
    }

    // Próxima parada (máximo 15 caracteres, sin paréntesis)
    const nextStationCode = train.codEstSig || train.codDestino;
    const nextStationShort = formatStationMax15(nextStationCode);
    const nextStEl = document.getElementById('detailNextStationShort');
    if (nextStEl) nextStEl.textContent = nextStationShort;

    const nextEtaEl = document.getElementById('detailNextEta');
    if (nextEtaEl) {
        if (train.horaLlegadaSigEst) {
            try {
                const timePart = train.horaLlegadaSigEst.split('T')[1]?.substring(0, 5) || train.horaLlegadaSigEst;
                nextEtaEl.textContent = `Llegada estimada: ${timePart}`;
            } catch (e) {
                nextEtaEl.textContent = 'En camino hacia esta parada';
            }
        } else {
            nextEtaEl.textContent = 'En camino hacia esta parada';
        }
    }

    // 3. TRAYECTO COMPACTO (SEGUNDO EN LA TARJETA, MÁXIMO 15 CARACTERES)
    const originShort = formatStationMax15(train.codOrigen);
    const destShort = formatStationMax15(train.codDestino);
    const origEl = document.getElementById('detailOriginShort');
    if (origEl) origEl.textContent = originShort;
    const destEl = document.getElementById('detailDestinationShort');
    if (destEl) destEl.textContent = destShort;

    // Buscar ruta para horarios de origen y destino
    const route = state.routes.find(r => normalizeTrainId(r.idTren) === normalizeTrainId(train.codComercial));
    const depEl = document.getElementById('detailDepTime');
    const arrEl = document.getElementById('detailArrTime');

    if (route && route.estaciones && route.estaciones.length > 0) {
        const first = route.estaciones[0];
        const last = route.estaciones[route.estaciones.length - 1];
        const depTime = first.hs || first.h || '--:--';
        const arrTime = last.h || last.hs || '--:--';
        if (depEl) depEl.textContent = `Salida: ${depTime}`;
        if (arrEl) arrEl.textContent = `Llegada: ${arrTime}`;
    } else {
        if (depEl) depEl.textContent = 'Salida: --:--';
        if (arrEl) arrEl.textContent = 'Llegada: --:--';
    }

    // 4. DETALLES TÉCNICOS (TERCER DESPLEGABLE)
    const matEl = document.getElementById('detailMaterial');
    if (matEl) matEl.textContent = mat.name;
    const matrEl = document.getElementById('detailMatricula');
    if (matrEl) matrEl.textContent = mat.code !== '--' ? `#${mat.code}` : 'No disponible';
    const accEl = document.getElementById('detailAccessible');
    if (accEl) accEl.textContent = train.accesible ? '♿ Servicio Atendo · PMR Habilitado' : 'Accesibilidad estándar';
    const lastStEl = document.getElementById('detailLastStation');
    if (lastStEl) lastStEl.textContent = train.codEstAnt ? formatStationMax15(train.codEstAnt) : 'Inicio de recorrido';

    // 5. Renderizar Timeline de Estaciones (SEGUNDO DESPLEGABLE)
    renderTimeline(train, route);

    // 6. Renderizar Mapa en Vivo (PRIMER DESPLEGABLE)
    renderMap(train, route, resetMapView);
}

// ============================================================================
// LÍNEA DE TIEMPO E ITINERARIO (TIMELINE)
// ============================================================================

function renderTimeline(train, route) {
    const container = document.getElementById('stationsTimeline');
    const badge = document.getElementById('stopsSummaryBadge');
    if (!container || !badge) return;
    container.innerHTML = '';

    if (!route || !route.estaciones || route.estaciones.length === 0) {
        badge.textContent = '3 puntos clave';
        const fallbackStops = [
            { code: train.codOrigen, statusClass: 'completed', statusText: '✓ Estación de origen', time: 'Salida' },
            { code: train.codEstSig || train.codDestino, statusClass: 'current', statusText: '🚆 Próxima parada', time: 'En ruta' },
            { code: train.codDestino, statusClass: 'upcoming', statusText: 'Destino final', time: 'Meta' }
        ];
        fallbackStops.forEach(s => {
            const step = document.createElement('div');
            step.className = `timeline-step ${s.statusClass}`;
            step.innerHTML = `
                <div class="step-row">
                    <div class="step-info">
                        <span class="step-station-name">${escapeHTML(formatStationMax15(s.code))}</span>
                        <span class="step-status-badge ${s.statusClass}">${escapeHTML(s.statusText)}</span>
                    </div>
                    <div class="step-time-badge">${escapeHTML(s.time)}</div>
                </div>
            `;
            container.appendChild(step);
        });
        return;
    }

    const stops = route.estaciones;
    badge.textContent = `${stops.length} paradas`;

    // Identificar el índice de la próxima parada con comparación normalizada
    const nextCodeNorm = normalizeTrainId(train.codEstSig || '');
    const antCodeNorm = normalizeTrainId(train.codEstAnt || '');

    let nextIndex = stops.findIndex(s => normalizeTrainId(s.p) === nextCodeNorm);
    if (nextIndex === -1 && antCodeNorm) {
        const antIdx = stops.findIndex(s => normalizeTrainId(s.p) === antCodeNorm);
        if (antIdx !== -1) nextIndex = Math.min(antIdx + 1, stops.length - 1);
    }
    if (nextIndex === -1) {
        nextIndex = 0;
    }

    const delayMin = Math.max(0, parseInt(train.ultRetraso, 10) || 0);

    stops.forEach((stop, index) => {
        const step = document.createElement('div');
        const stName = formatStationMax15(stop.p);
        const schedTime = index === 0 ? (stop.hs || stop.h || '--:--') : (stop.h || stop.hs || '--:--');

        let statusClass = 'upcoming';
        let statusText = 'Pendiente';

        if (index < nextIndex) {
            statusClass = 'completed';
            statusText = '✓ Parada superada';
        } else if (index === nextIndex) {
            statusClass = 'current';
            // Same estimate as the "Próxima parada" card: Renfe's own arrival time, not schedule + delay.
            const est = train.horaLlegadaSigEst?.split('T')[1]?.substring(0, 5) || addMinutesToTime(schedTime, delayMin);
            statusText = est ? `🚆 Próxima · Est. ${est}` : '🚆 Próxima parada';
        } else if (delayMin > 0) {
            const est = addMinutesToTime(schedTime, delayMin);
            if (est) statusText = `Pendiente · Est. ${est}`;
        }

        step.className = `timeline-step ${statusClass}`;
        step.innerHTML = `
            <div class="step-row">
                <div class="step-info">
                    <span class="step-station-name">${escapeHTML(stName)}</span>
                    <span class="step-status-badge ${statusClass}">${escapeHTML(statusText)}</span>
                </div>
                <div class="step-time-badge"><span class="step-time-label">Prog.</span>${escapeHTML(schedTime)}</div>
            </div>
        `;

        // Al pulsar una parada, abrir el mapa y centrar en esa estación
        step.style.cursor = 'pointer';
        step.onclick = () => {
            const coords = getStationCoords(stop.p);
            const accMap = document.getElementById('accordionMap');
            if (accMap && !accMap.open) {
                accMap.open = true;
            }
            if (coords && state.map) {
                setTimeout(() => {
                    state.map.invalidateSize();
                    state.map.setView(coords, 12, { animate: true });
                    if (accMap) accMap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 180);
            }
        };

        // Long regional routes have 50+ stops: fold the ones already passed except the last.
        if (index < nextIndex - 1) step.classList.add('step-folded');
        container.appendChild(step);
    });

    const folded = Math.max(0, nextIndex - 1);
    if (folded > 0) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn-sm timeline-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = `Ver ${folded === 1 ? 'la parada anterior' : `las ${folded} paradas anteriores`}`;
        toggle.onclick = () => {
            const open = container.classList.toggle('show-folded');
            toggle.setAttribute('aria-expanded', String(open));
            toggle.textContent = open ? 'Ocultar paradas anteriores'
                : `Ver ${folded === 1 ? 'la parada anterior' : `las ${folded} paradas anteriores`}`;
        };
        container.prepend(toggle);
    }
}

// ============================================================================
// MAPA INTERACTIVO (LEAFLET)
// ============================================================================

function initMapIfNeeded() {
    if (state.map || typeof L === 'undefined') return;

    const mapEl = document.getElementById('trainMap');
    if (!mapEl) return;

    state.map = L.map('trainMap', {
        center: [40.4168, -3.7038],
        zoom: 6,
        zoomControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(state.map);
}

function clearMapLayers() {
    if (!state.map) return;
    if (state.mapLayers.trainMarker) {
        state.map.removeLayer(state.mapLayers.trainMarker);
        state.mapLayers.trainMarker = null;
    }
    if (state.mapLayers.routeLine) {
        state.map.removeLayer(state.mapLayers.routeLine);
        state.mapLayers.routeLine = null;
    }
    if (state.mapLayers.stationMarkers) {
        state.mapLayers.stationMarkers.forEach(m => state.map.removeLayer(m));
        state.mapLayers.stationMarkers = [];
    }
}

function renderMap(train, route, shouldFitBounds = true) {
    initMapIfNeeded();
    clearMapLayers();
    if (!state.map) return;

    setTimeout(() => state.map.invalidateSize(), 120);

    const prod = getProductInfo(train.codProduct);
    const bounds = L.latLngBounds();

    // 1. Trazado de la ruta
    if (route && route.secuencia && route.secuencia.length > 0) {
        const polyCoords = route.secuencia
            .filter(pt => pt.lat && pt.lon)
            .map(pt => [pt.lat, pt.lon]);

        if (polyCoords.length > 0) {
            state.mapLayers.routeLine = L.polyline(polyCoords, {
                color: prod.color || '#571661',
                weight: 5,
                opacity: 0.85,
                lineJoin: 'round'
            }).addTo(state.map);

            polyCoords.forEach(c => bounds.extend(c));
        }
    }

    // 2. Estaciones de la ruta
    if (route && route.estaciones) {
        route.estaciones.forEach(stop => {
            const coords = getStationCoords(stop.p);
            if (coords) {
                const isNext = normalizeTrainId(stop.p) === normalizeTrainId(train.codEstSig);
                const icon = L.divIcon({
                    className: 'station-pin-container',
                    html: `<div class="station-pin-marker ${isNext ? 'current' : ''}"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker(coords, { icon })
                    .bindPopup(`
                        <strong>${escapeHTML(formatStationMax15(stop.p))}</strong><br>
                        Horario: ${escapeHTML(stop.h || stop.hs || '--:--')}
                    `)
                    .addTo(state.map);

                state.mapLayers.stationMarkers.push(marker);
                bounds.extend(coords);
            }
        });
    }

    // 3. Marcador del tren en vivo
    if (train.latitud && train.longitud) {
        const trainCoords = [train.latitud, train.longitud];
        const trainIcon = L.divIcon({
            className: 'leaflet-train-icon',
            html: `<div class="train-pulsing-marker" style="background-color: ${prod.color}">🚆</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        const delay = formatDelay(train.ultRetraso);

        state.mapLayers.trainMarker = L.marker(trainCoords, { icon: trainIcon, zIndexOffset: 1000 })
            .bindPopup(`
                <div style="font-family: var(--font-sans); padding: 4px;">
                    <strong style="color: ${escapeHTML(prod.color)}; font-size: 15px;">${escapeHTML(prod.name)} #${escapeHTML(train.codComercial)}</strong><br>
                    <strong>Estado:</strong> ${escapeHTML(delay.text)}<br>
                    <strong>Próxima:</strong> ${escapeHTML(formatStationMax15(train.codEstSig))}<br>
                    <strong>Destino:</strong> ${escapeHTML(formatStationMax15(train.codDestino))}
                </div>
            `)
            .addTo(state.map);

        bounds.extend(trainCoords);
    }

    if (shouldFitBounds && bounds.isValid()) {
        state.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    }
}

function centerMapOnTrain() {
    if (state.currentTrain && state.currentTrain.latitud && state.currentTrain.longitud && state.map) {
        state.map.setView([state.currentTrain.latitud, state.currentTrain.longitud], 11, { animate: true });
        if (state.mapLayers.trainMarker) {
            state.mapLayers.trainMarker.openPopup();
        }
    }
}

function fitMapToRoute() {
    if (state.mapLayers.routeLine && state.map) {
        state.map.fitBounds(state.mapLayers.routeLine.getBounds(), { padding: [30, 30] });
    }
}

function refreshMap() {
    if (state.map) {
        state.map.invalidateSize();
        if (state.currentTrain && state.currentTrain.latitud && state.currentTrain.longitud) {
            state.map.setView([state.currentTrain.latitud, state.currentTrain.longitud], state.map.getZoom());
        }
    }
}

// ============================================================================
// SUGERENCIAS RÁPIDAS Y AUTOCOMPLETADO
// ============================================================================

function renderQuickChips() {
    const container = document.getElementById('quickChips');
    if (!container) return;

    if (!state.fleet || state.fleet.length === 0) {
        container.innerHTML = '<span class="chip">Esperando datos...</span>';
        return;
    }

    container.innerHTML = '';
    const sampled = state.fleet.slice(0, 6);

    sampled.forEach(t => {
        const prod = getProductInfo(t.codProduct);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.innerHTML = `
            <span class="chip-tag" style="background-color: ${escapeHTML(prod.color)}">${escapeHTML(prod.name)}</span>
            <span>#${escapeHTML(t.codComercial)}</span>
            <small style="color:var(--text-muted);font-weight:700;">${escapeHTML(formatStationMax15(t.codDestino))}</small>
        `;
        chip.onclick = () => {
            switchTab('search');
            const input = document.getElementById('trainInput');
            if (input) input.value = t.codComercial;
            searchTrain(t.codComercial);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        container.appendChild(chip);
    });
}

function handleInputKeydown(e) {
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        state.autocompleteSelectedIndex = -1;
        return;
    }

    if (dropdown.style.display !== 'none' && items.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            state.autocompleteSelectedIndex = (state.autocompleteSelectedIndex + 1) % items.length;
            highlightAutocompleteItem(items);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            state.autocompleteSelectedIndex = (state.autocompleteSelectedIndex - 1 + items.length) % items.length;
            highlightAutocompleteItem(items);
            return;
        }
        if (e.key === 'Enter' && state.autocompleteSelectedIndex >= 0) {
            e.preventDefault();
            items[state.autocompleteSelectedIndex].click();
            return;
        }
    }
}

function highlightAutocompleteItem(items) {
    items.forEach((it, idx) => {
        if (idx === state.autocompleteSelectedIndex) {
            it.classList.add('selected');
            it.scrollIntoView({ block: 'nearest' });
        } else {
            it.classList.remove('selected');
        }
    });
}

function handleInputSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const btnClear = document.getElementById('btnClear');
    const dropdown = document.getElementById('autocompleteDropdown');
    state.autocompleteSelectedIndex = -1;

    if (btnClear) btnClear.style.display = query ? 'flex' : 'none';
    if (!dropdown) return;

    if (!query || query.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    const matches = state.fleet.filter(t => {
        const num = String(t.codComercial).toLowerCase();
        const orig = getStationName(t.codOrigen).toLowerCase();
        const dest = getStationName(t.codDestino).toLowerCase();
        const prod = getProductInfo(t.codProduct).name.toLowerCase();
        return num.includes(query) || orig.includes(query) || dest.includes(query) || prod.includes(query);
    }).slice(0, 8);

    if (matches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    dropdown.innerHTML = '';
    matches.forEach(t => {
        const prod = getProductInfo(t.codProduct);
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.setAttribute('role', 'option');
        item.innerHTML = `
            <div class="item-main">
                <span class="table-badge" style="background-color: ${escapeHTML(prod.color)}">${escapeHTML(prod.name)}</span>
                <span class="item-train-num">#${escapeHTML(t.codComercial)}</span>
            </div>
            <div class="item-route">${escapeHTML(formatStationMax15(t.codOrigen))} ➔ ${escapeHTML(formatStationMax15(t.codDestino))}</div>
        `;
        item.onclick = () => {
            document.getElementById('trainInput').value = t.codComercial;
            dropdown.style.display = 'none';
            searchTrain(t.codComercial);
        };
        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function clearSearch() {
    const input = document.getElementById('trainInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    const btnClear = document.getElementById('btnClear');
    if (btnClear) btnClear.style.display = 'none';
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';
    state.autocompleteSelectedIndex = -1;
}

function handleSearchSubmit(e) {
    e.preventDefault();
    const dropdown = document.getElementById('autocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';
    state.autocompleteSelectedIndex = -1;
    const input = document.getElementById('trainInput');
    const query = input ? input.value.trim() : '';
    if (query) {
        searchTrain(query);
    }
}

// ============================================================================
// TABLA DE TRENES EN CIRCULACIÓN (FLOTA COMPLETA)
// ============================================================================

function setFleetFilter(type, btnEl) {
    state.fleetFilter = type;
    document.querySelectorAll('.filter-pill').forEach(p => {
        const isMatch = btnEl ? p === btnEl : p.getAttribute('data-filter') === type;
        p.classList.toggle('active', isMatch);
    });
    updateFleetTable();
}

function filterFleetTable() {
    const input = document.getElementById('fleetFilterInput');
    state.fleetSearchQuery = input ? input.value.toLowerCase().trim() : '';
    updateFleetTable();
}

function updateFleetTable() {
    const tbody = document.getElementById('fleetTableBody');
    if (!tbody) return;

    if (!state.fleet || state.fleet.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No hay trenes registrados en circulación en este momento.</td></tr>';
        return;
    }

    let aveCount = 0, avloCount = 0, alviaCount = 0, mdCount = 0, delayCount = 0;
    state.fleet.forEach(t => {
        const p = t.codProduct;
        if (p === 2 || p === 25) aveCount++;
        if (p === 28) avloCount++;
        if (p === 11) alviaCount++;
        if (p === 15 || p === 16 || p === 18 || p === 19) mdCount++;
        if (parseInt(t.ultRetraso, 10) > 5) delayCount++;
    });

    const setElText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setElText('countAll', state.fleet.length);
    setElText('countAve', aveCount);
    setElText('countAvlo', avloCount);
    setElText('countAlvia', alviaCount);
    setElText('countMd', mdCount);
    setElText('countDelay', delayCount);

    const filtered = state.fleet.filter(t => {
        if (state.fleetFilter === 'AVE' && t.codProduct !== 2 && t.codProduct !== 25) return false;
        if (state.fleetFilter === 'AVLO' && t.codProduct !== 28) return false;
        if (state.fleetFilter === 'Alvia' && t.codProduct !== 11) return false;
        if (state.fleetFilter === 'MD' && (t.codProduct !== 15 && t.codProduct !== 16 && t.codProduct !== 18 && t.codProduct !== 19)) return false;
        if (state.fleetFilter === 'delay' && parseInt(t.ultRetraso, 10) <= 5) return false;

        if (state.fleetSearchQuery) {
            const num = String(t.codComercial).toLowerCase();
            const orig = getStationName(t.codOrigen).toLowerCase();
            const dest = getStationName(t.codDestino).toLowerCase();
            const prod = getProductInfo(t.codProduct).name.toLowerCase();
            return num.includes(state.fleetSearchQuery) || 
                   orig.includes(state.fleetSearchQuery) || 
                   dest.includes(state.fleetSearchQuery) || 
                   prod.includes(state.fleetSearchQuery);
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No se encontraron trenes con los filtros seleccionados.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(t => {
        const prod = getProductInfo(t.codProduct);
        const delay = formatDelay(t.ultRetraso);
        const mat = getMaterialInfo(t.mat);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><span class="table-train-tag">#${escapeHTML(t.codComercial)}</span></td>
            <td><span class="table-badge" style="background-color: ${escapeHTML(prod.color)}">${escapeHTML(prod.name)}</span></td>
            <td><strong>${escapeHTML(formatStationMax15(t.codOrigen))}</strong><span class="route-inline"> → <strong>${escapeHTML(formatStationMax15(t.codDestino))}</strong></span></td>
            <td><strong>${escapeHTML(formatStationMax15(t.codDestino))}</strong></td>
            <td>${escapeHTML(formatStationMax15(t.codEstSig))}</td>
            <td><span class="table-delay ${escapeHTML(delay.class)}">${escapeHTML(delay.text)}</span></td>
            <td><small>${escapeHTML(mat.name)}</small></td>
            <td><button class="btn-sm" type="button" aria-label="Ver ficha del tren #${escapeHTML(t.codComercial)}">Ver Tren</button></td>
        `;

        tr.onclick = () => {
            switchTab('search');
            const input = document.getElementById('trainInput');
            if (input) input.value = t.codComercial;
            searchTrain(t.codComercial);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        tbody.appendChild(tr);
    });
}

// ============================================================================
// NAVEGACIÓN, PESTAÑAS Y SOPORTE PWA
// ============================================================================

function switchTab(tabId) {
    state.activeTab = tabId;
    const tabSearch = document.getElementById('tabSearch');
    const tabFleet = document.getElementById('tabFleet');
    const secSearch = document.getElementById('sectionSearch');
    const secFleet = document.getElementById('sectionFleet');

    if (tabId === 'search') {
        if (tabSearch) { tabSearch.classList.add('active'); tabSearch.setAttribute('aria-selected', 'true'); }
        if (tabFleet) { tabFleet.classList.remove('active'); tabFleet.setAttribute('aria-selected', 'false'); }
        if (secSearch) secSearch.classList.add('active');
        if (secFleet) secFleet.classList.remove('active');
        if (state.map) {
            setTimeout(() => state.map.invalidateSize(), 150);
        }
    } else if (tabId === 'fleet') {
        if (tabFleet) { tabFleet.classList.add('active'); tabFleet.setAttribute('aria-selected', 'true'); }
        if (tabSearch) { tabSearch.classList.remove('active'); tabSearch.setAttribute('aria-selected', 'false'); }
        if (secFleet) secFleet.classList.add('active');
        if (secSearch) secSearch.classList.remove('active');
    }
}

function showHomeView() {
    switchTab('search');
    const searchCard = document.getElementById('searchCard');
    if (searchCard) searchCard.style.display = 'block';
    clearSearch();
    document.getElementById('trainDetailContainer').style.display = 'none';
    document.getElementById('notFoundState').style.display = 'none';
    document.getElementById('emptySearchPrompt').style.display = 'block';
    state.currentTrain = null;

    try {
        const url = new URL(window.location);
        url.searchParams.delete('tren');
        window.history.replaceState({}, '', url);
    } catch (e) {}
}

function updateStatusIndicator(status, text) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    const label = document.getElementById('statusText');

    if (dot) {
        dot.className = 'status-dot';
        if (status === 'online') {
            dot.classList.add('online');
        } else if (status === 'offline') {
            dot.classList.add('offline');
        } else {
            dot.classList.add('pulsing');
        }
    }
    if (label) label.textContent = text;
}

function updateHeaderTime() {
    if (state.lastUpdated) {
        const timeStr = state.lastUpdated.toLocaleTimeString('es-ES');
        const el = document.getElementById('lastUpdatedText');
        if (el) el.textContent = timeStr;
    }
}

function forceRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');
    refreshData().finally(() => {
        if (btn) setTimeout(() => btn.classList.remove('spinning'), 600);
    });
}

const PWA_ICON_192 = "data:image/png;base64,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";
const PWA_ICON_512 = "data:image/png;base64,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MgIWADISPhoBI2AEjIARmCAELABM0Mf2qxoBI2AEjIARyAhYAMhI+GgEjIARMAJGYIIQsAAwQR/br2oEjIARMAJGICNgASAj4aMRMAJGwAgYgQlCwALABH1sv6oRMAJGwAgYgYyABYCMhI9GwAgYASNgBCYIAQsAE/Sx/apGwAgYASNgBDICFgAyEj4aASNgBIyAEZggBCwATNDH9qsaASNgBIyAEcgIWADISPhoBIyAETACRmCCELAAMEEf269qBIyAETACRiAjYAEgI+GjETACRsAIGIEJQsACwAR9bL+qETACRsAIGIGMgAWAjISPRsAIGAEjYAQmCAELABP0sf2qRsAIGAEjYAQyAhYAMhI+GgEjYASMgBGYIAQsAEzQx/arGgEjYASMgBHICFgAyEj4aASMgBEwAkZgghCwADBBH9uvagSMgBEwAkYgI2ABICPhoxEwAkbACBiBCULAAsAEfWy/qhEwAkbACBiBjIAFgIyEj0bACBgBI2AEJggBCwAT9LH9qkbACBgBI2AEMgIWADISPhoBI2AEjIARmCAELABM0Mf2qxoBI2AEjIARyAhYAMhI+GgEjIARMAJGYIIQsAAwQR/br2oEjIARMAJGICNgASAj4aMRMAJGwAgYgQlCwALABH1sv6oRMAJGwAgYgYyABYCMhI9GwAgYASNgBCYIAQsAE/Sx/apGwAgYASNgBDIC/x+n2bQ2x0qlZwAAAABJRU5ErkJggg==";

function isRunningStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}

function setupPWA() {
    // 1. Si se abre como archivo local suelto (file://), inyectar manifest embebido en Base64; en servidor/GitHub Pages usa ./manifest.json
    try {
        let link = document.querySelector("link[rel=\"manifest\"]");
        if (!link) {
            link = document.createElement("link");
            link.rel = "manifest";
            link.href = "./manifest.json";
            document.head.appendChild(link);
        }
        if (window.location.protocol === "file:") {
            const manifest = {
                id: "infotren-pwa",
                name: "InfoTren - Seguimiento de Trenes Renfe",
                short_name: "InfoTren",
                description: "Aplicación accesible en tiempo real para consultar el retraso, próxima parada y recorrido de trenes Renfe.",
                start_url: window.location.href,
                display: "standalone",
                orientation: "portrait",
                background_color: "#f1f5f9",
                theme_color: "#571661",
                lang: "es-ES",
                icons: [
                    { src: PWA_ICON_192, sizes: "192x192", type: "image/png", purpose: "any maskable" },
                    { src: PWA_ICON_512, sizes: "512x512", type: "image/png", purpose: "any maskable" }
                ]
            };
            link.href = "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest));
        }
    } catch (e) {}

    // 2. Registrar Service Worker para soporte offline completo
    if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    // 3. Mostrar botón Instalar si no está ya instalada como app independiente
    const btn = document.getElementById("installPwaBtn");
    if (btn && !isRunningStandalone()) {
        btn.style.display = "inline-flex";
        if (isIOSDevice()) {
            btn.innerHTML = "📲 Añadir a Inicio";
            btn.title = "Cómo añadir InfoTren a la pantalla de inicio de tu iPhone";
        }
    }

    // 4. Capturar evento nativo de instalación PWA (Android / Chrome / Edge)
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        state.deferredInstallPrompt = e;
        if (btn && !isRunningStandalone()) {
            btn.style.display = "inline-flex";
        }
    });

    window.addEventListener("appinstalled", () => {
        state.deferredInstallPrompt = null;
        if (btn) btn.style.display = "none";
        closeInstallModal();
    });

    // 5. Escuchar cambios de conexión en vivo
    window.addEventListener("online", () => {
        refreshData(true);
    });
    window.addEventListener("offline", () => {
        updateStatusIndicator("offline", "Sin conexión");
    });
}

function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /FBAN|FBAV|Instagram|WhatsApp|Twitter|Line|Telegram/i.test(ua);
}

async function installPWA() {
    if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
        const choice = await state.deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
            state.deferredInstallPrompt = null;
            const btn = document.getElementById("installPwaBtn");
            if (btn) btn.style.display = "none";
        }
        return;
    }

    // Si es un dispositivo iOS o navegador sin prompt directo, abrir modal explicativo
    const modal = document.getElementById("pwaInstallModal");
    if (modal) {
        const iosBox = document.getElementById("pwaStepIos");
        const androidBox = document.getElementById("pwaStepAndroid");
        if (isIOSDevice() && iosBox && androidBox) {
            // Asegurar que las instrucciones de iOS se vean primero
            iosBox.parentNode.insertBefore(iosBox, androidBox);
            iosBox.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.3)";
        }
        modal.style.display = "flex";
    }
}

function closeInstallModal() {
    const modal = document.getElementById("pwaInstallModal");
    if (modal) {
        modal.style.display = "none";
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

// Event wiring lives here instead of onclick="" attributes, so the CSP can forbid inline scripts.
function bindUiEvents() {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || typeof window.app[el.dataset.action] !== 'function') return;
        window.app[el.dataset.action](el.dataset.arg, el);
    });
    document.querySelectorAll('[role="button"][data-action]').forEach((el) => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        });
    });
    document.getElementById('searchForm')?.addEventListener('submit', handleSearchSubmit);
    const input = document.getElementById('trainInput');
    input?.addEventListener('input', handleInputSearch);
    input?.addEventListener('keydown', handleInputKeydown);
    document.getElementById('fleetFilterInput')?.addEventListener('input', () => filterFleetTable());
    document.getElementById('accordionMap')?.addEventListener('toggle', (e) => {
        if (e.target.open) setTimeout(() => refreshMap(), 150);
    });
}

async function init() {
    bindUiEvents();
    loadSavedFontScale();
    setupPWA();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-wrapper')) {
            const dropdown = document.getElementById('autocompleteDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });

    renderRecentSearches();
    await loadStations();
    await refreshData();

    const urlParams = new URLSearchParams(window.location.search);
    const trainParam = urlParams.get('tren');
    if (trainParam) {
        const input = document.getElementById('trainInput');
        if (input) input.value = trainParam;
        searchTrain(trainParam);
    }

    state.pollTimer = setInterval(() => {
        refreshData(true);
    }, CONFIG.POLL_INTERVAL);
}

window.app = {
    handleSearchSubmit,
    handleInputSearch,
    handleInputKeydown,
    clearSearch,
    showSearchForm,
    shareTrain,
    centerMapOnTrain,
    fitMapToRoute,
    refreshMap,
    switchTab,
    showHomeView,
    setFleetFilter,
    filterFleetTable,
    forceRefresh,
    cycleFontScale,
    installPWA,
    closeInstallModal
};

document.addEventListener('DOMContentLoaded', init);
