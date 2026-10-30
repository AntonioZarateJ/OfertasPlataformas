const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCheapSharkClient}=require('../cheapshark-client.cjs');
const {discountPosition}=require('../discount-position.cjs');
const {nintendoVariants}=require('../nintendo-variants.cjs');
const {compareGame,rememberCatalog}=require('../console-comparison.cjs');

test('CheapShark serializa, comparte caché y respeta la pausa del proveedor',async()=>{
 let time=10000,calls=0,active=0,peak=0,limited=false;
 const starts=[];
 const client=createCheapSharkClient(async()=>{
  calls++;active++;peak=Math.max(peak,active);starts.push(time);
  await Promise.resolve();active--;
  return limited?Response.json({}, {status:429,headers:{'Retry-After':'10'}}):Response.json([{savings:20}]);
 },{now:()=>time,sleep:async ms=>{time+=ms;}});
 const a='https://www.cheapshark.com/api/1.0/deals?a=1&b=2';
 const responses=await Promise.all([client(a),client(a),client('https://www.cheapshark.com/api/1.0/deals?b=2&a=1'),client(a+'&pageNumber=2')]);
 for(const r of responses)assert.equal(r.status,200);
 assert.equal(calls,2);assert.equal(peak,1);assert(starts[1]-starts[0]>=650);
 limited=true;
 assert.equal((await client(a+'&pageNumber=3')).status,429);
 const before=calls;
 const paused=await client(a+'&pageNumber=4');assert.equal(paused.status,429);assert.equal(paused.headers.get('Retry-After'),'10');
 assert.equal(calls,before);
 assert.equal((await client(a)).status,200); // Se permite leer la caché durante la pausa.
 time+=11000;limited=false;assert.equal((await client(a+'&pageNumber=4')).status,200);
});

test('La búsqueda del 20% conserva su avance y limita peticiones por tanda',async()=>{
 const state={};let calls=0,result;
 const fetcher=async url=>{calls++;const page=Number(new URL(url).searchParams.get('pageNumber'));return Response.json([{savings:page<800?90:20}],{headers:{'X-Total-Page-Count':'50'}});};
 for(let i=0;i<10;i++){
  const before=calls;result=await discountPosition(new URLSearchParams({discount:'20'}),fetcher,state);
  assert(calls-before<=4);
  if(!result.pending)break;
  assert.equal(result.page,null);
 }
 assert.equal(result.page,799);assert(calls<20);
});

test('Un límite HTTP 400 no causa saltos repetidos ni pierde coincidencias accesibles',async()=>{
 for(const hasMatch of [true,false]){
  const state={};let result,calls=0;
  for(let i=0;i<10;i++){
   result=await discountPosition(new URLSearchParams({discount:'20',desc:'1',storeID:'1'}),async url=>{
    assert.equal(new URL(url).searchParams.get('storeID'),'1');
    const p=Number(new URL(url).searchParams.get('pageNumber'));calls++;
    if(p>=50)return new Response('Too Many Results - Refine Search',{status:400});
    return Response.json([{savings:hasMatch&&p>=9?20:10}],{headers:{'X-Total-Page-Count':'50'}});
   },state);
   if(!result.pending)break;
  }
  if(hasMatch)assert.equal(result.page,8);else assert.equal(result.limited,true);
  assert(calls<12);
 }
});

test('Una respuesta lenta deja una búsqueda pendiente, sin iniciar un barrido',async()=>{
 let calls=0;
 const result=await discountPosition(new URLSearchParams({discount:'20',storeID:'1'}),async()=>{
  calls++;throw new DOMException('Proveedor lento','TimeoutError');
 },{});
 assert.equal(calls,1);assert.equal(result.pending,true);assert.equal(result.slow,true);
});

test('El catálogo Nintendo no anuncia como comprables ediciones retiradas',async()=>{
 const original=global.fetch;
 const game={objectID:'base',title:'Minecraft',platform:'Nintendo Switch',price:{finalPrice:601.99,regPrice:601.99},isSalableQty:true,url:'/es-mx/store/products/minecraft-switch/',eshopDetails:{currency:'MXN',isPurchasable:true}};
 try{
  global.fetch=async()=>Response.json({results:[{hits:[game,{...game,objectID:'old',title:'Minecraft: Nintendo Switch Edition',eshopDetails:{currency:'MXN',isPurchasable:false}}],page:0,nbPages:1,nbHits:2}]});
  const result=await require('../console-paged.cjs').catalog('switch','MX','Minecraft',{source:'official'});
  assert.equal(result.items.length,1);assert.equal(result.items[0].id,'base');
 }finally{global.fetch=original;}
});

function fixture(){
 const product=(sku,name,price,hardware='Nintendo Switch 2')=>({sku,name,isSalableQty:true,platform:{label:hardware},'prices({"personalized":false})':{currency:'MXN',regularPrice:price,finalPrice:price},'url({"relative":true})':`/es-mx/store/products/${sku}/`});
 const main=product('base','Minecraft',562);main.variations=['base','deluxe','ultimate'].map(id=>({label:id==='base'?'Standard Edition':'ROM Bundle',product:{__ref:id}}));
 return '<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{initialApolloState:{ROOT_QUERY:{'product({"input":{}})':{__ref:'base'}},base:main,deluxe:product('deluxe','Minecraft: COLECCIÓN DELUXE',749),ultimate:product('ultimate','Minecraft: COLECCIÓN ULTIMATE',937),unrelated:product('dlc','Minecraft DLC',50)}}}})+'</script>';
}
test('Nintendo extrae solo las variantes vinculadas, con precio y consola propios',async()=>{
 const editions=nintendoVariants(fixture(),'MX','https://www.nintendo.com/es-mx/store/products/base/');
 assert.deepEqual(editions.map(q=>q.price),[562,749,937]);
 assert.deepEqual(editions.map(q=>q.variantType),['base','edition','edition']);
 assert.equal(nintendoVariants(fixture(),'US','https://www.nintendo.com/us/store/products/base/').length,0);
 const base=editions[0],switch1={...base,id:'old',edition:'Nintendo Switch',price:601.99};
 rememberCatalog({platform:'switch',region:'MX',checkedAt:Date.now(),items:[base]});
 const result=await compareGame('switch','MX','Minecraft','base','Nintendo eShop',{
  catalog:async()=>({items:[base,switch1,{...base,id:'dungeons',title:'Minecraft Dungeons'}],sources:[]}),
  variantsLoader:async()=>editions,recordPrices:async(_,quotes)=>quotes
 });
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].edition,'Nintendo Switch 2');
 assert.equal(result.editions.length,4);assert(!result.editions.some(q=>q.title==='Minecraft Dungeons'));
 assert(result.otherEditions.some(q=>q.edition==='Nintendo Switch'));
});

test('La interfaz continúa la búsqueda sin barridos y muestra ediciones visibles en móvil',async()=>{
 const {createServer}=require('../server.cjs');const {chromium,expect}=require('@playwright/test');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let seeks=0,deals=0,blocked=false;
  const editions=nintendoVariants(fixture(),'MX','https://www.nintendo.com/es-mx/store/products/base/');
  await page.route('**/api/**',async route=>{
   const u=new URL(route.request().url());let data={},status=200,headers={};
   if(u.pathname==='/api/deals'){deals++;data=[{gameID:'1',title:'Juego al 20%',savings:20,salePrice:8,normalPrice:10,storeID:'1'}];}
   if(u.pathname==='/api/deals-position'){
    seeks++;
    if(blocked){blocked=false;status=429;headers={'Retry-After':'1'};data={error:'Pausa'};}
    else data=seeks===1?{page:null,pending:true,reviewed:4}:{page:6};
   }
   if(u.pathname==='/api/stores')data=[];
   if(u.pathname==='/api/console-catalog')data={platform:'switch',region:'MX',checkedAt:Date.now(),sources:[],scope:'Prueba',next:null,items:[editions[0]]};
   if(u.pathname==='/api/console-comparison')data={platform:'switch',region:'MX',checkedAt:Date.now(),offers:[editions[0]],editions,editionsStatus:'ok',otherEditions:editions.slice(1),sources:[],searchLinks:[],coverage:'Prueba'};
   await route.fulfill({contentType:'application/json',status,headers,body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(1);
  const before=deals;
  const apply=()=>page.evaluate(()=>{document.getElementById('drawerDiscountMode').value='exact';document.getElementById('drawerDiscountSlider').value='20';applyCustomDrawerFilters();});
  await apply();
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(1);
  assert(seeks>=2);assert.equal(deals,before+1);
  await expect(page.locator('#catalogError')).not.toBeVisible();
  await expect(page.locator('#loadMoreBtn')).not.toContainText('Continuar');
  blocked=true;await apply();
  await expect(page.locator('#loadingState')).toBeVisible();
  await expect(page.locator('#loadingText')).toContainText('automáticamente');
  await expect(page.locator('#loadingState')).toBeHidden({timeout:10000});
  await expect(page.locator('#catalogError')).not.toBeVisible();
  await page.locator('[data-ecosystem="switch"]').click();
  // El catálogo completo incluye Minecraft aunque no esté rebajado.
  await page.locator('[data-chip="all"]').click();
  await page.locator('.console-compare').click();
  await expect(page.locator('.edition-card')).toHaveCount(3);
  await expect(page.locator('.game-editions')).toContainText('749.00 MXN');
  await expect(page.locator('.game-editions')).toContainText('937.00 MXN');
  await page.locator('.game-editions').scrollIntoViewIfNeeded();
  assert(await page.locator('#consoleComparison').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:'test-results/nintendo-editions-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/nintendo-editions-desktop.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
