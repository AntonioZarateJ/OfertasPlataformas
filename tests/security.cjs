const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('../server.cjs');
const {createApiGuard,publicFirebaseConfig} = require('../security.cjs');
const {createPublicFetch} = require('../public-fetch.cjs');
const {BoundedCache} = require('../bounded-cache.cjs');
const {chromium, expect} = require('@playwright/test');

test('Valida parámetros, cabeceras y rutas privadas antes de consultar al proveedor', async () => {
    let calls = 0;
    const server = createServer({fetchImpl: async () => {calls++; return Response.json([]);}});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        for (const query of ['pageNumber=-1', 'pageSize=10000', 'desc=evil', 'sortBy=unknown', 'title=a&title=b', 'steamRating=NaN', 'title=%00', 'upperPrice=Infinity', 'storeID=localhost']) {
            assert.equal((await fetch(base + '/api/deals?' + query)).status, 400, query);
        }
        assert.equal(calls, 0);
        for (const name of ['/.env', '/firestore.rules', '/security.cjs', '/.data/price-history.json', '/assets/js/../../server.cjs']) {
            assert.equal((await fetch(base + name)).status, 404, name);
        }
        assert.equal((await fetch(base + '/api/stores', {headers: {'Sec-Fetch-Site': 'cross-site'}})).status, 403);
        assert.equal((await fetch(base + '/' + 'a'.repeat(8200))).status, 414);
        const response = await fetch(base);
        const csp = response.headers.get('content-security-policy');
        assert.match(csp, /script-src-attr 'none'/);
        assert(!csp.match(/script-src[^;]*unsafe-inline/));
        assert.match(csp, /frame-ancestors 'none'/);
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(server.maxHeadersCount, 50);
        assert.equal(server.headersTimeout, 10000);
    } finally {await new Promise(resolve => server.close(resolve));}
});

test('La limitación no confía en IP falsificada y mantiene el límite concurrente', () => {
    let time = 0;
    const guard = createApiGuard({capacity: 3, refillPerSecond: 1, maxConcurrent: 1, now: () => time});
    const request = {socket: {remoteAddress: '127.0.0.1'}, headers: {'x-forwarded-for': '1.2.3.4'}};
    const first = guard(request);
    assert.equal(guard(request).status, 503);
    first.release(); first.release();
    const next = guard(request); assert(next.release); next.release();
    request.headers['x-forwarded-for'] = '5.6.7.8';
    assert.equal(guard(request).status, 429);
    time += 1000;
    const restored = guard(request); assert(restored.release); restored.release();
});

test('Bloquea SSRF, redirecciones fuera del origen y respuestas sin tamaño acotado', async () => {
    let calls = 0;
    const request = createPublicFetch(async () => {calls++; return new Response(null, {status: 302, headers: {location: 'http://127.0.0.1/private'}});});
    for (const url of ['http://www.cheapshark.com/', 'https://127.0.0.1/', 'https://www.cheapshark.com.evil.test/', 'https://user:pass@www.cheapshark.com/']) await assert.rejects(request(url));
    assert.equal(calls, 0);
    await assert.rejects(request('https://www.cheapshark.com/api/1.0/stores'));
    assert.equal(calls, 1);
    const oversized = createPublicFetch(async () => new Response('x'.repeat(30)), {maxBytes: 16});
    await assert.rejects(oversized('https://www.cheapshark.com/api/1.0/stores'), /demasiado grande/);
    const cache = new BoundedCache({maxEntries: 3, maxBytes: 20});
    cache.set('a', {data: '1234567890'}); cache.set('b', {data: '1234567890'});
    assert.equal(cache.size, 1); assert(cache.bytes <= 20);
});

test('Ordenar PC no llama a la API; CSP y normalización protegen la interfaz', async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    try {
        const page = await browser.newPage(); const errors = [], queries = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url()); let data = {};
            if (url.pathname === '/api/stores') data = [];
            if (url.pathname === '/api/deals') {
                queries.push(url.searchParams);
                data = url.searchParams.get('pageNumber') === '0'
                    ? Array.from({length: 60}, (_, i) => ({gameID: String(i + 1), title: 'Juego ' + (i + 1), salePrice: 60 - i, normalPrice: 100, savings: 50, steamRatingPercent: i, storeID: '1'}))
                    : [{gameID: '61', title: 'Nuevo barato', salePrice: 0.5, normalPrice: 1, savings: 50, storeID: '1'}];
            }
            if (url.pathname === '/api/test-pause') return route.fulfill({status: 429, headers: {'Retry-After': '300'}, contentType: 'application/json', body: '{}'});
            await route.fulfill({contentType: 'application/json', body: JSON.stringify(data)});
        });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
        const before = queries.length;
        for (const sort of ['Price', 'Reviews', 'Metacritic', 'Release', 'Savings', 'DealRating', 'Price']) {
            await page.locator('#sortSelect').selectOption(sort);
            await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
            await expect(page.locator('#loadingState')).not.toBeVisible();
        }
        assert.equal(queries.length, before);
        await expect(page.locator('#gamesGrid h3').first()).toHaveText('Juego 60');
        await page.evaluate(()=>{
            const card=[...gamesGrid.children].find(card=>card.dataset.cardId==='1');card.__identity='preserved';
            const box=card.querySelector('.price-box');box.dataset.regionalCurrency=currentCurrency;box.dataset.regionalAmount='0.1';
            renderSortedPCCatalog();
        });
        await expect(page.locator('#gamesGrid h3').first()).toHaveText('Juego 1');
        assert.equal(await page.locator('#gamesGrid .steam-card').first().evaluate(card=>card.__identity),'preserved');
        assert.equal(queries.length,before);
        await page.evaluate(()=>{const box=gamesGrid.firstElementChild.querySelector('.price-box');delete box.dataset.regionalCurrency;delete box.dataset.regionalAmount;renderSortedPCCatalog();});
        await page.locator('#loadMoreBtn').click();
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(61);
        assert.equal(queries.at(-1).get('sortBy'), 'DealRating');
        await expect(page.locator('#gamesGrid h3').first()).toHaveText('Nuevo barato');
        assert.equal(await page.locator('[onclick],[onchange],[onsubmit],[oninput]').count(), 0);
        const protectedState = await page.evaluate(async () => {
            const script = document.createElement('script'); script.textContent = 'window.cspExecuted=true'; document.body.appendChild(script);
            const button = document.createElement('button'); button.setAttribute('onclick', 'window.attributeExecuted=true'); document.body.appendChild(button); button.click();
            const normalized = normalizeWishlist(JSON.parse('{"__proto__":{"title":"bad","salePrice":1},"1":{"title":"Valid","salePrice":1,"password":"discard","thumb":"javascript:alert(1)"}}'));
            let bounded = false; const start = Date.now();
            try {await catalogJSON('/api/test-pause', {deadline: Date.now() + 100});} catch {bounded = Date.now() - start < 1000;}
            return {csp: !window.cspExecuted && !window.attributeExecuted, nullPrototype: Object.getPrototypeOf(normalized) === null, keys: Object.keys(normalized), password: normalized['1'].password, image: normalized['1'].thumb, bounded};
        });
        assert.equal(protectedState.csp, true);
        assert.equal(protectedState.nullPrototype, true);
        assert.deepEqual(protectedState.keys, ['1']);
        assert.equal(protectedState.password, undefined);
        assert.equal(protectedState.image, '');
        assert.equal(protectedState.bounded, true);
        assert.deepEqual(errors, []);
    } finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
});

test('La configuración pública de Firebase no expone valores de formato inválido',()=>{
    const config=publicFirebaseConfig({FIREBASE_API_KEY:'not-a-public-key',FIREBASE_AUTH_DOMAIN:'bad\r\nInjected: yes',FIREBASE_PROJECT_ID:'valid-project',FIREBASE_APP_ID:'private-token'});
    assert.equal(config.apiKey,'');assert.equal(config.authDomain,'');assert.equal(config.projectId,'valid-project');assert.equal(config.appId,'');
});
