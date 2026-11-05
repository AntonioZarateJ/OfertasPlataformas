const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {createServer}=require('../server.cjs');
const {catalog}=require('../console-paged.cjs');

test('Las búsquedas conservan juegos, bundles, conceptos y páginas, sin añadir DLC o precios de otra región',async()=>{
 const original=global.fetch;const requests=[];
 const n=(id,title,type='BUNDLE')=>({objectID:id,title,platform:'Nintendo Switch',dlcType:type==='BUNDLE'?'ROM Bundle':type==='TITLE'?null:'Individual',price:{finalPrice:100,regPrice:100},isSalableQty:true,eshopDetails:{productType:type,currency:'MXN',isPurchasable:true},url:'/es-mx/store/products/'+id+'/'});
 const ps=(id,type='GAME_BUNDLE')=>({id,name:'Just Dance '+id,__typename:'Product',storeDisplayClassification:type,platforms:['PS5'],price:{discountedPrice:'100 MXN',basePrice:'100 MXN'}});
 const xbox=(id,availableOn=['XboxSeriesX|S'],eligibility='None')=>({productId:id,title:'Just Dance '+id,productKind:'Game',availableOn,specificPrices:{purchaseable:[{currency:'MXN',listPrice:100,msrp:100,eligibilityInfo:{eligibility}}]}});
 try{
  global.fetch=async(input,options)=>{
   const url=new URL(input);requests.push({url,options});
   if(url.hostname.includes('algolia.net'))return Response.json({results:[{page:0,nbPages:1,nbHits:8,hits:[n('free','Experiencia gratuita de Just Dance','TITLE'),n('base','Just Dance: Decades of Hits'),n('deluxe','Just Dance: Decades of Hits - Deluxe Edition'),n('ultimate','Just Dance: Decades of Hits - Ultimate Edition'),n('2026','Just Dance 2026 Edition'),n('extra','Pack cosmético','ADD_ON_CONTENT'),{...n('usd','Otra región'),eshopDetails:{productType:'BUNDLE',currency:'USD',isPurchasable:true}},{...n('retired','Retirado'),isSalableQty:false}]}]});
   if(url.hostname==='web.np.playstation.com')return Response.json({data:{universalSearch:{results:[ps('standard'),ps('premium','PREMIUM_EDITION'),{...ps('42'),__typename:'Concept',storeDisplayClassification:undefined,platforms:undefined},ps('song','TRACK'),{...ps('subscription'),price:{isTiedToSubscription:true,discountedPrice:'0 MXN'}}],pageInfo:{isLast:false,size:24,offset:0,totalCount:50},next:'next-token'}}});
   return Response.json({productSummaries:{base:xbox('base'),deluxe:xbox('deluxe'),pc:xbox('pc',['PC']),sub:xbox('sub',undefined,'GamePass')},channels:{page:{encodedCT:'next',totalItems:4,products:['base','deluxe','pc','sub']}}});
  };
  const result=await catalog('switch','MX','Just Dance',{source:'official'});
  assert.equal(result.items.length,5);assert(result.items.some(q=>q.id==='ultimate'));
  assert(result.items.filter(q=>q.id!=='free').every(q=>q.edition.includes('Paquete de juego')));
  const psResult=await catalog('ps','MX','Just Dance',{source:'official'});
  assert.deepEqual(psResult.items.map(q=>q.id),['standard','premium','42']);
  assert(psResult.items[2].url.includes('/concept/42'));
  assert(!psResult.items[2].edition.includes('undefined'));
  assert.deepEqual(psResult.next.official,{offset:24,token:'next-token'});
  const xboxResult=await catalog('xbox','MX','Just Dance',{source:'official'});
  assert.deepEqual(xboxResult.items.map(q=>q.id),['base','deluxe']);
  assert(requests.every(r=>r.url.hostname!=='emerald.xboxservices.com'||!JSON.parse(Buffer.from(JSON.parse(r.options.body).Filters,'base64')).Price));
 }finally{global.fetch=original;}
});

test('Las cuatro plataformas sugieren ediciones con precios, cancelan respuestas antiguas y permiten abrirlas sin Enter',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),origin='http://127.0.0.1:'+server.address().port;
  const calls=[],errors=[];let releaseSlow,slowGate;
  page.on('pageerror',e=>errors.push(e.message));
  const currency=r=>r==='US'?'USD':'MXN';
  const editions=(platform,region,q)=>['Estándar','Deluxe','Ultimate'].map((edition,i)=>({id:'edition-'+i,title:q+' · '+edition,price:100+i*100,regular:100+i*100,discount:0,currency:currency(region),edition:(platform==='switch'?'Nintendo Switch · Paquete de juego':platform+' · '+edition),store:platform==='switch'?'Nintendo eShop':platform==='ps'?'PlayStation Store':'Xbox Store',kind:'official',url:'https://example.com/'+i}));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin)return route.fulfill({body:'',contentType:'text/css'});
   if(!u.pathname.startsWith('/api/'))return route.continue();
   calls.push(u);let data={};
   if(u.pathname==='/api/stores'||u.pathname==='/api/deals')data=[];
   if(u.pathname==='/api/exchange-rates')data={rates:{USD:1,MXN:20}};
   if(u.pathname==='/api/games')data=u.searchParams.has('title')?['Standard','Deluxe','Ultimate'].map((edition,i)=>({gameID:String(i),external:u.searchParams.get('title')+' '+edition,cheapest:'10',thumb:''})):{};
   if(u.pathname==='/api/console-catalog'){
    const platform=u.searchParams.get('platform'),region=u.searchParams.get('region'),q=u.searchParams.get('q');
    if(q==='lento'&&slowGate)await slowGate;
    data={platform,region,checkedAt:Date.now(),sources:[],scope:'Prueba',next:null,items:q?editions(platform,region,q):[]};
   }
   if(u.pathname==='/api/console-comparison'){
    const platform=u.searchParams.get('platform'),region=u.searchParams.get('region');
    data={platform,region,checkedAt:Date.now(),offers:[{...editions(platform,region,'Just Dance')[0],id:u.searchParams.get('id'),title:u.searchParams.get('title')}],editions:[],otherEditions:[],searchLinks:[],sources:[],coverage:'Prueba'};
   }
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  });
  await page.goto(origin);
  const input=page.locator('#predictiveSearchInput'),rows=page.locator('#searchDropdown .suggestion-row');
  for(const platform of ['pc','xbox','ps','switch']){
   if(platform!=='pc')await page.locator('[data-ecosystem="'+platform+'"]').click();
   const before=calls.length;
   await input.fill('Ju');await input.fill('Just');await input.fill('Just Dance');
   await expect(rows).toHaveCount(3);
   await expect(rows.first()).toContainText('Just Dance');await expect(rows.nth(2)).toContainText('Ultimate');
   await expect(rows.first().locator('.suggestion-price')).toContainText('MXN');
   await expect(input).toHaveAttribute('aria-expanded','true');
   const queries=calls.slice(before).filter(u=>platform==='pc'?u.pathname==='/api/games':u.pathname==='/api/console-catalog'&&u.searchParams.get('q'));
   assert.equal(queries.length,1,'Una única consulta después de escribir en '+platform);
   if(platform!=='pc'){
    assert.equal(queries[0].searchParams.get('deals'),'0');
    assert.equal(queries[0].searchParams.get('cursor'),'{}');
    await rows.nth(1).click();
    await expect(page.locator('#consoleComparison')).toBeVisible();
    await expect(page.locator('#consoleComparisonTitle')).toContainText('Deluxe');
    await page.keyboard.press('Escape');
    await input.fill('Just Dance!');await input.fill('Just Dance');
    await expect(rows).toHaveCount(3);
    await page.locator('.suggestion-all').click();
    await expect(page.locator('.console-card')).toHaveCount(3);
    await expect(page.locator('.console-card h3')).toContainText(['Estándar','Deluxe','Ultimate']);
   }else{
    await input.press('ArrowDown');await expect(rows.first()).toHaveAttribute('aria-selected','true');
    await input.press('Escape');await expect(page.locator('#searchDropdown')).toBeHidden();
   }
  }
  await input.fill('<img src=x onerror=alert(1)>');
  await expect(rows).toHaveCount(3);assert.equal(await page.locator('#searchDropdown img[onerror]').count(),0);
  await expect(rows.first()).toContainText('<img');
  slowGate=new Promise(resolve=>{releaseSlow=resolve});
  await input.fill('lento');
  await expect.poll(()=>calls.some(u=>u.searchParams.get('q')==='lento')).toBe(true);
  await input.fill('nuevo');await expect(rows.first()).toContainText('nuevo');
  releaseSlow();slowGate=null;
  await expect(rows.first()).not.toContainText('lento');
  await page.locator('#regionSelect').selectOption('US');
  await expect(page.locator('#searchDropdown')).toBeHidden();
  await input.fill('Just Dance');await expect(rows).toHaveCount(3);
  await expect(rows.first().locator('.suggestion-price')).toContainText('USD');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/console-search-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/console-search-desktop.png'});
  await page.locator('[data-ecosystem="pc"]').click();await expect(page.locator('#searchDropdown')).toBeHidden();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
