const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, expect} = require('@playwright/test');
const {createServer} = require('../server.cjs');
const {renderLegalPage} = require('../legal.cjs');

test('Los datos pendientes se muestran como borrador y el contacto válido genera un correo, no un envío', () => {
    const draft = renderLegalPage('/privacidad', {});
    assert.match(draft, /Borrador pendiente/);
    assert.match(draft, /noindex/);
    const config = {responsible: 'Responsable <ejemplo>', email: 'contacto@example.com', country: 'México', address: 'Domicilio público', updated: '2026-11-05'};
    const html = renderLegalPage('/contacto', config);
    assert(!html.includes('noindex'));
    assert(!html.includes('Responsable <ejemplo>'));
    assert(html.includes('Responsable &lt;ejemplo&gt;'));
    assert(html.includes('mailto:contacto@example.com?subject='));
    const invalid = renderLegalPage('/contacto', {...config, email: 'a@example.com?bcc=bad@example.com'});
    assert(!invalid.includes('mailto:'));
    assert.equal(renderLegalPage('/unknown'), null);
});

test('Las páginas legales son accesibles sin cuenta, no consultan tiendas y conservan las cabeceras de seguridad', async () => {
    let calls = 0;
    const server = createServer({fetchImpl: async () => {calls++; throw Error('No debe consultar tiendas');}});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        for (const route of ['/privacidad', '/contacto', '/eliminar-datos']) {
            const response = await fetch(base + route);
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /text\/html/);
            assert.equal(response.headers.get('x-frame-options'), 'DENY');
            assert.match(response.headers.get('content-security-policy'), /script-src-attr 'none'/);
            const head = await fetch(base + route, {method: 'HEAD'});
            assert.equal(await head.text(), '');
        }
        for (const route of ['/legal-config.cjs', '/legal.cjs']) assert.equal((await fetch(base + route)).status, 404);
        assert.equal(calls, 0);
    } finally {await new Promise(resolve => server.close(resolve));}
});

test('Privacidad, contacto y eliminación son legibles en móvil y escritorio, sin servicios externos', async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    try {
        const page = await browser.newPage();
        const base = 'http://127.0.0.1:' + server.address().port;
        const external = [], errors = [];
        page.on('request', request => {if (!request.url().startsWith(base)) external.push(request.url());});
        page.on('pageerror', error => errors.push(error.message));
        for (const width of [390, 1280]) {
            await page.setViewportSize({width, height: 850});
            for (const route of ['/privacidad', '/contacto', '/eliminar-datos']) {
                await page.goto(base + route);
                await expect(page.locator('h1')).toBeVisible();
                await expect(page.locator('footer a')).toHaveCount(3);
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        await page.setViewportSize({width: 390, height: 850});
        await page.goto(base + '/privacidad');
        await page.screenshot({path: 'test-results/privacidad-mobile.png', fullPage: true});
    } finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
});
