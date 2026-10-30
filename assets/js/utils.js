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
        return ['https:', 'http:'].includes(url.protocol)&&!url.username&&!url.password ? url.href : '';
    } catch { return ''; }
}

function dealRedirectURL(value) {
    let id = String(value ?? '');
    try { id = decodeURIComponent(id); } catch { /* Aceptar también IDs sin codificar. */ }
    return `${CHEAPSHARK_REDIRECT}${encodeURIComponent(id)}`;
}

const GAME_IMAGE_PLACEHOLDER='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215" viewBox="0 0 460 215"><rect width="460" height="215" fill="#112237"/><rect x="195" y="62" width="70" height="47" rx="14" fill="none" stroke="#7dd3fc" stroke-width="3"/><path d="M210 85h17m-8-8v16m28-12h1m-1 9h1" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/><text x="230" y="147" text-anchor="middle" fill="#b6c9dd" font-family="sans-serif" font-size="15">Portada no disponible</text></svg>');
function imageCandidates(steamId,thumb,primary='') {
    const image=safeURL(thumb);
    const inferred=image&&/steamstatic\.com|steamcdn/.test(image)?image.replace(/(?:capsule_[a-z0-9_]+|header)\.(jpg|png)(?=\?|$)/i,'header.$1'):'';
    return [...new Set([inferred,image,safeURL(primary),/^\d+$/.test(String(steamId))?`https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`:''].filter(Boolean))];
}
const imageJobs=new WeakMap();
const imageObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){imageObserver.unobserve(entry.target);imageJobs.get(entry.target)?.start();}});
},{rootMargin:'240px'}):null;
function setImageFallbacks(img,urls) {
    imageJobs.get(img)?.cancel();imageObserver?.unobserve(img);
    const candidates=[...new Set(urls.map(safeURL).filter(Boolean))];let index=0,probe,timer,started=false;
    const clean=()=>{clearTimeout(timer);if(probe){probe.onload=null;probe.onerror=null;probe.src='';probe=null;}};
    const job={cancel:()=>{clean();img.onerror=null;},start:()=>{if(started)return;started=true;next();}};
    const next=()=>{
        if(imageJobs.get(img)!==job)return;clean();
        if(index>=candidates.length){img.onerror=null;img.src=GAME_IMAGE_PLACEHOLDER;img.dataset.imageState='placeholder';return;}
        probe=new Image();probe.decoding='async';
        probe.onload=()=>{
            if(imageJobs.get(img)!==job)return;
            const src=probe.src;clearTimeout(timer);probe.onload=null;probe.onerror=null;probe=null;
            img.dataset.imageState='loaded';img.onerror=next;img.src=src;
        };
        probe.onerror=next;timer=setTimeout(next,3500);probe.src=candidates[index++];
    };
    imageJobs.set(img,job);img.decoding='async';img.dataset.imageReady='1';img.dataset.imageState='loading';img.onerror=null;img.src=GAME_IMAGE_PLACEHOLDER;
    if(imageObserver)imageObserver.observe(img);else job.start();
}

new MutationObserver(records=>{
    for(const record of records)for(const node of record.removedNodes){
        if(node.nodeType!==1||node.isConnected)continue;
        const images=node.matches('img')?[node]:node.querySelectorAll('img');
        images.forEach(img=>{imageObserver?.unobserve(img);imageJobs.get(img)?.cancel();imageJobs.delete(img);});
    }
}).observe(document.body,{childList:true,subtree:true});
function setGameArtwork(img,game) {setImageFallbacks(img,[safeURL(game.artwork),...imageCandidates(game.steamAppID,game.thumb||game.image)]);}
function prepareImages(container) {
    container.querySelectorAll('img').forEach(img=>{
        if(img.dataset.imageReady)return;
        const source=img.getAttribute('src');
        setImageFallbacks(img,[...imageCandidates('',img.dataset.fallback),source]);
    });
}
function catalogPause(ms,signal) {
    return new Promise((resolve,reject)=>{
        if(signal?.aborted){reject(signal.reason);return;}
        const abort=()=>{clearTimeout(timer);reject(signal.reason);};
        const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
        signal?.addEventListener('abort',abort,{once:true});
    });
}
async function catalogJSON(url,{deadline=Date.now()+45000,...options}={}) {
    for(let attempt=0;;attempt++){
        const remaining=deadline-Date.now();
        if(remaining<=0)throw new DOMException('Tiempo de consulta agotado','TimeoutError');
        try{return await requestJSON(url,{...options,timeout:Math.min(options.timeout||8000,remaining)});}
        catch(error){
            if(options.signal?.aborted)throw error;
            const transient=[429,500,502,503,504].includes(error.status)||['TimeoutError','TypeError'].includes(error.name);
            if(!transient||attempt>=3)throw error;
            const wait=error.status===429?Math.max(1,Math.min(300,error.retryAfter||30))*1000:1500*2**attempt;
            if(wait>=deadline-Date.now())throw error;
            for(let remaining=wait;remaining>0;remaining-=1000){
                loadingText.textContent=`La tienda está ocupada. Reintentamos automáticamente en ${Math.ceil(remaining/1000)} s…`;
                await catalogPause(Math.min(1000,remaining),options.signal);
            }
        }
    }
}

function catalogNotice(message='') {
    let note=document.getElementById('catalogNotice');
    if(!note){note=document.createElement('p');note.id='catalogNotice';note.className='catalog-notice';note.setAttribute('role','status');document.getElementById('catalogError').after(note);}
    note.textContent=message;note.hidden=!message;
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
        const owner=window.accountStorageKey;
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
        if(owner!==window.accountStorageKey)return;
        updateSavedPrices(updates);
        if (activeChip === 'wishlist') renderWishlistChipMode();
        if (!document.getElementById('wishlistDrawerModal').classList.contains('hidden-el')) renderWishlistDrawerItems();
    })().finally(() => { wishlistRefresh = null; });
    return wishlistRefresh;
}
