const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium, expect} = require('@playwright/test');
const {createServer} = require('../server.cjs');

test('Preferencias alineadas, lista legible, carga visible y tarjetas reutilizadas', async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome', headless:true});
    try {
        const page = await browser.newPage({viewport:{width:1366,height:900}});
        const root = 'http://127.0.0.1:' + server.address().port;
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        let releasePage;
        let pcRequests = 0;
        let heldPage;
        let regionalRequests = 0;
        let heldRegional, releaseRegional;
        const editorialQuotes = {
            xbox: {id:'9NKX70BBCDRN', store:'Xbox Store', price:639.60, regular:1599, discount:59.99, currency:'MXN'},
            ps: {id:'UP9000-PPSA21564_00-0000000000000000', store:'PlayStation Store', price:999, regular:999, discount:0, currency:'MXN'},
            switch: {id:'7100077279', store:'Nintendo eShop', price:7, regular:10, discount:30, currency:'USD'}
        };
        await page.route('**/*', async route => {
            const u = new URL(route.request().url());
            if(u.origin !== root)return route.fulfill({body:'',contentType:'text/css'});
            if(!u.pathname.startsWith('/api/'))return route.continue();
            let data = {};
            if(u.pathname === '/api/stores')data = [{storeID:'1',storeName:'Steam'}];
            if(u.pathname === '/api/exchange-rates')data = {rates:{USD:1,MXN:20}};
            if(u.pathname === '/api/steam-prices'){
                regionalRequests++;
                if(heldRegional)await heldRegional;
                data={'31415':{success:true,data:{price_overview:{currency:'MXN',final:1000,initial:2000,discount_percent:50}}}};
                if (u.searchParams.get('appids') === '206190') {
                    assert.equal(u.searchParams.get('region'), 'MX');
                    data = {
                        206190: {success:true, data:{price_overview:{currency:'MXN', final:2199, initial:10995, discount_percent:80}}}
                    };
                }
            }
            if(u.pathname === '/api/deals'){
                pcRequests++;
                const offset = Number(u.searchParams.get('pageNumber')) || 0;
                if(offset && heldPage)await heldPage;
                data = Array.from({length:offset?1:60},(_,i)=>({gameID:String(offset*60+i+1),dealID:'deal-'+(offset*60+i+1),title:'Juego '+(offset*60+i+1),salePrice:'10',normalPrice:'20',savings:'50',storeID:'1'}));
            }
            if(u.pathname === '/api/console-catalog'){
                const offset=JSON.parse(u.searchParams.get('cursor')||'{}').official||0;
                if(offset && heldPage)await heldPage;
                data={platform:u.searchParams.get('platform'),region:'MX',checkedAt:Date.now(),sources:[],scope:'Prueba',next:offset?null:{official:1,external:false},items:Array.from({length:60},(_,i)=>({id:String(offset*60+i),title:'Consola '+(offset*60+i),price:100,regular:200,discount:50,currency:'MXN',edition:'Base',store:'Tienda oficial',kind:'official',url:'https://example.com/'}))};
                if (Object.hasOwn(editorialQuotes, data.platform) && u.searchParams.get('q')) {
                    assert.equal(u.searchParams.get('region'), 'MX');
                    assert.equal(u.searchParams.get('source'), 'official');
                    const quote = {...editorialQuotes[data.platform], kind:'official'};
                    data.items = [{...quote, id:'other-edition', currency:'MXN', price:1}, quote];
                }
            }
            await route.fulfill({contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
        });
        await page.goto(root);
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
        assert(!/fase\s*\d/i.test(await page.locator('body').innerText()));
        const alignment = await page.evaluate(() => ['wishlistButton','userAccountBtn','regionSelect','currencySelect'].map(id=>{
            const el=document.getElementById(id),rect=(el.tagName==='SELECT'?el.parentElement:el).getBoundingClientRect();return rect.y+rect.height/2;
        }));
        assert(Math.max(...alignment)-Math.min(...alignment)<2);
        await page.locator('#currencySelect').selectOption('EUR');
        await expect(page.locator('#currencyFlag')).toHaveAttribute('src','assets/flags/EU.svg');
        await expect(page.locator('#currencyFlag')).toHaveJSProperty('naturalWidth',60);
        await page.locator('#regionSelect').selectOption('US');
        await expect(page.locator('#regionFlag')).toHaveAttribute('src','assets/flags/US.svg');
        await expect(page.locator('#currencyFlag')).toHaveAttribute('src','assets/flags/US.svg');
        await page.locator('#regionSelect').selectOption('MX');
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
        // Sorting an already ordered list must leave every node in place.
        const moves = await page.evaluate(async()=>{
            let count=0;const observer=new MutationObserver(records=>{count+=records.length});
            observer.observe(gamesGrid,{childList:true});renderSortedPCCatalog();await Promise.resolve();observer.disconnect();return count;
        });
        assert.equal(moves,0);
        heldRegional = new Promise(resolve=>{releaseRegional=resolve});
        await page.evaluate(()=>{regionalPrices.clear();responseCache.clear();window.quoteA=steamRegionalPrice('31415')});
        await expect.poll(()=>regionalRequests).toBe(1);
        assert(await page.evaluate(()=>{window.quoteB=steamRegionalPrice('31415');return window.quoteA===window.quoteB}));
        releaseRegional();heldRegional=null;
        const quotes=await page.evaluate(()=>Promise.all([window.quoteA,window.quoteB]));
        assert(quotes.every(quote=>quote.amount===10&&quote.currency==='MXN'));
        assert.equal(regionalRequests,1);
        await page.evaluate(()=>{userWishlist=normalizeWishlist({'1':{title:'Aventura <sin HTML>',gameID:'1',salePrice:'10',targetPriceUsd:'8',dealID:'deal-1'}});persistWishlistState({sync:false});openWishlistDrawer()});
        const downloadPromise = page.waitForEvent('download');
        await page.locator('[data-ui-click="download-wishlist-list"]').click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(),'mis-favoritos-radarplay.txt');
        const text = await fs.readFile(await download.path(),'utf8');
        assert(text.includes('Aventura <sin HTML>') && text.includes('Mi meta:') && text.includes('MXN'));
        assert(!text.includes('targetPriceUsd') && !text.includes('"items"'));
        await page.keyboard.press('Escape');
        await page.evaluate(()=>window.firstCard=gamesGrid.firstElementChild);
        heldPage = new Promise(resolve=>{releasePage=resolve});
        await page.locator('#loadMoreBtn').scrollIntoViewIfNeeded();
        const before=pcRequests;
        await page.locator('#loadMoreBtn').click();
        await expect(page.locator('#loadMoreBtn')).toBeVisible();
        await expect(page.locator('#loadMoreBtn')).toBeDisabled();
        await expect(page.locator('#loadMoreBtn')).toHaveAttribute('aria-busy','true');
        await expect(page.locator('#loadMoreBtn')).toContainText('Cargando… Espera un momento.');
        await expect(page.locator('#loadingState')).toBeHidden();
        await expect(page.locator('#loadMoreBtn svg')).toHaveCount(1,{timeout:4000});
        await page.screenshot({path:'test-results/load-more-pc.png'});
        releasePage();heldPage=null;
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(61);
        await expect(page.locator('#catalogEndStatus')).toBeVisible();
        assert.equal(pcRequests,before+1);
        assert(await page.evaluate(()=>window.firstCard===gamesGrid.firstElementChild));
        await page.locator('[data-ecosystem="xbox"]').click();
        await expect(page.locator('.console-card')).toHaveCount(60);
        await page.evaluate(()=>window.consoleFirst=gamesGrid.firstElementChild);
        heldPage=new Promise(resolve=>{releasePage=resolve});
        await page.locator('#loadMoreBtn').click();
        await expect(page.locator('#loadMoreBtn')).toBeDisabled();
        await expect(page.locator('#loadMoreBtn .fa-xbox')).toHaveCount(1);
        releasePage();heldPage=null;
        await expect(page.locator('.console-card')).toHaveCount(120);
        assert(await page.evaluate(()=>window.consoleFirst===gamesGrid.firstElementChild));
        await page.locator('[data-ecosystem="pc"]').click();
        await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:'test-results/header-refined-desktop.png'});
        for(const width of [1200,1024,768,390,320]){
            await page.setViewportSize({width,height:844});
            if(width<768)await page.locator('#mobileFilterPanel').evaluate(el=>{el.open=true});
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow at '+width);
        }
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:'test-results/header-refined-mobile.png'});
        await expect(page.locator('#mobileFilterContent #pcStoreSelect')).toBeVisible();
        await expect(page.locator('#mobileFilterContent #sortSelect')).toBeVisible();
        await page.locator('#closeMobileFilters').click();
        await expect(page.locator('#pcStoreSelect')).toBeHidden();
        await expect(page.locator('#mobileExchangeRate')).toHaveText(await page.locator('#exchangeRateBadge').textContent());
        await page.evaluate(() => scrollTo(0, 0));
        const firstMobileCard = await page.locator('#gamesGrid .steam-card').first().boundingBox();
        assert(firstMobileCard && firstMobileCard.y < 430, 'El catálogo debe empezar en la primera pantalla móvil');
        await page.screenshot({path:'test-results/catalog-mobile-closed.png'});
        await page.locator('[data-ecosystem="xbox"]').click();
        await expect(page.locator('#consoleTools')).toBeHidden();
        await page.locator('#mobileFilterPanel > summary').click();
        await expect(page.locator('#mobileFilterContent #consoleSource')).toBeVisible();
        await expect(page.locator('#pcStoreSelect')).toBeHidden();
        await page.setViewportSize({width:1366,height:900});
        await expect(page.locator('main #consoleSource')).toBeVisible();
        await page.locator('[data-ecosystem="pc"]').click();
        await expect(page.locator('#pcStoreSelect')).toBeVisible();
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(()=>{selectSmartChip('all')});
        await expect(page.locator('#loadingText')).toContainText('Cargando juegos');
        await expect(page.locator('#loadingText')).not.toContainText('lote');
        assert.deepEqual(errors,[]);
        assert.match(await page.evaluate(() => consolePriceDecision({store:'Nintendo eShop', currency:'MXN', price:249, history:{min:199, days:3}}, 'México')), /por encima de ese mínimo/);
        assert.match(await page.evaluate(() => consolePriceDecision({store:'Nintendo eShop', currency:'MXN', price:249, history:{min:199, days:2}}, 'México')), /Historial insuficiente/);
        await page.setViewportSize({width:390,height:844});
        await page.clock.setFixedTime(new Date('2026-11-16T05:59:59Z'));
        const discovery = page.getByRole('navigation', {name:'Descubre juegos'});
        await expect(discovery.getByRole('link')).toHaveCount(2);
        await expect(page.locator('.mobile-catalog-info a')).toHaveCount(0);
        assert.equal(await discovery.evaluate(nav => getComputedStyle(nav).gridTemplateColumns.split(' ').length), 2);
        await discovery.getByRole('link', {name:/Radar de México/}).click();
        await expect(page.getByRole('heading', {name:'Radar de México'})).toBeVisible();
        await expect(page.locator('.pick-platform strong')).toHaveText(['PC', 'Xbox', 'PlayStation', 'Nintendo Switch']);
        await expect(page.locator('[data-platform="pc"] .pick-price')).toContainText('−80%');
        await expect(page.locator('[data-platform="xbox"] .pick-price')).toContainText('$639.60 MXN');
        await expect(page.locator('[data-platform="xbox"] .pick-price')).toContainText('−60%');
        await expect(page.locator('[data-platform="ps"] .pick-price')).toContainText('Precio regular');
        await expect(page.locator('[data-platform="switch"] .pick-price')).toHaveText('Consulta el precio en la tienda');
        await expect(page.getByRole('status')).toContainText('precios que pudimos comprobar');
        await expect(page.locator('#edition-date')).toContainText('15 de noviembre');
        await expect(page.locator('.edition-history')).toBeVisible();
        await expect(page.locator('#edition-history-empty')).toContainText('Todavía no hay');
        assert.equal(await page.locator('.edition-pick').first().evaluate(card => getComputedStyle(card, '::after').animationName), 'none');

        await page.clock.setFixedTime(new Date('2026-11-16T06:00:00Z'));
        await page.reload();
        await expect(page.locator('.edition-pick h2')).toHaveText(['Portal 2', 'Rocket League®', 'God of War Ragnarök', 'Mario Kart™ 8 Deluxe']);
        await expect(page.locator('.pick-reason').first()).toContainText('los niveles cooperativos');
        await expect(page.locator('#edition-date')).toContainText('16 de noviembre');
        await expect(page.locator('#edition-history-empty')).toBeVisible();
        await expect(page.locator('.edition-history details')).toHaveCount(0);

        await page.clock.setFixedTime(new Date('2026-11-22T06:00:00Z'));
        await page.reload();
        await expect(page.locator('.edition-history details')).toHaveCount(6);
        await expect(page.locator('.edition-pick h2').first()).toHaveText('Gunpoint');
        await expect(page.locator('.edition-history summary').last()).toContainText('16 de noviembre');
        await page.locator('.edition-history summary').last().click();
        await expect(page.locator('.edition-history').getByRole('link', {name:'Portal 2'})).toBeVisible();
        await page.emulateMedia({reducedMotion:'no-preference'});
        assert.equal(await page.locator('.edition-pick').first().evaluate(card => getComputedStyle(card, '::after').animationIterationCount), 'infinite');
        await page.getByRole('button', {name:'Pausar animación de los bordes'}).click();
        assert.equal(await page.locator('.edition-pick').first().evaluate(card => getComputedStyle(card, '::after').animationPlayState), 'paused');

        await page.clock.setFixedTime(new Date('2026-11-23T06:00:00Z'));
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await expect(page.locator('.edition-pick h2').first()).toHaveText('Hades');
        await expect(page.locator('.edition-history details')).toHaveCount(0);
        await expect(page.locator('#edition-history-empty')).toBeVisible();
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

        await page.route('**/api/console-catalog?*', async route => {
            const params = new URL(route.request().url()).searchParams;
            const platform = params.get('platform');
            const choices = {
                xbox: {id:'C125W9BG2K0V',store:'Xbox Store',currency:'MXN',price:350},
                ps: {id:'UP0006-PPSA04873_00-APEXLEGENDRSPWN1',store:'PlayStation Store',currency:'MXN',price:0},
                switch: {id:'7100001801',store:'Nintendo eShop',currency:'USD',price:50}
            };
            await route.fulfill({json:{platform,region:'MX',items:[{...choices[platform],kind:'official'}]}});
        });
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'share', {value:undefined});
            Object.defineProperty(navigator, 'clipboard', {value:{writeText:async () => {throw new Error('Clipboard unavailable');}}});
        });
        await page.goto(root);
        await discovery.getByRole('link', {name:/Colección de juegos/}).click();
        await expect(page.getByRole('heading', {name:'Juegos hasta $300 MXN'})).toBeVisible();
        await expect(page.locator('.discover-card')).toHaveCount(4);
        await expect(page.locator('.discover-quote[data-platform="pc"]')).toContainText('Dentro del presupuesto');
        await expect(page.locator('.discover-quote[data-platform="xbox"]')).toContainText('Supera el presupuesto');
        await expect(page.locator('.discover-quote[data-platform="ps"]')).toContainText('Gratis');
        await expect(page.locator('.discover-quote[data-platform="switch"]')).toContainText('Presupuesto por confirmar');
        await page.getByRole('link', {name:'Ver ficha de Stardew Valley'}).click();
        await expect(page.getByRole('heading', {name:'Stardew Valley'})).toBeVisible();
        await page.getByRole('button', {name:'Copiar enlace'}).click();
        await expect(page.getByRole('textbox', {name:'Enlace público de la ficha'})).toHaveValue('https://salesplataforms.onrender.com/descubre/stardew-valley');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
    } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
});
