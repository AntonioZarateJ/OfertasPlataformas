const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { createServer } = require('../server.cjs');
const { xboxData, nintendoData, playstationData, enebaData } = require('../console-sources.cjs');
test('Las fuentes rechazan productos de otra región, PC y suscripciones', () => {
 const p = { availableOn:['XboxOne'],productKind:'Game',productId:'1',title:'Xbox',specificPrices:{purchaseable:[{currency:'MXN',listPrice:10,msrp:100,discountPercentage:90,eligibilityInfo:{eligibility:'None'}}]} };
 assert.equal(xboxData({core2:{products:{productSummaries:{p}}}},'MX')[0].price,10);
 assert.equal(xboxData({core2:{products:{productSummaries:{p:{...p,availableOn:['PC']}}}}},'MX').length,0);
 assert.equal(xboxData({core2:{products:{productSummaries:{p}}}},'US').length,0);
 const n={name:'Switch',urlKey:'switch',platform:'Nintendo Switch',prices:{currency:'MXN',finalPrice:100,regularPrice:200,percentOff:50}};
 assert.equal(nintendoData({a:n,b:n},'MX').length,1);
 const ps={name:'PS',id:'1',price:{discountedPrice:'86.12 MXN',basePrice:'861.21 MXN',discountText:'-90 %'},platforms:['PS5']};
 assert.equal(playstationData({data:{categoryStrandRetrieve:{products:[ps]}}},'MX')[0].price,86.12);
 assert.equal(playstationData({data:{categoryStrandRetrieve:{products:[{...ps,price:{...ps.price,isTiedToSubscription:true}}]}}},'MX').length,0);
 assert.equal(enebaData({p:{__typename:'Product',type:{value:'GAME'},drm:{name:'Steam'}}},'xbox','MX').length,0);
});
test('Cambiar consola reemplaza el catálogo; filtros y región usan datos propios', async () => {
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==='/api/deals')data=[{gameID:'1',title:'Juego exclusivo PC',salePrice:'1',normalPrice:'10',storeID:'1'}];
  if(u.pathname==='/api/stores')data=[];
  if(u.pathname==='/api/console-catalog'){
   const platform=u.searchParams.get('platform'),region=u.searchParams.get('region');
   if(platform==='xbox')await new Promise(r=>setTimeout(r,150));
   data={platform,region,currency:region==='MX'?'MXN':'USD',checkedAt:Date.now(),scope:'Selección de prueba',sources:[{name:'Oficial',status:'ok',count:1,url:'https://example.com'}],items:[{id:'1',title:platform+' edición consola',price:10,regular:100,discount:90,currency:region==='MX'?'MXN':'USD',edition:platform,store:'Oficial',kind:'official',url:'https://example.com'},{id:'2',title:platform+' key',price:12,regular:null,discount:0,currency:'MXN',edition:platform,store:'Eneba',kind:'external',url:'https://example.com'}]};
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await expect(page.locator('#gamesGrid')).toContainText('Juego exclusivo PC');
 await page.locator('[data-ecosystem="xbox"]').click();
 await page.locator('[data-ecosystem="ps"]').click();
 await expect(page.locator('#gamesGrid')).toContainText('ps edición consola');
 await new Promise(r=>setTimeout(r,250));
 await expect(page.locator('#gamesGrid')).not.toContainText('xbox');
 await expect(page.locator('#gamesGrid')).not.toContainText('exclusivo PC');
 await page.locator('#consoleSource').selectOption('external');
 await expect(page.locator('.console-card')).toHaveCount(0);
 await page.locator('#consoleOnlyDeals').uncheck();
 await expect(page.locator('.console-card')).toHaveCount(1);
 await page.locator('#consoleSource').selectOption('official');
 await page.locator('#regionSelect').selectOption('US');
 await expect(page.locator('.console-price strong')).toContainText('USD');
 await page.locator('[data-ecosystem="switch"]').click();
 await expect(page.locator('#gamesGrid')).toContainText('switch edición consola');
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-results/console-mobile.png'});
 await page.locator('[data-ecosystem="pc"]').click();
 await expect(page.locator('#gamesGrid')).toContainText('Juego exclusivo PC');
 await expect(page.locator('#consoleTools')).toBeHidden();
 assert.deepEqual(errors,[]);
 } finally { await browser.close();await new Promise(r=>server.close(r)); }
});

test('Carga 60 en 60, busca sin oferta y ordena sin duplicar resultados', async () => {
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try {
 const p=await browser.newPage();let searchDeals;
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==='/api/deals')data=[];
  if(u.pathname==='/api/stores')data=[];
  if(u.pathname==='/api/console-catalog'){
   const cursor=JSON.parse(u.searchParams.get('cursor')||'{}');const page=cursor.official||0;
   const q=u.searchParams.get('q');if(q)searchDeals=u.searchParams.get('deals');
   data={platform:'xbox',region:'MX',checkedAt:Date.now(),sources:[],scope:'Prueba',next:page===0?{official:1,external:false}:null,items:Array.from({length:60},(_,i)=>({id:String(page*60+i),title:q?`${q} ${i}`:`Título ${page*60+i}`,price:i+1,regular:q?i+1:(i+1)*2,discount:q?0:50,currency:'MXN',edition:'Xbox',store:'Xbox Store',kind:'official',url:'https://www.xbox.com',rating:i%5+1,ratingCount:100}))};
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await p.goto(`http://127.0.0.1:${server.address().port}`);
 await p.locator('[data-ecosystem="xbox"]').click();
 await expect(p.locator('.console-card')).toHaveCount(60);
 await p.locator('#loadMoreBtn').click();
 await expect(p.locator('.console-card')).toHaveCount(120);
 assert.equal(new Set(await p.locator('.console-card h3').allTextContents()).size,120);
 await expect(p.locator('#loadMoreContainer')).toBeHidden();
 await p.locator('#consoleOrder').selectOption('priceDesc');
 await expect(p.locator('.console-card')).toHaveCount(60);
 await expect(p.locator('.console-price strong').first()).toContainText('60.00');
 await p.locator('.console-extra summary').click();
 await p.locator('#consoleMaxPrice').fill('10');
 await expect(p.locator('.console-card')).toHaveCount(10);
 await p.locator('#consoleMaxPrice').fill('');
 await p.locator('#predictiveSearchInput').fill('Halo');
 await p.locator('#predictiveSearchInput').press('Enter');
 await expect(p.locator('.console-card h3').first()).toContainText('Halo');
 await expect(p.locator('#consoleOnlyDeals')).not.toBeChecked();
 assert.equal(searchDeals,'0');
 await expect(p.locator('.console-card')).toHaveCount(60);
 } finally {await browser.close();await new Promise(r=>server.close(r));}
});
