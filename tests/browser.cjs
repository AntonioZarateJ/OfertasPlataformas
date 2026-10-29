const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const game = (id = 1, title = `Juego ${id}`) => ({
    gameID: String(id), dealID: `deal-${id}`, steamAppID: String(id), title,
    thumb: 'https://example.com/game.jpg', salePrice: '10.00', normalPrice: '40.00',
    savings: '75', steamRatingPercent: '90', metacriticScore: '80', storeID: '1'
});
const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = {};
    const calls = [];
    await page.route('**/*', async route => {
        const request = route.request();
        const u = new URL(request.url());
        if (u.origin === url && !u.pathname.startsWith('/api/')) return route.continue();
        calls.push({ url: u.href, method: request.method() });
        const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
        if (u.pathname === '/api/deals') {
            const query = u.searchParams.get('title');
            if (query === 'lento') await sleep(600);
            if (mode.catalogFailure) return json({}, 503);
            if (u.searchParams.get('upperPrice') === '0') return json([{ ...game(99), salePrice: '0.00', savings: '100' }]);
            if (query) return json([game(80, query)]);
            return json(u.searchParams.get('pageNumber') === '0' ? Array.from({ length: 60 }, (_, i) => game(i + 1, i === 0 && mode.malicious ? '<img src=x onerror="window.injected=1">' : `Juego ${i + 1}`)) : [game(61), game(1)]);
        }
        if (u.pathname === '/api/games') {
            if (u.searchParams.has('title')) {
                if (u.searchParams.get('title') === 'lento') await sleep(600);
                return json([{ gameID: '1', external: u.searchParams.get('title'), cheapest: '7', steamAppID: '1' }]);
            }
            if (mode.detailFailure) return json({}, 500);
            const id = u.searchParams.get('id');
            if (id === '2' && mode.slowModal) await sleep(500);
            return json({ info: { title: `Juego ${id}` }, cheapestPriceEver: { price: '0.00', date: 1700000000 }, deals: [{ storeID: '1', dealID: 'detail', price: '7.00', retailPrice: '40.00', savings: '82.5' }] });
        }
        if (u.pathname.endsWith('/stores')) { await sleep(mode.auxDelay || 0); return json([{ storeID: '1', storeName: 'Steam', images: { icon: '/icon.png' } }]); }
        if (u.pathname === '/api/exchange-rates') { await sleep(mode.auxDelay || 0); return json({ rates: { USD: 1, MXN: 20, EUR: 0.9, JPY: 150 } }); }
        if (u.hostname.endsWith('firebaseio.com')) {
            if (mode.cloudFailure === request.method()) return json({ error: 'Permission denied' }, 403);
            return json(request.method() === 'GET' ? { items: { '400': { ...game(400), gameID: '400' } } } : {});
        }
        if (u.pathname === '/api/giveaways') return json([]);
        if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215"><rect width="460" height="215" fill="#163b55"/><text x="30" y="120" fill="white" font-size="28">Prueba SteamPulse</text></svg>' });
        return route.fulfill({ body: '', contentType: 'text/css' });
    });
    const cards = page.locator('#gamesGrid .steam-card');
    const reset = async (options = {}) => {
        mode = options;
        await page.goto(url);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(cards).toHaveCount(60);
    };
    let passed = 0;
    const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
    try {
        await test('El catálogo carga sin esperar los servicios auxiliares', async () => {
            mode = { auxDelay: 1800 };
            const start = Date.now();
            await page.goto(url);
            await expect(cards).toHaveCount(60, { timeout: 1200 });
            assert(Date.now() - start < 1800);
            assert.equal(await page.locator('script[src*="cdn.tailwindcss"]').count(), 0);
            assert.equal(await page.locator('#gamesGrid').evaluate(el => getComputedStyle(el).display), 'grid');
        });
        await test('Paginación sin duplicados y fin de resultados', async () => {
            await page.locator('#loadMoreBtn').click();
            await expect(cards).toHaveCount(61);
            await expect(page.locator('#loadMoreContainer')).toBeHidden();
        });
        await test('Las búsquedas recientes ganan a las respuestas antiguas', async () => {
            await page.locator('#predictiveSearchInput').fill('lento');
            await page.locator('#predictiveSearchInput').press('Enter');
            await page.locator('#predictiveSearchInput').fill('rápido');
            await page.locator('#predictiveSearchInput').press('Enter');
            await expect(cards.locator('h3')).toHaveText('rápido');
            await sleep(700);
            await expect(cards.locator('h3')).toHaveText('rápido');
        });
        await test('Vaciar búsqueda cancela sugerencias pendientes', async () => {
            await page.locator('#predictiveSearchInput').fill('lento');
            await sleep(330);
            await page.locator('#predictiveSearchInput').fill('');
            await sleep(700);
            await expect(page.locator('#searchDropdown')).toBeHidden();
        });
        await test('Cambiar a wishlist durante una consulta no restaura el catálogo', async () => {
            await reset();
            await page.locator('#predictiveSearchInput').fill('lento');
            await page.locator('#predictiveSearchInput').press('Enter');
            await page.locator('[data-chip="wishlist"]').click();
            await sleep(700);
            await expect(cards).toHaveCount(0);
            await expect(page.locator('#loadingState')).toBeHidden();
            await expect(page.locator('#emptyState')).toBeVisible();
        });
        await test('Wishlist persiste al recargar y el corazón no abre el modal', async () => {
            await reset();
            await cards.first().locator('.wishlist-card-btn').click();
            await expect(page.locator('#navWishlistCount')).toHaveText('1');
            await expect(page.locator('#analyticsModal')).toBeHidden();
            await page.reload();
            await expect(page.locator('#navWishlistCount')).toHaveText('1');
            await expect(cards).toHaveCount(60);
        });
        await test('Alerta, mínimo histórico cero y conversión de divisas', async () => {
            await page.locator('#currencySelect').selectOption('USD');
            await cards.first().locator('.open-modal-trigger').first().click();
            await expect(page.locator('#modalDataContent')).toBeVisible();
            await expect(page.locator('#historicalLowBanner')).not.toContainText('MÍNIMO HISTÓRICO ALCANZADO');
            assert.equal(await page.evaluate(() => formatPrice(0, false)), '$0.00');
            await page.locator('#modalTargetPriceInput').fill('8');
            await page.evaluate(() => saveModalPriceAlert());
            await expect(page.locator('#triggeredAlertsCount')).toHaveText('1');
            await page.locator('#currencySelect').selectOption('MXN');
            await expect(page.locator('#modalTargetPriceInput')).toHaveValue('160.00');
            await page.keyboard.press('Escape');
            await expect(page.locator('#analyticsModal')).toBeHidden();
        });
        await test('El comparador se recupera de errores HTTP y descarta respuestas antiguas', async () => {
            await reset({ detailFailure: true });
            await cards.first().locator('.open-modal-trigger').first().click();
            await expect(page.locator('#modalLoading')).toContainText('No se pudo');
            mode.detailFailure = false;
            await page.keyboard.press('Escape');
            await cards.first().locator('.open-modal-trigger').first().click();
            await expect(page.locator('#modalDataContent')).toBeVisible();
            mode.slowModal = true;
            await page.evaluate(() => { void openAnalyticalModal({ gameID: '2', title: 'Segundo' }); void openAnalyticalModal({ gameID: '3', title: 'Tercero' }); });
            await sleep(600);
            await expect(page.locator('#modalGameTitle')).toHaveText('Tercero');
            assert.equal(await page.evaluate(() => activeModalDealContext.gameID), '3');
            await page.keyboard.press('Escape');
        });
        await test('Errores del catálogo ofrecen reintento y se recuperan', async () => {
            mode.catalogFailure = true;
            await page.evaluate(() => { responseCache.clear(); selectSmartChip('aaa'); });
            await expect(page.locator('#catalogError')).toBeVisible();
            await expect(page.locator('#loadingState')).toBeHidden();
            mode.catalogFailure = false;
            await page.locator('#catalogError button').click();
            await expect(cards).toHaveCount(60);
            await expect(page.locator('#catalogError')).toBeHidden();
        });
        await test('Datos externos se muestran como texto sin ejecutar HTML', async () => {
            await reset({ malicious: true });
            assert.equal(await page.evaluate(() => window.injected), undefined);
            assert.equal(await cards.first().locator('h3 img').count(), 0);
            await expect(cards.first().locator('h3')).toContainText('<img');
            assert.equal(await page.evaluate(() => safeURL('javascript:alert(1)')), '');
        });
        await test('El acceso público no expone configuración de Firebase', async () => {
            await reset();
            await page.locator('#userAccountBtn').click();
            await expect(page.locator('#authEmail')).toBeVisible();
            await expect(page.locator('#firebaseDbUrlInput')).toHaveCount(0);
            await page.keyboard.press('Escape');
        });
        await test('Juegos gratis y cambio de plataforma funcionan sin romper la navegación', async () => {
            await page.locator('[data-chip="free"]').click();
            await expect(page.locator('#gamesGrid .free-card')).toHaveCount(4);
            await expect(page.locator('[data-ecosystem]')).toHaveCount(4);
            await page.locator('[data-chip="top"]').click();
            await expect(cards).toHaveCount(60);
            await expect(cards.first().locator('a')).toHaveAttribute('href', /steampowered/);
        });
        await test('Filtros personalizados y caché de consultas', async () => {
            await reset();
            const before = calls.filter(c => c.url.includes('/deals?')).length;
            await page.evaluate(() => executeCatalogFetch(true));
            assert.equal(calls.filter(c => c.url.includes('/deals?')).length, before);
            await page.locator('#toggleFineTuneBtn').click();
            await page.locator('#drawerDiscountSlider').fill('90');
            await page.evaluate(() => applyCustomDrawerFilters());
            await expect(cards).toHaveCount(0);
            await expect(page.locator('#emptyState')).toBeVisible();
        });
        await test('Diseño móvil y escritorio sin desbordamiento horizontal', async () => {
            await reset();
            await page.setViewportSize({ width: 390, height: 844 });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(root, 'test-results', 'mobile.png'), fullPage: false });
            await page.setViewportSize({ width: 1440, height: 1000 });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(root, 'test-results', 'desktop.png'), fullPage: false });
        });
        assert.deepEqual(errors, [], 'Errores JavaScript del navegador');
        console.log(`\n${passed} pruebas aprobadas; ningún error JavaScript no controlado.`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
