const {test}=require('node:test');
const assert=require('node:assert/strict');
const {discountPosition}=require('../discount-position.cjs');
const {createServer}=require('../server.cjs');
const {chromium,expect}=require('@playwright/test');
async function locate(params,fetcher){const state={};for(let i=0;i<10;i++){const result=await discountPosition(params,fetcher,state);if(!result.pending)return result;}throw Error('No terminó');}


test('Localiza el tramo de descuento sin omitir el límite entre páginas',async()=>{
 let calls=0;
 const position=await locate(new URLSearchParams({discount:'20',onSale:'1'}),async url=>{
  const u=new URL(url),p=Number(u.searchParams.get('pageNumber'));calls++;
  assert.equal(u.searchParams.get('desc'),'0');assert.equal(u.searchParams.get('onSale'),'1');
  const savings=p<800?90:p===800?20:10;
  return Response.json(Array.from({length:60},()=>({savings})),{headers:{'X-Total-Page-Count':'50'}});
 });
 assert.equal(position.page,799);assert(calls<20);
});

test('El servidor valida y reutiliza la localización del porcentaje',async()=>{
 let calls=0;
 const server=createServer({fetchImpl:async url=>{
  calls++;assert.equal(new URL(url).searchParams.get('title'),'Mina');
  return Response.json([{savings:20}],{headers:{'X-Total-Page-Count':'1'}});
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  for(let i=0;i<2;i++)assert.deepEqual(await (await fetch(base+'/api/deals-position?discount=20&title=Mina')).json(),{page:0});
  assert.equal(calls,1);
  for(const query of ['discount=101','discount=-1','discount=20&url=https://example.com'])assert.equal((await fetch(base+'/api/deals-position?'+query)).status,400);
 }finally{await new Promise(r=>server.close(r));}
});

test('La localización ascendente conserva porcentajes redondeados y el borde inicial',async()=>{
 const position=await locate(new URLSearchParams({discount:'20',desc:'1'}),async url=>{
  const u=new URL(url),p=Number(u.searchParams.get('pageNumber'));
  assert.equal(u.searchParams.get('desc'),'1');
  return Response.json([{savings:p<8?'19.4':'19.6'}],{headers:{'X-Total-Page-Count':'50'}});
 });
 assert.equal(position.page,7);
});

test('Encuentra porcentajes en páginas posteriores, añade 60 y guarda metas de consola por región',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],pcQueries=[],consoleQueries=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const u=new URL(route.request().url());let data={};
   if(u.pathname==='/api/stores')data=[];
   if(u.pathname==='/api/deals-position')data={page:0};
   if(u.pathname==='/api/deals'){
    pcQueries.push(u.searchParams);const p=Number(u.searchParams.get('pageNumber'));
    data=Array.from({length:p===3?1:60},(_,i)=>({gameID:`${p*60+i}`,dealID:`deal-${p*60+i}`,title:p===2?'Coincidencia '+i:'Otro '+i,savings:p>=2?20:10,storeID:'25',salePrice:'8',normalPrice:'10'}));
   }
   const platform=u.searchParams.get('platform')||'xbox',region=u.searchParams.get('region')||'MX';
   const item={id:'1',title:'Juego de consola',price:80,regular:100,discount:20,currency:'MXN',kind:'official',store:'Tienda oficial',url:'https://www.xbox.com',edition:platform};
   if(u.pathname==='/api/console-catalog'){
    const cursor=JSON.parse(u.searchParams.get('cursor')||'{}'),p=cursor.official||0;consoleQueries.push(p);
    data={platform,region,checkedAt:Date.now(),scope:'Prueba',sources:[],next:p<5?{official:p+1,external:false}:null,items:[{...item,id:String(p),discount:p===5?20:90,price:p===5?80:10}]};
   }
   if(u.pathname==='/api/console-comparison')data={platform,region,checkedAt:Date.now(),coverage:'Prueba',sources:[],searchLinks:[],otherEditions:[],offers:[{...item,id:u.searchParams.get('id')}]};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{document.getElementById('drawerDiscountMode').value='exact';document.getElementById('drawerDiscountSlider').value='20';applyCustomDrawerFilters();});
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(60);
  await expect(page.locator('#gamesGrid h3').first()).toHaveText('Coincidencia 0');
  assert(pcQueries.some(p=>p.get('storeID')==='1'));
  assert(pcQueries.filter(p=>p.has('storeID')).every(p=>p.get('storeID')==='1'));
  await page.locator('#loadMoreBtn').click();
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(61);
  for(const platform of ['xbox','ps','switch']){
   await page.locator(`[data-ecosystem="${platform}"]`).click();
   await expect(page.locator('html')).toHaveAttribute('data-platform',platform);
   await page.evaluate(()=>{document.getElementById('consoleDiscountMode').value='exact';document.getElementById('consoleDiscountValue').value='20';applyConsoleDiscount();});
   await expect(page.locator('.console-card')).toHaveCount(1);
   assert(consoleQueries.includes(5));
   await page.locator('.console-card-heart').click();
   await expect(page.locator('#consoleComparison')).not.toBeVisible();
   await expect(page.locator('.console-card-heart')).toHaveAttribute('aria-pressed','true');
   await page.locator('.console-compare').click();
   await expect(page.locator('#consoleComparison')).toHaveAttribute('data-platform',platform);
   await page.locator('#consoleTarget').fill('60');
   await page.locator('.console-target-row button').click();
   await expect(page.locator('#consoleAlertFeedback')).toContainText('60.00 MXN');
   assert(await page.locator('#consoleComparison').evaluate(el=>el.scrollWidth<=el.clientWidth));
   await page.screenshot({path:`test-results/${platform}-detail-mobile.png`});
   await page.keyboard.press('Escape');
  }
  await page.locator('#wishlistButton').click();
  await expect(page.locator('.native-wish-card')).toHaveCount(3);
  await expect(page.locator('#wishlistItemsContainer')).toContainText('60.00 MXN');
  const saved=await page.evaluate(()=>Object.values(userWishlist));
  assert(saved.every(q=>q.native&&q.region==='MX'&&q.targetPrice===60&&!q.targetPriceUsd));
  await page.reload();await page.locator('#wishlistButton').click();
  await expect(page.locator('.native-wish-card')).toHaveCount(3);
  await page.evaluate(()=>closeWishlistDrawer());
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-ecosystem="xbox"]').click();
  await page.locator('.console-compare').first().click();
  await expect(page.locator('#consoleTarget')).toBeVisible();
  await page.screenshot({path:'test-results/xbox-detail-desktop.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
