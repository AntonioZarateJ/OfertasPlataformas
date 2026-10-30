const {publicFetch}=require('./public-fetch.cjs');
const currencies={MX:'MXN',US:'USD',ES:'EUR',GB:'GBP',BR:'BRL',JP:'JPY'};
function text(html){return html.replace(/<[^>]*>/g,' ').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
function purchaseBlocks(html){
 const blocks=[];const starts=/<div\b[^>]*class="[^"]*\bgame_area_purchase_game_wrapper\b[^"]*"[^>]*>/g;let match;
 while((match=starts.exec(html))){
  const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=match.index;let depth=0,tag;
  while((tag=tags.exec(html))){depth+=tag[0].startsWith('</')?-1:1;if(!depth){blocks.push(html.slice(match.index,tags.lastIndex));starts.lastIndex=tags.lastIndex;break;}}
 }
 return blocks;
}
function steamEditions(data,html,appid,region){
 const currency=currencies[region],quote=data.price_overview;
 if(quote?.currency!==currency)return [];
 const editions=[{id:String(appid),title:data.name,price:quote.final/100,currency,edition:'PC · Steam',store:'Steam',kind:'official',variantType:'base',selected:true,url:'https://store.steampowered.com/app/'+appid+'/'}];
 for(const block of purchaseBlocks(html)){
  const title=text(block.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]||'').replace(/^(comprar|buy)\s+/i,'').replace(/[«»]/g,'');
  const amount=Number(block.match(/data-price-final="(\d+)"/)?.[1]);
  const bundle=block.match(/data-ds-bundleid="(\d+)"/)?.[1],sub=block.match(/name="subid"\s+value="(\d+)"/)?.[1];
  if(!title||!Number.isFinite(amount)||!bundle&&!sub)continue;
  // Los paquetes de otras franquicias se mantienen fuera del comparador de ediciones.
  if(!title.toLowerCase().includes(data.name.toLowerCase())||/demo|soundtrack|banda sonora/i.test(title))continue;
  const url='https://store.steampowered.com/'+(bundle?'bundle/':'sub/')+(bundle||sub)+'/';
  if(title.toLowerCase()===data.name.toLowerCase())continue;
  editions.push({id:(bundle?'bundle:':'sub:')+(bundle||sub),title,price:amount/100,currency,edition:bundle?'PC · Paquete de Steam':'PC · Edición de Steam',store:'Steam',kind:'official',variantType:bundle?'bundle':'edition',selected:false,url});
 }
 return editions;
}
async function loadSteamEditions(appid,region,fetchImpl=publicFetch){
 const [api,store]=await Promise.allSettled([
  fetchImpl(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${region.toLowerCase()}&filters=basic,packages,price_overview`,{signal:AbortSignal.timeout(6500)}).then(r=>{if(!r.ok)throw Error('Steam no disponible');return r.json();}),
  fetchImpl(`https://store.steampowered.com/app/${appid}/?cc=${region.toLowerCase()}&l=spanish`,{headers:{Cookie:'birthtime=946684801; wants_mature_content=1'},signal:AbortSignal.timeout(6500)}).then(r=>r.ok?r.text():'')
 ]);
 const data=api.status==='fulfilled'&&api.value[appid]?.success?api.value[appid].data:null;
 if(!data)throw Error('Ficha no disponible');
 return {editions:steamEditions(data,store.status==='fulfilled'?store.value:'',appid,region),image:data.header_image||'',coverage:store.status==='fulfilled'?'Precios públicos de Steam para la región seleccionada. Los paquetes pueden variar según los juegos que ya poseas.':'No se pudieron confirmar todos los paquetes de Steam en esta consulta.'};
}
module.exports={purchaseBlocks,steamEditions,loadSteamEditions};
