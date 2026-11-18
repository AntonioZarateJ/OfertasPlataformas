const {BoundedCache} = require('./bounded-cache.cjs');
const {recordHistory} = require('./price-history.cjs');

const store = 'Google Play';
const currencies = {MX:'MXN',US:'USD',ES:'EUR',GB:'GBP',BR:'BRL',JP:'JPY'};
const apps = [
    {id:'com.mojang.minecraftpe', title:'Minecraft', type:'game'},
    {id:'com.chucklefish.stardewvalley', title:'Stardew Valley', type:'game'},
    {id:'com.robtopx.geometryjump', title:'Geometry Dash', type:'game'},
    {id:'com.ustwo.monumentvalley', title:'Monument Valley', type:'game'},
    {id:'com.teamspeak.ts3client', title:'TeamSpeak 3', type:'app', aliases:'voz chat voice'},
    {id:'org.videolan.vlc', title:'VLC for Android', type:'app', aliases:'video reproductor'},
    {id:'com.adobe.lrmobile', title:'Adobe Lightroom', type:'app', aliases:'fotos editar video'},
    {id:'com.supercell.brawlstars', title:'Brawl Stars', type:'game'}
];
const appUrl = (id, region) => 'https://play.google.com/store/apps/details?' + new URLSearchParams({id,hl:'es',gl:region});
const lookupText = value => value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

function playQuote(html, app, region) {
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
    let url;
    try { url = new URL(canonical?.replaceAll('&amp;', '&')); } catch { return null; }
    if (url.origin !== 'https://play.google.com' || url.pathname !== '/store/apps/details' || url.searchParams.get('id') !== app.id) return null;
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(match[1]); } catch { continue; }
        if (!data || typeof data.name !== 'string' || !data.name.trim()) continue;
        const offers = (Array.isArray(data.offers) ? data.offers : [data.offers]).filter(offer =>
            offer?.['@type'] === 'Offer' && offer.priceCurrency === currencies[region] && /\/InStock$/.test(offer.availability || '') &&
            /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(offer.price)));
        const prices = new Set(offers.map(offer=>Number(offer.price)));
        if (prices.size !== 1) continue;
        const [price] = prices;
        if (!Number.isFinite(price) || price > 1e7) continue;
        const rating = Number(data.aggregateRating?.ratingValue);
        const ratingCount = Number(data.aggregateRating?.ratingCount);
        const image = typeof data.image === 'string' && /^https:\/\/play-lh\.googleusercontent\.com\//.test(data.image) ? data.image : '';
        return {id:app.id,title:data.name.slice(0,240),appType:app.type,edition:app.type === 'game' ? 'Juego para Android' : 'Aplicación para Android',
            store,kind:'official',price,regular:price,currency:currencies[region],discount:0,image,url:appUrl(app.id,region),
            rating:Number.isFinite(rating) && rating >= 0 && rating <= 5 ? Number(rating.toFixed(1)) : null,
            ratingCount:Number.isSafeInteger(ratingCount) && ratingCount > 0 ? ratingCount : 0};
    }
    return null;
}

function createGooglePlay(fetchPage, {record = recordHistory, now = Date.now} = {}) {
    const cache = new BoundedCache({maxEntries:80,maxBytes:3*1024*1024});
    const pending = new Map();
    const queue = [];
    let active = 0;
    let pausedUntil = 0;

    function drain() {
        while (active < 3 && queue.length) {
            const {run, resolve} = queue.shift();
            active++;
            void run().then(resolve,()=>resolve(null)).finally(()=>{ active--; drain(); });
        }
    }

    async function get(app, region) {
        const key = region + ':' + app.id;
        const cached = cache.get(key);
        if (cached?.expires > now()) return cached.data;
        if (pending.has(key)) return pending.get(key);
        if (queue.length >= 24 || pausedUntil > now()) return null;
        const job = new Promise(resolve => {
            queue.push({resolve,run:async () => {
                if (pausedUntil > now()) return null;
                const response = await fetchPage(appUrl(app.id, region), {signal:AbortSignal.timeout(4500)});
                if (response.status === 429 || response.status === 403) {
                    const retry = response.headers.get('Retry-After');
                    const delay = /^\d+$/.test(retry || '') ? Number(retry)*1000 : Date.parse(retry) - now();
                    pausedUntil = Math.max(pausedUntil, now() + Math.max(60000, Number.isFinite(delay) ? delay : 0));
                }
                const quote = response.ok ? playQuote(await response.text(), app, region) : null;
                const checkedAt = now();
                const data = quote ? (await record(`android|${region}|${app.id}`, [{...quote,checkedAt}], checkedAt))[0] : null;
                cache.set(key,{data,expires:now() + (data ? 15*60*1000 : 15000)});
                return data;
            }});
            drain();
        }).finally(()=>pending.delete(key));
        pending.set(key,job);
        return job;
    }

    function observed(quote) {
        const drop = quote.history?.drop;
        const validDrop = drop && now() - drop.previousAt < 86400000 && drop.from > quote.price;
        if (validDrop) return {...quote,regular:drop.from,discount:(drop.from-quote.price)/drop.from*100,observedDrop:true};
        return drop ? {...quote,history:{...quote.history,drop:null}} : quote;
    }

    const storefront = 'https://play.google.com/store?hl=es';
    const scope = 'Selección de fichas de Google Play. El importe corresponde a la descarga inicial. Compras dentro de la app y suscripciones se consultan en la tienda.';
    return {
        async catalog(region, query, {cursor, source, onlyDeals, discount, sort}) {
            const terms = lookupText(query).split(/\s+/).filter(Boolean);
            const matches = source === 'external' || cursor.official === false ? [] :
                apps.filter(app=>terms.every(term=>lookupText(`${app.title} ${app.id} ${app.aliases || ''}`).includes(term)));
            const quotes = (await Promise.all(matches.map(app=>get(app,region)))).filter(Boolean).map(observed);
            const items = quotes.filter(quote=>(!onlyDeals || quote.observedDrop) && (!discount || Math.round(quote.discount)>=discount.min && Math.round(quote.discount)<=discount.max));
            const sorts = {priceAsc:(a,b)=>a.price-b.price,priceDesc:(a,b)=>b.price-a.price,discountAsc:(a,b)=>a.discount-b.discount,
                discountDesc:(a,b)=>b.discount-a.discount,rating:(a,b)=>(b.rating??-1)-(a.rating??-1)};
            if (Object.hasOwn(sorts,sort)) items.sort(sorts[sort]);
            return {platform:'android',region,items,next:null,scope,checkedAt:now(),
                sources:[{name:store,url:storefront,status:quotes.length || !matches.length ? 'ok':'unavailable',count:quotes.length}],
                partial:quotes.length < matches.length};
        },
        async compare(region, id) {
            const app = apps.find(item=>item.id===id);
            const quote = app ? await get(app,region) : null;
            return {platform:'android',region,checkedAt:quote?.checkedAt ?? now(),offers:quote ? [observed(quote)] : [],
                editions:[],otherEditions:[],searchLinks:[],coverage:scope,
                sources:[{name:store,url:storefront,status:quote ? 'ok':'unavailable'}]};
        }
    };
}

module.exports = {createGooglePlay, playQuote};
