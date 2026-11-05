const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium,expect} = require('@playwright/test');
const {createServer} = require('../server.cjs');
const {playstationData} = require('../console-sources.cjs');

test('PlayStation prioriza portadas y conserva respaldos del mismo producto', () => {
    const product={id:'edition',name:'Juego Deluxe',platforms:['PS5'],price:{discountedPrice:'100 MXN',basePrice:'200 MXN'},media:[
        {type:'IMAGE',role:'BACKGROUND_ART',url:'https://artwork.example/background.jpg'},
        {type:'VIDEO',role:'MASTER',url:'https://artwork.example/movie.mp4'},
        {type:'image',role:'MASTER',url:'https://artwork.example/cover.jpg'},
        {type:'IMAGE',role:'MASTER',url:'javascript:alert(1)'},
        {type:'IMAGE',role:'GAMEHUB_COVER_ART',url:'https://artwork.example/backup.jpg'},
        {type:'IMAGE',role:'MASTER',url:'https://artwork.example/cover.jpg'}
    ]};
    const parse=p=>playstationData({data:{categoryStrandRetrieve:{products:[p]}}},'MX')[0];
    const game=parse(product);
    assert.equal(game.image,'https://artwork.example/cover.jpg');
    assert.deepEqual(game.imageAlternatives,['https://artwork.example/backup.jpg','https://artwork.example/background.jpg']);
    assert.equal(game.price,100);assert.equal(game.id,'edition');
    assert.equal(parse({...product,media:{}}).image,'');
    assert.equal(parse({...product,media:null,image:'https://artwork.example/direct.jpg'}).image,'https://artwork.example/direct.jpg');
});

test('Las tres consolas ordenan sin peticiones y conservan cursor, precios, tarjetas y portadas', async () => {
    const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1000}});
        const origin='http://127.0.0.1:'+server.address().port;
        const requests=[],imageRequests=[],errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        let releaseNext,holdNext;
        await page.route('**/*',async route=>{
            const url=new URL(route.request().url());
            if(url.hostname==='artwork.example'){
                imageRequests.push(url.pathname);
                if(url.pathname.endsWith('/broken.jpg'))return route.fulfill({status:404,body:''});
                return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#174473"/><text x="30" y="100" fill="white">Portada alternativa</text></svg>'});
            }
            if(url.origin!==origin)return route.fulfill({body:'',contentType:'text/css'});
            if(!url.pathname.startsWith('/api/'))return route.continue();
            let data={};
            if(['/api/deals','/api/stores'].includes(url.pathname))data=[];
            if(url.pathname==='/api/console-catalog'){
                const platform=url.searchParams.get('platform'),q=url.searchParams.get('q');
                const offset=JSON.parse(url.searchParams.get('cursor')||'{}').official||0;
                requests.push({platform,sort:url.searchParams.get('sort'),offset,q});
                if(offset&&holdNext)await holdNext;
                data={platform,region:'MX',checkedAt:1700000000000,sources:[],scope:'Prueba',next:offset?null:{official:1,external:false},items:Array.from({length:60},(_,i)=>{
                    const n=offset*60+i+1;
                    return {id:String(n),title:(q||platform)+' juego '+n,price:n,regular:n*2,discount:50,currency:'MXN',store:i%2?'Eneba':'Oficial',kind:i%2?'external':'official',edition:platform,url:'https://example.com',rating:i%5,ratingCount:100,
                        image:i===2?'':i===0?'https://artwork.example/broken.jpg':'https://artwork.example/cover.jpg',imageAlternatives:i===0?['https://artwork.example/backup.jpg']:[]};
                })};
            }
            await route.fulfill({contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
        });
        await page.goto(origin);
        for(const platform of ['xbox','ps','switch']){
            await page.locator('[data-ecosystem="'+platform+'"]').click();
            await expect(page.locator('.console-card')).toHaveCount(60);
            await page.locator('.console-art-cover').first().scrollIntoViewIfNeeded();
            await expect(page.locator('.console-art-cover').first()).toHaveAttribute('src','https://artwork.example/backup.jpg');
            await expect(page.locator('.console-art-cover').nth(2)).toHaveAttribute('data-image-state','placeholder');
            await expect(page.locator('.console-art-backdrop').nth(2)).toBeHidden();
            await page.evaluate(()=>{window.originalCard=gamesGrid.firstElementChild;window.originalImage=gamesGrid.firstElementChild.querySelector('.console-art-cover')});
            const count=requests.length;
            const initialSort=requests.at(-1).sort;
            for(const order of ['priceDesc','priceAsc','discountDesc','discountAsc','relevance']){
                await page.locator('#consoleOrder').selectOption(order);
                await expect(page.locator('.console-card')).toHaveCount(60);
                if(order==='priceDesc')await expect(page.locator('.console-price strong').first()).toContainText('60.00');
                if(order==='priceAsc')await expect(page.locator('.console-price strong').first()).toContainText('1.00');
                assert.equal(requests.length,count);
            }
            assert(await page.evaluate(()=>window.originalCard===gamesGrid.firstElementChild&&window.originalImage===gamesGrid.firstElementChild.querySelector('.console-art-cover')));
            if(platform==='xbox'){
                await page.locator('#consoleOrder').selectOption('rating');
                await expect(page.locator('.console-rating-badge').first()).toContainText('4/5');
                assert.equal(requests.length,count);
            }
            await page.locator('#consoleOrder').selectOption('priceDesc');
            holdNext=new Promise(resolve=>{releaseNext=resolve});
            await page.locator('#loadMoreBtn').click();
            await expect(page.locator('#loadMoreBtn')).toBeDisabled();
            // Changing the order during pagination must not abort or start a query.
            await page.locator('#consoleOrder').selectOption('priceAsc');
            releaseNext();holdNext=null;
            await expect(page.locator('.console-card')).toHaveCount(120);
            assert.equal(requests.length,count+1);
            assert.equal(requests.at(-1).offset,1);
            assert.equal(requests.at(-1).sort,initialSort);
            await expect(page.locator('.console-price strong').first()).toContainText('1.00');
            await page.locator('#consoleOrder').selectOption('priceDesc');
            await expect(page.locator('.console-price strong').first()).toContainText('120.00');
            await page.locator('#consoleOrder').selectOption('relevance');
            assert(await page.evaluate(()=>window.originalCard===gamesGrid.firstElementChild));
            assert.equal(requests.length,count+1);
        }
        const before=requests.length;
        await page.locator('#predictiveSearchInput').fill('Nueva búsqueda');
        await page.locator('#predictiveSearchInput').press('Enter');
        await expect(page.locator('.console-card h3').first()).toContainText('Nueva búsqueda');
        assert(requests.length>before);
        assert(imageRequests.includes('/broken.jpg')&&imageRequests.includes('/backup.jpg'));
        assert.deepEqual(errors,[]);
        await page.screenshot({path:'test-results/console-sort-images.png'});
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
