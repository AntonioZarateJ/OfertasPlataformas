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
    await withServer(async () => { calls++; return Response.json({}, { status: 503 }); }, async base => {
        assert.equal((await fetch(`${base}/api/stores`)).status, 503);
        assert.equal((await fetch(`${base}/api/stores`)).status, 503);
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

test('Avatares locales se sirven como SVG sin ampliar el acceso a archivos privados', async () => {
    await withServer(async () => { throw new Error('No debe consultar'); }, async base => {
        for (const name of ['orbit', 'nova', 'pixel', 'comet', 'quest', 'arcade']) {
            const response = await fetch(`${base}/assets/avatars/${name}.svg`);
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('content-type'), 'image/svg+xml');
            assert.match(await response.text(), /<svg/);
        }
        for (const name of ['/assets/avatars/unknown.svg', '/scripts/probar-resend.ps1', '/firestore.rules']) {
            assert.equal((await fetch(base + name)).status, 404);
        }
    });
});

test('HTML, CSS y JS se entregan con MIME correcto y revalidación ETag', async () => {
    await withServer(async () => {}, async base => {
        const response = await fetch(base);
        assert.match(response.headers.get('content-type'), /text\/html/);
        assert.match(await response.text(), /RadarPlay/i);
        assert.equal((await fetch(base, { headers: { 'If-None-Match': response.headers.get('etag') } })).status, 304);
        assert.match((await fetch(`${base}/assets/css/tailwind.css`)).headers.get('content-type'), /text\/css/);
        assert.match((await fetch(`${base}/assets/js/core.js`)).headers.get('content-type'), /javascript/);
    });
});

test('La guía de precios es accesible desde el catálogo y se sirve en HTML sin iniciar sesión', async () => {
    await withServer(async () => { throw new Error('La guía no consulta proveedores'); }, async base => {
        const home = await fetch(base);
        assert.match(await home.text(), /href="\/como-comparamos"/);
        const guide = await fetch(`${base}/como-comparamos`);
        assert.equal(guide.status, 200);
        assert.match(guide.headers.get('content-type'), /text\/html/);
        const html = await guide.text();
        assert.match(html, /<h1>Cómo comparamos precios<\/h1>/);
        assert.match(html, /<meta name="google-adsense-account"/);
        assert.match(html, /href="\/contacto"/);
    });
});

test('El calendario usa un recurso público y las fichas de la colección entregan su contenido en HTML', async () => {
    await withServer(async () => { throw new Error('El servidor no consulta proveedores para renderizar fichas'); }, async base => {
        const radar = await (await fetch(base + '/radar-mexico')).text();
        const script = radar.match(/src="([^"]+radar-mexico-rotation\.js)"/)?.[1];
        assert.ok(script);
        const calendar = await fetch(base + script);
        assert.equal(calendar.status, 200);
        assert.match(calendar.headers.get('content-type'), /javascript/);

        const collection = await (await fetch(base + '/descubre')).text();
        assert.match(collection, /Juegos hasta \$300 MXN/);
        assert.match(collection, /Cómo elegir una edición/);
        for (const slug of ['gunpoint', 'rocket-league', 'apex-legends', 'stardew-valley']) {
            assert.ok(collection.includes('href="/descubre/' + slug + '"'));
            const response = await fetch(base + '/descubre/' + slug);
            assert.equal(response.status, 200);
            const body = await response.text();
            assert.ok(body.includes('https://salesplataforms.onrender.com/descubre/' + slug));
            assert.match(body, /property="og:image"/);
            assert.match(body, /Por qué lo elegimos/);
        }
        assert.equal((await fetch(base + '/descubre/desconocido')).status, 404);
    });
});
