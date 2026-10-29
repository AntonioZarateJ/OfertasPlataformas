const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {signature,createHistory}=require('../console-comparison.cjs');
const {createServer}=require('../server.cjs');
const {chromium,expect}=require('@playwright/test');
test('Las coincidencias conservan la edición y el registro separa región y tienda',async()=>{
 assert.equal(signature('Cyberpunk 2077 (Xbox One) Xbox Live Key GLOBAL'),signature('Cyberpunk 2077'));
 assert.notEqual(signature('Cyberpunk 2077 Ultimate Edition'),signature('Cyberpunk 2077'));
 const file=path.resolve(__dirname,'../test-results/history-test-'+Date.now()+'.json');
 const record=createHistory(file);
 const quote={id:'1',store:'Oficial',currency:'MXN',price:369};
 const first=await record('xbox|MX|cyberpunk',[quote],Date.UTC(2026,9,28));
 assert.equal(first[0].history.days,1);
 const later=await record('xbox|MX|cyberpunk',[{...quote,price:299}],Date.UTC(2026,9,29));
 assert.equal(later[0].history.min,299);assert.equal(later[0].history.max,369);assert.equal(later[0].history.days,2);
 const other=await record('xbox|US|cyberpunk',[{...quote,price:20,currency:'USD'}]);assert.equal(other[0].history.min,20);
 await fs.unlink(file);
});
test('Comparador y móvil conservan accesos únicos y controles operativos',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==='/api/stores'||u.pathname==='/api/deals')data=[];
  if(u.pathname==='/api/console-catalog')data={platform:'xbox',region:'MX',checkedAt:Date.now(),sources:[],scope:'Prueba',items:[{id:'1',title:'Cyberpunk 2077',price:369,regular:1230,discount:70,currency:'MXN',kind:'official',store:'Xbox Store',url:'https://www.xbox.com',edition:'Xbox'}]};
  if(u.pathname==='/api/console-comparison')data={platform:'xbox',region:'MX',title:'Cyberpunk 2077',checkedAt:Date.now(),coverage:'Fuentes consultadas',sources:[{name:'Xbox Store',status:'ok'},{name:'Eneba',status:'ok'}],searchLinks:[{name:'G2A',url:'https://www.g2a.com/search?query=cyberpunk'}],otherEditions:[],offers:[{id:'1',title:'Cyberpunk 2077',store:'Xbox Store',kind:'official',currency:'MXN',price:369,history:{days:1,since:'2026-10-29'},url:'https://www.xbox.com'},{id:'2',title:'Cyberpunk 2077 Key',store:'Eneba',kind:'external',currency:'MXN',price:455.29,history:{days:1,since:'2026-10-29'},url:'https://www.eneba.com'}]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 await expect(page.locator('#wishlistButton')).toBeVisible();await expect(page.locator('#userAccountBtn')).toBeVisible();
 await expect(page.locator('#mobileWishlistCount')).toHaveCount(0);
 await expect(page.locator('#regionSelect')).toBeHidden();
 await page.locator('#mobileFilterPanel>summary').click();await expect(page.locator('#regionSelect')).toBeVisible();
 await page.locator('#mobileFilterPanel>summary').click();
 await page.locator('[data-ecosystem="xbox"]').click();
 await page.locator('.console-compare').click();
 await expect(page.locator('#consoleComparison')).toBeVisible();
 await expect(page.locator('#consoleComparisonBody')).toContainText('455.29');
 await expect(page.locator('#consoleComparisonBody')).toContainText('Historial insuficiente');
 assert.equal(await page.locator('.comparison-row strong').first().textContent(),' Xbox Store');
 await page.keyboard.press('Escape');await expect(page.locator('#consoleComparison')).not.toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#regionSelect')).toBeVisible();
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
