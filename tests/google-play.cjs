const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, expect} = require('@playwright/test');
const {createGooglePlay, playQuote} = require('../google-play.cjs');
const {createServer} = require('../server.cjs');

const monument = 'com.ustwo.monumentvalley';
const vlc = 'org.videolan.vlc';
function ficha(id, title, price, currency = 'MXN') {
    const offers = { '@type':'Offer', price, priceCurrency:currency, availability:'https://schema.org/InStock' };
    return `<link rel="canonical" href="https://play.google.com/store/apps/details?id=${id}&amp;hl=es">` +
        `<script type="application/ld+json">${JSON.stringify({name:title, offers})}</script>`;
}

test('Google Play valida paquete y moneda, comparte consultas y publica solo rebajas observadas', async () => {
    const game = {id:monument,type:'game'};
    const html = ficha(monument,'Monument Valley','69.00');
    assert.equal(playQuote(html,game,'MX').price,69);
    assert.equal(playQuote(html,game,'US'),null);
    assert.equal(playQuote(html,{...game,id:vlc},'MX'),null);
    assert.equal(playQuote(ficha(vlc,'VLC for Android','0'),{id:vlc,type:'app'},'MX').price,0);
    assert.equal(playQuote(ficha(monument,'Monument Valley',''),game,'MX'),null);
    let calls = 0, now = Date.now(), price = 69;
    const initial = now;
    const play = createGooglePlay(async () => {
        calls++;
        return new Response(ficha(monument,'Monument Valley',String(price)));
    }, {now:()=>now, record:async (_scope,quotes)=>quotes.map(quote=>({...quote,
        history:{drop: price < 69 ? {from:69,previousAt:initial,at:now} : null}}))});
    const options = {source:'official',cursor:{},onlyDeals:true,sort:'relevance'};
    const [catalog, comparison] = await Promise.all([play.catalog('MX','Monument',options),play.compare('MX',monument)]);
    assert.equal(catalog.items.length,0);
    assert.equal(comparison.offers[0].price,69);
    assert.equal(calls,1);
    price = 49;
    now += 16*60*1000;
    const result = await play.catalog('MX','Monument',options);
    assert.equal(result.items[0].regular,69);
    assert.equal(Math.round(result.items[0].discount),29);
    assert.equal(calls,2);
    assert.equal((await play.compare('MX','untracked.app')).offers.length,0);
    assert.equal(calls,2);
    now += 86400000;
    assert.equal((await play.catalog('MX','Monument',options)).items.length,0);
});

test('Android móvil muestra sugerencias, filtra sin recargar y conserva la meta de precio', async () => {
    const server = createServer();
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const root = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
    try {
        const page = await browser.newPage({viewport:{width:390,height:844}});
        const errors = [];
        page.on('pageerror',error=>errors.push(error.message));
        const ids = [{id:monument,title:'Monument Valley',price:69,appType:'game'}, {id:vlc,title:'VLC for Android',price:0,appType:'app'}];
        const items = ids.map(item=>({...item,kind:'official',store:'Google Play',currency:'MXN',regular:item.price,discount:0,
            edition:item.appType === 'game' ? 'Juego para Android' : 'Aplicación para Android',
            url:'https://play.google.com/store/apps/details?id=' + item.id}));
        let calls = 0;
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== root) return route.fulfill({body:''});
            if (!url.pathname.startsWith('/api/')) return route.continue();
            let json = {};
            if (url.pathname === '/api/deals' || url.pathname === '/api/stores') json = [];
            if (url.pathname === '/api/console-catalog') {
                calls++;
                const q = (url.searchParams.get('q') || '').toLowerCase();
                json = {platform:'android',region:'MX',items:items.filter(item=>item.title.toLowerCase().includes(q)),next:null,
                    sources:[],checkedAt:Date.now(),scope:'Selección de Google Play'};
            }
            if (url.pathname === '/api/console-comparison') json = {platform:'android',region:'MX',offers:[items[0]],coverage:'Precio de descarga',checkedAt:Date.now()};
            return route.fulfill({json});
        });
        await page.goto(root);
        await page.getByRole('button',{name:'Android',exact:true}).click();
        await expect(page.locator('#gamesGrid .console-card')).toHaveCount(2);
        await expect(page.locator('#gamesGrid')).toContainText('Gratis');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.locator('#mobileFilterPanel > summary').click();
        const before = calls;
        await page.locator('#androidType').selectOption('app');
        await expect(page.locator('#gamesGrid h3')).toHaveText(['VLC for Android']);
        assert.equal(calls,before);
        await page.locator('#androidType').selectOption('all');
        await page.locator('#closeMobileFilters').click();
        const input = page.locator('#predictiveSearchInput');
        await input.fill('Monument');
        await expect(page.locator('#searchDropdownContent')).toContainText('Monument Valley');
        await page.locator('#searchDropdownContent .suggestion-all').click();
        await expect(page.locator('#gamesGrid h3')).toHaveText(['Monument Valley']);
        await page.getByRole('button',{name:'Comparar opciones'}).click();
        await expect(page.locator('#consoleComparison')).toContainText('Precio de descarga');
        await page.locator('#consoleTarget').fill('50');
        await page.getByRole('button',{name:'Guardar meta'}).click();
        await page.keyboard.press('Escape');
        await page.locator('#wishlistButton').click();
        await expect(page.locator('#wishlistItemsContainer')).toContainText('Monument Valley');
        await expect(page.locator('#wishlistItemsContainer')).toContainText(/50[.,]00/);
        await page.keyboard.press('Escape');
        await input.fill('Aplicación fuera de la selección');
        await page.locator('#searchDropdownContent .suggestion-all').click();
        await expect(page.locator('#androidEmptyState')).toBeVisible();
        await expect(page.locator('#androidEmptyStore')).toHaveAttribute('href',/play\.google\.com\/store\/search\?.*gl=MX/);
        for (const width of [320, 1366]) {
            await page.setViewportSize({width,height:844});
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        }
        assert.deepEqual(errors,[]);
    } finally {
        await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
});
