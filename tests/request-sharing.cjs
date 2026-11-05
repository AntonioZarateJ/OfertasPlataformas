const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('@playwright/test');
const {createServer} = require('../server.cjs');
const {createApiGuard} = require('../security.cjs');

test('Las consultas compartidas no evaden cuotas, límite de trabajo ni máximo de espera', () => {
    const req = {socket: {remoteAddress: '127.0.0.1'}, headers: {}};
    const guard = createApiGuard({capacity: 100, maxConcurrent: 1, maxPending: 3});
    const a = guard(req, {key: 'same'}), b = guard(req, {key: 'same'}), c = guard(req, {key: 'same'});
    assert(a.release && b.release && c.release);
    assert.equal(guard(req, {key: 'same'}).status, 503);
    a.release(); a.release();
    assert.equal(guard(req, {key: 'different'}).status, 503);
    b.release(); c.release();
    const next = guard(req, {key: 'different'}); assert(next.release); next.release();
    const quota = createApiGuard({capacity: 2, refillPerSecond: 0});
    const first = quota(req, {key: 'same'}), second = quota(req, {key: 'same'});
    assert.equal(quota(req, {key: 'same'}).status, 429);
    first.release(); second.release();
});

test('40 catálogos idénticos comparten consulta y cupo sin cambiar filtros', async () => {
    let calls = 0;
    const server = createServer({fetchImpl: async input => {
        calls++;
        const url = new URL(input);
        assert.equal(url.searchParams.get('title'), 'Portal 2');
        assert.equal(url.searchParams.get('storeID'), '1');
        assert.equal(url.searchParams.get('pageNumber'), '0');
        await new Promise(resolve => setTimeout(resolve, 100));
        return Response.json([{gameID: '620', salePrice: '3.50', title: 'Portal 2'}]);
    }});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        const results = await Promise.all(Array.from({length: 40}, async (_, i) => {
            const query = i % 2 ? 'title=Portal+2&storeID=1&pageNumber=0' : 'pageNumber=0&storeID=1&title=Portal%202';
            const response = await fetch(base + '/api/deals?' + query);
            assert.equal(response.status, 200);
            return response.json();
        }));
        assert(results.every(data => data[0].salePrice === '3.50'));
        assert.equal(calls, 1);
    } finally {await new Promise(resolve => server.close(resolve));}
});

test('Compartir no mezcla precios de regiones, IDs ni páginas diferentes', async () => {
    const calls = [];
    const server = createServer({fetchImpl: async input => {
        const url = new URL(input); calls.push(url.href);
        return Response.json({region: url.searchParams.get('cc'), ids: url.searchParams.get('appids')});
    }});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        const results = await Promise.all(['appids=1&region=MX', 'appids=1&region=US', 'appids=2&region=MX'].map(async query => (await fetch(base + '/api/steam-prices?' + query)).json()));
        assert.deepEqual(results, [{region: 'mx', ids: '1'}, {region: 'us', ids: '1'}, {region: 'mx', ids: '2'}]);
        assert.equal(calls.length, 3);
    } finally {await new Promise(resolve => server.close(resolve));}
});

function rawGet(base, route, encoding, etag) {
    return new Promise((resolve, reject) => {
        const req = http.get(base + route, {headers: {'Accept-Encoding': encoding, ...(etag ? {'If-None-Match': etag} : {})}}, res => {
            const chunks = []; res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)}));
            res.on('error', reject);
        }); req.on('error', reject);
    });
}

test('Gzip reduce HTML/CSS/JS, conserva el contenido y separa sus validadores de caché', async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        for (const route of ['/', '/assets/css/tailwind.css', '/assets/js/core.js']) {
            const [plain, gzip] = await Promise.all([rawGet(base, route, 'gzip;q=0'), rawGet(base, route, 'br, gzip')]);
            assert.equal(plain.headers['content-encoding'], undefined);
            assert.equal(gzip.headers['content-encoding'], 'gzip');
            assert.deepEqual(gunzipSync(gzip.body), plain.body);
            assert(gzip.body.length < plain.body.length);
            assert.notEqual(plain.headers.etag, gzip.headers.etag);
            assert.equal(gzip.headers.vary, 'Accept-Encoding');
            assert.equal((await rawGet(base, route, 'gzip', gzip.headers.etag)).status, 304);
            assert.equal((await rawGet(base, route, 'identity', gzip.headers.etag)).status, 200);
        }
    } finally {await new Promise(resolve => server.close(resolve));}
});

test('El navegador comparte GET públicos sin mezclar resultados, cancelaciones ni pausas de saturación', async () => {
    const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    try {
        const page = await browser.newPage();
        const counts = {};
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url()); const title = url.searchParams.get('title');
            counts[title] = (counts[title] || 0) + 1;
            if (title === 'pause') return route.fulfill({status: 503, headers: {'Retry-After': '60'}, json: {error: 'busy'}});
            if (['shared', 'cancel'].includes(title)) {await new Promise(resolve => setTimeout(resolve, 80)); return route.fulfill({json: {price: 12}});}
            return route.fulfill({json: url.pathname === '/api/deals' || url.pathname === '/api/stores' ? [] : {}});
        });
        await page.goto('http://127.0.0.1:' + server.address().port);
        const state = await page.evaluate(async () => {
            const shared = await Promise.all(Array.from({length: 20}, () => requestJSON('/api/games?title=shared')));
            shared[0].price = 999;
            const a = new AbortController(), b = new AbortController();
            const cancelled = requestJSON('/api/games?title=cancel', {signal: a.signal}).catch(error => error.name);
            const surviving = requestJSON('/api/games?title=cancel', {signal: b.signal});
            setTimeout(() => a.abort(), 20);
            const aborted = await cancelled, survivor = await surviving;
            await Promise.all([requestJSON('/api/auth-config', {ttl: 0}), requestJSON('/api/auth-config', {ttl: 0})]);
            const start = Date.now(); let pause;
            try {await catalogJSON('/api/games?title=pause', {deadline: Date.now() + 300});} catch (error) {pause = error.status;}
            return {isolated: shared[1].price, aborted, survivor: survivor.price, pause, quick: Date.now() - start < 1000};
        });
        assert.equal(counts.shared, 1);
        assert.equal(counts.cancel, 2);
        assert.equal(counts.pause, 1);
        assert.deepEqual(state, {isolated: 12, aborted: 'AbortError', survivor: 12, pause: 503, quick: true});
    } finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
});
