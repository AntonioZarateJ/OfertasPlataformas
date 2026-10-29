const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');

async function withServer(fetchImpl, run) {
    const server = createServer({ fetchImpl });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await run(`http://127.0.0.1:${server.address().port}`); }
    finally { await new Promise(resolve => server.close(resolve)); }
}

test('El proxy identifica la aplicación, conserva filtros y reutiliza consultas', async () => {
    let calls = 0;
    await withServer(async (url, options) => {
        calls++;
        assert.match(options.headers['User-Agent'], /SteamPulsePro/);
        assert.equal(new URL(url).searchParams.get('title'), 'Portal 2');
        return Response.json([{ gameID: '1' }]);
    }, async base => {
        const endpoint = `${base}/api/deals?title=Portal+2`;
        const responses = await Promise.all([fetch(endpoint), fetch(endpoint)]);
        for (const response of responses) assert.equal(response.status, 200);
        assert.deepEqual(await (await fetch(endpoint)).json(), [{ gameID: '1' }]);
        assert.equal(calls, 1);
    });
});

test('Los errores de proveedor no se convierten en éxito ni quedan en caché', async () => {
    let calls = 0;
    await withServer(async () => { calls++; return Response.json({}, { status: 429 }); }, async base => {
        assert.equal((await fetch(`${base}/api/stores`)).status, 429);
        assert.equal((await fetch(`${base}/api/stores`)).status, 429);
        assert.equal(calls, 2);
    });
});

test('Un proveedor desconectado devuelve un error controlado', async () => {
    await withServer(async () => { throw new Error('offline'); }, async base => {
        assert.equal((await fetch(`${base}/api/games?id=1`)).status, 502);
    });
});

test('Sólo se sirven archivos públicos y rutas API conocidas', async () => {
    await withServer(async () => { throw new Error('No debe consultar'); }, async base => {
        for (const resource of ['/server.cjs', '/package.json', '/node_modules/a.js', '/api/proxy?url=https://example.com', '/assets/js/../../server.cjs']) {
            assert.equal((await fetch(base + resource)).status, 404);
        }
        assert.equal((await fetch(`${base}/api/deals?url=https://example.com`)).status, 400);
        assert.equal((await fetch(`${base}/api/deals`, { method: 'POST' })).status, 405);
    });
});

test('HTML, CSS y JS se entregan con MIME correcto y revalidación ETag', async () => {
    await withServer(async () => {}, async base => {
        const response = await fetch(base);
        assert.match(response.headers.get('content-type'), /text\/html/);
        assert.match(await response.text(), /SteamPulse/i);
        assert.equal((await fetch(base, { headers: { 'If-None-Match': response.headers.get('etag') } })).status, 304);
        assert.match((await fetch(`${base}/assets/css/tailwind.css`)).headers.get('content-type'), /text\/css/);
        assert.match((await fetch(`${base}/assets/js/core.js`)).headers.get('content-type'), /javascript/);
    });
});
