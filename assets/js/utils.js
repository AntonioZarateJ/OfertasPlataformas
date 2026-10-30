// Peticiones acotadas y caché corta: los precios nunca se guardan indefinidamente.
const responseCache = new Map();
async function requestJSON(url, { signal, ttl = 60000, timeout = 8000, ...options } = {}) {
    const cacheable = !options.method || options.method === 'GET';
    const cached = responseCache.get(url);
    if (cacheable && ttl > 0 && cached && cached.expires > Date.now()) {
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        return structuredClone(cached.data);
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError')), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok){const error=new Error(`HTTP ${response.status}`);error.status=response.status;error.retryAfter=Number(response.headers.get('Retry-After'))||0;throw error;}
        const data = await response.json();
        if (cacheable && ttl > 0) {
            if (responseCache.size >= 100) responseCache.delete(responseCache.keys().next().value);
            responseCache.set(url, { expires: Date.now() + ttl, data: structuredClone(data) });
        }
        return data;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function safeURL(value) {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

function dealRedirectURL(value) {
    let id = String(value ?? '');
    try { id = decodeURIComponent(id); } catch { /* Aceptar también IDs sin codificar. */ }
    return `${CHEAPSHARK_REDIRECT}${encodeURIComponent(id)}`;
}

function prepareImages(container) {
    container.querySelectorAll('img').forEach(img => {
        img.decoding = 'async';
        img.addEventListener('error', () => {
            img.src = safeURL(img.dataset.fallback) || 'https://placehold.co/460x215/131c2e/38bdf8?text=SteamPulse';
        }, { once: true });
    });
}

let catalogGeneration = 0;
let catalogController = null;
function cancelCatalogRequest() {
    catalogGeneration++;
    catalogController?.abort();
    catalogController = null;
    isLoadingMore = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.classList.remove('hidden-el');
    loadMoreBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>Cargar Más Juegos</span>';
}

function showCatalogError(message) {
    const error = document.getElementById('catalogError');
    error.querySelector('p').textContent = message;
    error.classList.remove('hidden-el');
}

function updateSavedPrices(games) {
    let changed = false;
    games.forEach(game => {
        const saved = userWishlist[String(game.gameID)];
        if (!saved || !Number.isFinite(Number(game.salePrice))) return;
        if (saved.salePrice === Number(game.salePrice).toFixed(2) &&
            String(saved.normalPrice) === String(game.normalPrice ?? saved.normalPrice) &&
            String(saved.savings) === String(game.savings ?? saved.savings)) return;
        saved.salePrice = Number(game.salePrice).toFixed(2);
        saved.normalPrice = game.normalPrice ?? saved.normalPrice;
        saved.savings = game.savings ?? saved.savings;
        saved.priceCheckedAt = Date.now();
        changed = true;
    });
    if (changed) persistWishlistState();
}

let wishlistRefresh = null;
function refreshWishlistPrices() {
    if (wishlistRefresh) return wishlistRefresh;
    wishlistRefresh = (async () => {
        const ids = Object.keys(userWishlist).filter(id => /^\d+$/.test(id));
        const updates = [];
        for (let i = 0; i < ids.length; i += 4) {
            await Promise.all(ids.slice(i, i + 4).map(async id => {
                try {
                    const game = await requestJSON(`${GAMES_API}?id=${encodeURIComponent(id)}`);
                    if (!Array.isArray(game?.deals) || !game.deals.length) return;
                    const deal = [...game.deals].sort((a, b) => Number(a.price) - Number(b.price))[0];
                    updates.push({ gameID: id, salePrice: deal.price, normalPrice: deal.retailPrice });
                } catch { /* Se conserva el último precio consultado si la API falla. */ }
            }));
        }
        updateSavedPrices(updates);
        if (activeChip === 'wishlist') renderWishlistChipMode();
        if (!document.getElementById('wishlistDrawerModal').classList.contains('hidden-el')) renderWishlistDrawerItems();
    })().finally(() => { wishlistRefresh = null; });
    return wishlistRefresh;
}
