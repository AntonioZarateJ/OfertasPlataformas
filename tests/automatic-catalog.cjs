const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {createServer}=require('../server.cjs');
const {steamEditions}=require('../steam-editions.cjs');
const {playstationVariants}=require('../playstation-variants.cjs');
const {compareGame}=require('../console-comparison.cjs');

test('PC, Xbox y PlayStation separan versiones, DLC y ofertas de suscripción',async()=>{
 const html='<div class="game_area_purchase_game_wrapper" data-ds-bundleid="10"><h2>Comprar Cyberpunk 2077: Ultimate Edition</h2><div data-price-final="137816"></div></div>';
 const editions=steamEditions({name:'Cyberpunk 2077',price_overview:{currency:'MXN',final:99900}},html,'1091500','MX');
 assert.deepEqual(editions.map(q=>q.price),[999,1378.16]);assert.equal(editions[1].variantType,'bundle');
 assert.equal(steamEditions({price_overview:{currency:'USD'}},html,'1','MX').length,0);
 const product=(id,name,type='FULL_GAME')=>({id,name,__typename:'Product',topCategory:'GAME',storeDisplayClassification:type,platforms:['PS5'],edition:{type:id==='base'?'STANDARD':'OTHER'},webctas:[{__ref:'cta:'+id}]});
 const cta=(price,type='ADD_TO_CART')=>({type,price:{discountedPrice:price+' MXN',basePrice:price+' MXN'}});
 const state={concept:{__typename:'Concept',id:'1',products:['base','ultimate','dlc','subscription'].map(id=>({__ref:id}))},base:product('base','Game'),ultimate:product('ultimate','Game Ultimate Edition','GAME_BUNDLE'),dlc:product('dlc','Game DLC','ADD_ON'),subscription:product('subscription','Game Plus'), 'cta:base':cta(100),'cta:ultimate':cta(200),'cta:dlc':cta(20),'cta:subscription':cta(0,'UPSELL_PS_PLUS_GAME_CATALOG')};
 const ps=playstationVariants('<script id="env:1" type="application/json">'+JSON.stringify({cache:state})+'</script>','MX','base');
 assert.deepEqual(ps.map(q=>q.price),[100,200]);
 for(const platform of ['xbox','ps']){
  const quote={id:'base',title:'Cyberpunk 2077',price:100,currency:'MXN',kind:'official',store:platform,edition:platform,url:'https://example.com'};
  const result=await compareGame(platform,'MX',quote.title,'base',platform,{catalog:async()=>({items:[quote,{...quote,id:'ultimate',title:platform==='xbox'?'Cyberpunk 2077: Edición definitiva':'Cyberpunk 2077 Ultimate Edition'},{...quote,id:'addon',title:'Cyberpunk 2077 Phantom Liberty'}],sources:[]}),variantsLoader:async()=>null,recordPrices:async(_,q)=>q});
  assert.equal(result.offers.length,1);assert.equal(result.editions.length,2);
 }
});

test('Varios porcentajes se buscan automáticamente; reintentos, cancelación y portadas funcionan',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const percents=[0,10,20,25,50,75,90,100],seeks=new Map();let rateOnce=true,goodCover=false;
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());let data={};
   if(u.hostname==='images.example')return route.fulfill({status:u.pathname==='/good.svg'?200:404,contentType:'image/svg+xml',body:u.pathname==='/good.svg'?'<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215"><rect width="460" height="215" fill="#187fa4"/></svg>':''});
   if(u.hostname.includes('steamstatic.com'))return route.fulfill({status:404,body:''});
   if(!u.pathname.startsWith('/api/'))return route.continue();
   if(u.pathname==='/api/stores')data=[];
   if(u.pathname==='/api/deals-position'){
    const key=u.searchParams.toString(),n=(seeks.get(key)||0)+1;seeks.set(key,n);
    if(u.searchParams.get('title')==='lento')return route.fulfill({status:429,headers:{'Retry-After':'5'},contentType:'application/json',body:'{}'});
    if(u.searchParams.get('discount')==='50'&&rateOnce){rateOnce=false;return route.fulfill({status:429,headers:{'Retry-After':'1'},contentType:'application/json',body:'{}'});}
    data=n===1?{pending:true,page:null}:{page:0};
   }
   if(u.pathname==='/api/deals')data=percents.filter(n=>u.searchParams.get('onSale')!=='1'||n>0).map(n=>({gameID:String(n),dealID:'deal'+n,title:'Descuento '+n,savings:n,salePrice:100-n,normalPrice:100,storeID:'1',thumb:'https://images.example/broken.jpg'}));
   if(u.pathname==='/api/games')data={info:{title:'Juego',thumb:'https://images.example/broken.jpg'},cheapestPriceEver:{price:10,date:1700000000},deals:[{price:10,retailPrice:20,storeID:'1',dealID:'test'}]};
   if(u.pathname==='/api/pc-editions')data={image:goodCover?'https://images.example/good.svg':'',editions:[{title:'Juego base',price:100,currency:'MXN',store:'Steam',variantType:'base',edition:'PC',url:'https://store.steampowered.com/app/1/'}]};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(7);
  for(const percent of [10,20,50,75,90,0,100]){
   await page.evaluate(n=>{queryConfig.onSale=n===0?'0':'1';document.getElementById('drawerDiscountMode').value='exact';document.getElementById('drawerDiscountSlider').value=String(n);applyCustomDrawerFilters();},percent);
   await expect(page.locator('#gamesGrid h3')).toHaveText('Descuento '+percent,{timeout:15000});
   await expect(page.locator('#loadingState')).toBeHidden();
   await expect(page.locator('#catalogError')).not.toBeVisible();
   await expect(page.locator('#loadMoreBtn')).not.toContainText('Continuar');
  }
  await page.evaluate(()=>{queryConfig.onSale='0';queryConfig.sortBy='Savings';document.getElementById('drawerDiscountMode').value='range';document.getElementById('drawerDiscountSlider').value='10';document.getElementById('drawerDiscountEnd').value='25';applyCustomDrawerFilters();});
  await expect(page.locator('#gamesGrid h3')).toHaveText(['Descuento 25','Descuento 20','Descuento 10']);
  await page.evaluate(()=>{predictiveSearchInput.value='lento';applyCustomDrawerFilters();});
  await expect(page.locator('#loadingText')).toContainText('automáticamente');
  await page.evaluate(()=>{predictiveSearchInput.value='nuevo';applyCustomDrawerFilters();});
  await expect(page.locator('#loadingState')).toBeHidden({timeout:10000});
  await expect(page.locator('#gamesGrid .steam-card')).toHaveCount(3);
  await page.evaluate(()=>openAnalyticalModal({gameID:'20',steamAppID:'1234',title:'Juego',salePrice:10,thumb:'https://images.example/broken.jpg'}));
  await expect(page.locator('#pcEditions .edition-card')).toHaveCount(1);
  await expect.poll(()=>page.locator('#modalCoverImg').evaluate(img=>img.complete&&img.naturalWidth>0&&img.src.startsWith('data:')&&img.dataset.imageState==='placeholder')).toBe(true);
  await page.evaluate(()=>closeAnalyticsModal());goodCover=true;
  await page.evaluate(()=>openAnalyticalModal({gameID:'20',steamAppID:'1235',title:'Juego',salePrice:10,thumb:'https://images.example/broken.jpg'}));
  await expect.poll(()=>page.locator('#modalCoverImg').evaluate(img=>img.complete&&img.naturalWidth>0&&img.src.includes('/good.svg'))).toBe(true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
