const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {createServer}=require('../server.cjs');

test('Novedades de cada carga y cierre exterior del comparador conservan datos y navegación',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),origin='http://127.0.0.1:'+server.address().port;
  const errors=[],queries=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin)return route.fulfill({body:'',contentType:'text/css'});
   if(!u.pathname.startsWith('/api/'))return route.continue();
   let data={};
   if(u.pathname==='/api/stores')data=[];
   if(u.pathname==='/api/exchange-rates')data={rates:{USD:1,MXN:20}};
   if(u.pathname==='/api/deals'){
    queries.push(u.href);const offset=Number(u.searchParams.get('pageNumber')||0);
    data=offset>1?[]:Array.from({length:60},(_,i)=>({gameID:String(offset*60+i),dealID:'pc-'+(offset*60+i),title:(offset?'Nuevo':'Anterior')+' PC '+i,salePrice:String(offset?i+1:i+100),normalPrice:String((offset?i+1:i+100)*2),savings:50,storeID:'1'}));
   }
   if(u.pathname==='/api/console-catalog'){
    queries.push(u.href);const platform=u.searchParams.get('platform'),offset=JSON.parse(u.searchParams.get('cursor')||'{}').official||0;
    data={platform,region:'MX',checkedAt:1700000000000,sources:[],scope:'Prueba',next:offset?null:{official:1,external:false},items:Array.from({length:60},(_,i)=>({id:String(offset*60+i),title:(offset?'Nuevo ':'Anterior ')+platform+' '+i,price:offset?i+1:i+100,regular:(offset?i+1:i+100)*2,discount:50,currency:'MXN',edition:'Base',store:'Oficial',kind:'official',url:'https://example.com'}))};
   }
   if(u.pathname==='/api/console-comparison'){
    const offer={id:u.searchParams.get('id'),title:u.searchParams.get('title'),price:100,currency:'MXN',edition:'Base',store:'Oficial',kind:'official',url:'https://example.com'};
    data={platform:u.searchParams.get('platform'),region:'MX',checkedAt:1700000000000,offers:[offer,...Array.from({length:12},(_,i)=>({...offer,id:'ext-'+i,store:'Externa '+i,price:101+i,kind:'external'}))],editions:[],otherEditions:[],searchLinks:[],sources:[],coverage:'Prueba'};
   }
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  });
  await page.goto(origin);
  for(const platform of ['pc','xbox','ps','switch']){
   if(platform!=='pc')await page.locator('[data-ecosystem="'+platform+'"]').click();
   await expect(page.locator('#gamesGrid>.steam-card')).toHaveCount(60);
   await expect(page.locator('#catalogBatchBar')).toBeHidden();
   if(platform==='pc')await page.locator('#sortSelect').selectOption('Price');
   else await page.locator('#consoleOrder').selectOption('priceAsc');
   const before=queries.length;
   await page.locator('#loadMoreBtn').click();
   await expect(page.locator('#gamesGrid>.steam-card')).toHaveCount(120);
   await expect(page.locator('#catalogBatchBar')).toBeVisible();
   await expect(page.locator('#catalogBatchText')).toContainText('60 juegos añadidos');
   await expect(page.locator('#gamesGrid h3').first()).toContainText('Nuevo');
   const original=await page.locator('#gamesGrid>.steam-card').first().getAttribute(platform==='pc'?'data-card-id':'data-console-key');
   await page.locator('#catalogBatchShowNew').click();
   await expect(page.locator('#gamesGrid>.steam-card:visible')).toHaveCount(60);
   await expect(page.locator('#loadedCountBadge')).toHaveText('60');
   assert((await page.locator('#gamesGrid>.steam-card:visible h3').allTextContents()).every(title=>title.includes('Nuevo')));
   assert.equal(queries.length,before+1);
   await page.locator('#catalogBatchShowAll').click();
   await expect(page.locator('#gamesGrid>.steam-card:visible')).toHaveCount(120);
   assert.equal(await page.locator('#gamesGrid>.steam-card').first().getAttribute(platform==='pc'?'data-card-id':'data-console-key'),original);
   await expect(page.locator('#loadedCountBadge')).toHaveText('120');
   await page.locator('[data-ui-click="dismiss-catalog-batch"]').click();
   await expect(page.locator('#catalogBatchBar')).toBeHidden();
   assert.equal(queries.length,before+1);
   if(platform==='pc')continue;
   const scroll=await page.evaluate(()=>scrollY);
   await page.locator('.console-compare').first().click();
   const modal=page.locator('#consoleComparison');
   await expect(modal).toBeVisible();await expect(page.locator('.comparison-row')).toHaveCount(13);
   assert(await page.evaluate(()=>document.documentElement.classList.contains('console-modal-open')));
   assert.equal(await modal.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter),'none');
   await modal.hover({position:{x:80,y:300}});await page.mouse.wheel(0,600);
   await expect.poll(()=>modal.evaluate(el=>el.scrollTop)).toBeGreaterThan(200);
   assert.equal(await page.evaluate(()=>scrollY),scroll);
   const box=await modal.boundingBox();
   // Empty space inside the border is not an outside click.
   await page.mouse.click(box.x+3,box.y+box.height/2);
   await expect(modal).toBeVisible();
   // Dragging from the contents to the backdrop must not dismiss the modal.
   await page.mouse.move(box.x+30,box.y+80);await page.mouse.down();await page.mouse.move(3,3);await page.mouse.up();
   await expect(modal).toBeVisible();
   await page.mouse.click(3,box.y+box.height/2);
   await expect(modal).toBeHidden();
   assert(!await page.evaluate(()=>document.documentElement.classList.contains('console-modal-open')));
   await page.locator('.console-compare').first().click();await expect(modal).toBeVisible();
   await page.keyboard.press('Escape');await expect(modal).toBeHidden();
   assert(!await page.evaluate(()=>document.documentElement.classList.contains('console-modal-open')));
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-ecosystem="pc"]').click();
  await expect(page.locator('#gamesGrid>.steam-card')).toHaveCount(60);
  await page.locator('#loadMoreBtn').click();await expect(page.locator('#catalogBatchBar')).toBeVisible();
  await page.locator('#catalogBatchShowNew').click();
  await expect(page.locator('#gamesGrid>.steam-card:visible')).toHaveCount(60);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'test-results/new-batch-mobile.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
