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
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(()=>{selectSmartChip('all')});
        await expect(page.locator('#loadingText')).toContainText('Cargando juegos');
        await expect(page.locator('#loadingText')).not.toContainText('lote');
        assert.deepEqual(errors,[]);
    } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
});
