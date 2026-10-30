const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { consoleCatalog } = require('./console-sources.cjs');
const { rememberCatalog, compareGame } = require('./console-comparison.cjs');

const { createCheapSharkClient } = require('./cheapshark-client.cjs');
const {loadSteamEditions}=require('./steam-editions.cjs');
const { discountPosition } = require('./discount-position.cjs');
const root = __dirname;
const upstreams = {
    '/api/steam-prices': ['https://store.steampowered.com/api/appdetails?cc=mx&filters=price_overview', 60000],
    '/api/deals': ['https://www.cheapshark.com/api/1.0/deals', 60000],
    '/api/games': ['https://www.cheapshark.com/api/1.0/games', 60000],
    '/api/stores': ['https://www.cheapshark.com/api/1.0/stores', 3600000],
    '/api/exchange-rates': ['https://open.er-api.com/v6/latest/USD', 3600000],
    '/api/giveaways': ['https://www.gamerpower.com/api/giveaways?type=game', 60000]
};

function createServer({ fetchImpl = fetch } = {}) {
    const cache = new Map();
    const positions=new Map();
    const cheapsharkFetch=createCheapSharkClient(fetchImpl);
    const pending = new Map();
    const reply = (res, status, data) => {
        if(status===429)res.setHeader('Retry-After',String(data.retryAfter||30));
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(data));
    };
    return http.createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); reply(res, 405, { error: 'Método no permitido' }); return; }
        try {
            const url = new URL(req.url, 'http://localhost');
            if(url.pathname==='/api/pc-editions'){
                const appid=url.searchParams.get('appid'),region=url.searchParams.get('region');
                if(!/^\d{1,10}$/.test(appid||'')||!['MX','US','ES','GB','BR','JP'].includes(region)){reply(res,400,{error:'Juego inválido'});return;}
                const key='steam-editions:'+appid+':'+region;
                if(cache.get(key)?.expires>Date.now()){reply(res,200,cache.get(key).data);return;}
                if(!pending.has(key))pending.set(key,loadSteamEditions(appid,region,fetchImpl));
                try{const data=await pending.get(key);if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:Date.now()+60000});reply(res,200,data);}finally{pending.delete(key);}return;
            }
            if (url.pathname === '/api/deals-position') {
                if(!url.searchParams.has('storeID'))url.searchParams.set('storeID','1');
                if(!/^\d{1,5}$/.test(url.searchParams.get('storeID')||'')||!/^\d{1,3}$/.test(url.searchParams.get('discount')||'')||Number(url.searchParams.get('discount'))>100||[...url.searchParams].some(([k,v])=>!['discount','desc','storeID','title','onSale','steamRating','AAA'].includes(k)||v.length>250)){reply(res,400,{error:'Filtros inválidos'});return;}
                const key='position:'+url.searchParams.toString();
                if(cache.get(key)?.expires>Date.now()){reply(res,200,cache.get(key).data);return;}
                if(!positions.has(key)||positions.get(key).expires<Date.now()){
                    if(positions.size>=100)positions.delete(positions.keys().next().value);
                    positions.set(key,{state:{},expires:Date.now()+300000});
                }
                if(!pending.has(key))pending.set(key,discountPosition(url.searchParams,cheapsharkFetch,positions.get(key).state));
                try{const data=await pending.get(key);if(cache.size>=200)cache.delete(cache.keys().next().value);if(!data.pending)cache.set(key,{data,expires:Date.now()+60000});reply(res,200,data);}finally{pending.delete(key);}return;
            }
            if (url.pathname === '/api/console-comparison') {
                const platform=url.searchParams.get('platform'), region=url.searchParams.get('region'), title=(url.searchParams.get('title')||'').trim();
                if(!['xbox','ps','switch'].includes(platform)||!['MX','US','ES','GB','BR','JP'].includes(region)||!title||title.length>200){reply(res,400,{error:'Juego inválido'});return;}
                const key='compare:'+url.searchParams.toString();
                if(cache.get(key)?.expires>Date.now()){reply(res,200,cache.get(key).data);return;}
                if(!pending.has(key))pending.set(key,compareGame(platform,region,title,url.searchParams.get('id'),url.searchParams.get('store')));
                try{const data=await pending.get(key);if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:Date.now()+60000});reply(res,200,data);}finally{pending.delete(key);}return;
            }
            if (url.pathname === '/api/console-catalog') {
                const platform = url.searchParams.get('platform');
                const region = url.searchParams.get('region');
                const query = (url.searchParams.get('q') || '').trim();
                if (!['xbox','ps','switch'].includes(platform) || !['MX','US','ES','GB','BR','JP'].includes(region) || query.length > 100) { reply(res,400,{error:'Consulta inválida'}); return; }
                const sort = url.searchParams.get('sort') || 'relevance';
                const source = url.searchParams.get('source') || 'all';
                const onlyDeals = url.searchParams.get('deals') === '1';
                let discount=null;
                if(url.searchParams.has('discountMin')||url.searchParams.has('discountMax')){
                    const min=Number(url.searchParams.get('discountMin')),max=Number(url.searchParams.get('discountMax'));
                    if(!url.searchParams.has('discountMin')||!url.searchParams.has('discountMax')||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>100||min>max){reply(res,400,{error:'Porcentaje inválido'});return;}
                    discount={min,max};
                }
                let cursor;
                try { cursor = JSON.parse(url.searchParams.get('cursor') || '{}'); } catch { reply(res,400,{error:'Paginación inválida'});return; }
                const validCursor = cursor && typeof cursor === 'object' && !Array.isArray(cursor) && JSON.stringify(cursor).length < 6000 &&
                  (cursor.external === undefined || cursor.external === false || Number.isInteger(cursor.external) && cursor.external >= 1 && cursor.external <= 500) &&
                  (cursor.official === undefined || cursor.official === false || typeof cursor.official === 'string' && /^[A-Za-z0-9+/=]+$/.test(cursor.official) || Number.isInteger(cursor.official) && cursor.official >= 0 && cursor.official <= 1000 || typeof cursor.official === 'object' && cursor.official !== null && Number.isInteger(cursor.official.offset) && cursor.official.offset >= 0 && cursor.official.offset <= 100000 && typeof cursor.official.token === 'string' && cursor.official.token.length < 4000);
                if (!validCursor || !['all','official','external'].includes(source) || !['relevance','rating','priceAsc','priceDesc','discountAsc','discountDesc'].includes(sort)) { reply(res,400,{error:'Filtros inválidos'});return; }
                const key = `console:${platform}:${region}:${query}:${sort}:${source}:${onlyDeals}:${JSON.stringify(discount)}:${JSON.stringify(cursor)}`;
                if (cache.get(key)?.expires > Date.now()) { rememberCatalog(cache.get(key).data); reply(res,200,cache.get(key).data); return; }
                if (!pending.has(key)) pending.set(key,consoleCatalog(platform,region,query,{cursor,sort,source,onlyDeals,discount}));
                try {
                    const data = await pending.get(key);
                    rememberCatalog(data);
                    if (cache.size >= 200) cache.delete(cache.keys().next().value);
                    if (data.sources.every(s => s.status !== 'unavailable')) cache.set(key,{data,expires:Date.now()+60000});
                    reply(res,200,data);
                } finally { pending.delete(key); }
                return;
            }
            if (url.pathname === '/api/auth-config') {
                reply(res, 200, { apiKey: process.env.FIREBASE_API_KEY || '', authDomain: process.env.FIREBASE_AUTH_DOMAIN || '', projectId: process.env.FIREBASE_PROJECT_ID || '', appId: process.env.FIREBASE_APP_ID || '' }); return;
            }
            if (upstreams[url.pathname]) {
                const [base, ttl] = upstreams[url.pathname];
                const target = new URL(base);
                if (['/api/deals', '/api/games'].includes(url.pathname)) {
                    const allowed = new Set(['desc', 'pageSize', 'pageNumber', 'sortBy', 'storeID', 'title', 'onSale', 'steamRating', 'upperPrice', 'AAA', 'id', 'limit']);
                    for (const [key, value] of url.searchParams) {
                        if (!allowed.has(key) || value.length > 250) { reply(res, 400, { error: 'Parámetro inválido' }); return; }
                        target.searchParams.set(key, value);
                    }
                }
                if (url.pathname === '/api/steam-prices') {
                    const ids = url.searchParams.get('appids') || '';
                    if (!/^\d+(,\d+){0,59}$/.test(ids)) { reply(res, 400, { error: 'IDs inválidos' }); return; }
                    target.searchParams.set('appids', ids);
                    const region = url.searchParams.get('region') || 'MX';
                    if (!['MX', 'US', 'ES', 'GB', 'BR', 'JP'].includes(region)) { reply(res, 400, { error: 'Región inválida' }); return; }
                    target.searchParams.set('cc', region.toLowerCase());
                }
                const key = target.href;
                const cached = cache.get(key);
                if (cached?.expires > Date.now()) { reply(res, 200, cached.data); return; }
                if (!pending.has(key)) {
                    const work = (async () => {
                        const response = await (target.hostname==='www.cheapshark.com'?cheapsharkFetch:fetchImpl)(target.href, {
                            headers: { 'User-Agent': 'SteamPulsePro/1.0 (game price comparison application)', Accept: 'application/json' },
                            signal: AbortSignal.timeout(6500)
                        });
                        if (!response.ok) return { status: response.status, data: { error: `El proveedor respondió HTTP ${response.status}`,retryAfter:Number(response.headers.get('Retry-After'))||0 } };
                        const data = await response.json();
                        if (cache.size >= 200) cache.delete(cache.keys().next().value);
                        cache.set(key, { expires: Date.now() + ttl, data });
                        return { status: 200, data };
                    })();
                    pending.set(key, work);
                }
                const work = pending.get(key);
                try { const result = await work; reply(res, result.status, result.data); }
                finally { if (pending.get(key) === work) pending.delete(key); }
                return;
            }
            const name = decodeURIComponent(url.pathname);
            const relative = name === '/' || name === '/index.html' ? 'index.html' : name.slice(1);
            // Publicar sólo la interfaz; nunca exponer el servidor ni node_modules.
            if (relative !== 'index.html' && !/^assets\/(css|js)\/[a-zA-Z0-9_./-]+\.(css|js)$/.test(relative)) {
                reply(res, 404, { error: 'Recurso no encontrado' }); return;
            }
            const file = path.resolve(root, relative);
            if (!file.startsWith(root + path.sep)) { reply(res, 403, { error: 'Ruta no permitida' }); return; }
            const stat = await fs.stat(file);
            const etag = `"${stat.size}-${stat.mtimeMs}"`;
            res.setHeader('ETag', etag);
            res.setHeader('Cache-Control', 'no-cache');
            if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return; }
            const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
            res.setHeader('Content-Type', mime[path.extname(file)]);
            res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file));
        } catch (error) {
            const status = error.upstreamStatus===429?429:error.code === 'ENOENT' ? 404 : error.name === 'TimeoutError' ? 504 : 502;
            reply(res, status, { retryAfter:error.retryAfter||0,error: status === 404 ? 'Recurso no encontrado' : 'No se pudo consultar el proveedor. Inténtalo de nuevo.' });
        }
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    createServer().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`SteamPulse: http://localhost:${port}`));
}
module.exports = { createServer };
