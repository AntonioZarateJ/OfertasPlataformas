const {publicFetch}=require('./public-fetch.cjs');
const {playstationData}=require('./console-sources.cjs');
function playstationVariants(html,region,selectedId){
 const state=Object.create(null);
 for(const match of html.matchAll(/<script id="env:[^"]*"[^>]*>([\s\S]*?)<\/script>/g)){
  let data;try{data=JSON.parse(match[1]);}catch{continue;}
  for(const [key,value]of Object.entries(data.cache||{}))state[key]={...state[key],...value};
 }
 const concepts=Object.values(state).filter(v=>v.__typename==='Concept'&&Array.isArray(v.products));
 const concept=concepts.find(v=>v.products.some(p=>p.__ref==='Product:'+selectedId))||concepts[0];
 if(!concept)throw Error('Ediciones no disponibles');
 return concept.products.flatMap(ref=>{
  const product=state[ref.__ref]||ref;
  if(product.topCategory!=='GAME'||!['FULL_GAME','GAME_BUNDLE','PREMIUM_EDITION','BUNDLE'].includes(product.storeDisplayClassification))return [];
  const ctas=[...(product.webctas||[]).map(c=>c.__ref?state[c.__ref]:c),...Object.entries(state).filter(([k,v])=>k.startsWith('GameCTA:ADD_TO_CART:')&&String(v.local?.ctaDataTrack?.sku||v.action?.param?.find(p=>p.name==='skuId')?.value||'').startsWith(product.id+'-')).map(([,v])=>v)];
  const cta=ctas.find(c=>c?.type==='ADD_TO_CART'&&((c.price&&!c.price.isTiedToSubscription)||c.local?.telemetryMeta?.skuDetail?.skuPriceDetail?.some(q=>!q.offerIsTiedToSubscription)));
  if(!cta)return [];
  const details=cta.local?.telemetryMeta?.skuDetail?.skuPriceDetail?.find(q=>!q.offerIsTiedToSubscription);
  const price=cta.price&&!cta.price.isTiedToSubscription?cta.price:{basePrice:details.originalPriceFormatted,discountedPrice:details.discountPriceFormatted};
  const quotes=playstationData({data:{categoryStrandRetrieve:{products:[{...product,localizedStoreDisplayClassification:product.storeDisplayClassification,price}]}}},region);
  return quotes.map(q=>({...q,variantGroup:concept.id,variantType:product.edition?.type==='STANDARD'?'base':'edition'}));
 });
}
const cache=new Map(),pending=new Map();
async function loadPlaystationVariants(item,region,fetchImpl=publicFetch){
 const url=new URL(item.url),locale={MX:'es-mx',US:'en-us',ES:'es-es',GB:'en-gb',BR:'pt-br',JP:'ja-jp'}[region];
 if(url.protocol!=='https:'||url.hostname!=='store.playstation.com'||!url.pathname.startsWith('/'+locale+'/'))throw Error('Ficha inválida');
 const key=region+url.href;
 if(cache.get(key)?.expires>Date.now())return cache.get(key).items;
 if(!pending.has(key))pending.set(key,(async()=>{
  const r=await fetchImpl(url.href,{signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('Ficha no disponible');
  const items=playstationVariants(await r.text(),region,item.id);if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(key,{items,expires:Date.now()+60000});return items;
 })());
 try{return await pending.get(key);}finally{pending.delete(key);}
}
module.exports={playstationVariants,loadPlaystationVariants};
