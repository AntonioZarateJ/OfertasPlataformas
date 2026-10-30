const {publicFetch}=require('./public-fetch.cjs');
const {embedded}=require('./console-sources.cjs');
const currencies={MX:'MXN',US:'USD',ES:'EUR',GB:'GBP',BR:'BRL',JP:'JPY'};
const locales={MX:'es-mx',US:'us',ES:'es-es',GB:'en-gb',BR:'pt-br',JP:'ja-jp'};
function nintendoVariants(html,region,url){
 const data=embedded(html,'id="__NEXT_DATA__"'),state=data.props?.pageProps?.initialApolloState;
 if(!state)throw Error('Variantes no disponibles');
 const root=Object.entries(state.ROOT_QUERY||{}).find(([key])=>key.startsWith('product('))?.[1];
 const main=root?.__ref?state[root.__ref]:root;
 if(!main)throw Error('Producto no disponible');
 const baseRef=(main.variations||[]).find(v=>/standard edition/i.test(v.label||''))?.product?.__ref;
 const baseSku=baseRef?state[baseRef]?.sku:main.sku;
 const products=[main,...(main.variations||[]).map(v=>v.product?.__ref?state[v.product.__ref]:v.product)];
 const seen=new Set();
 return products.flatMap(product=>{
  if(!product||seen.has(product.sku)||product.isSalableQty===false||product.soldOutPermanent)return [];
  seen.add(product.sku);
  const price=Object.entries(product).find(([key])=>key==='prices'||key.startsWith('prices('))?.[1];
  const path=Object.entries(product).find(([key])=>key==='url'||key.startsWith('url('))?.[1];
  if(price?.currency!==currencies[region]||!Number.isFinite(price.finalPrice)||price.finalPrice<0||!/^Nintendo Switch(?: 2)?$/.test(product.platform?.label||''))return [];
  const link=new URL(path||url,'https://www.nintendo.com');
  if(link.hostname!=='www.nintendo.com'||!link.pathname.startsWith('/'+locales[region]+'/store/products/'))return [];
  return [{id:String(product.sku),title:product.name,price:price.finalPrice,regular:price.regularPrice,currency:price.currency,
   discount:price.regularPrice>price.finalPrice?Math.round((1-price.finalPrice/price.regularPrice)*100):0,
   image:product.productImage?.url||'',url:link.href,edition:product.platform.label,store:'Nintendo eShop',kind:'official',
   variantGroup:String(main.sku),variantType:product.sku===baseSku?'base':'edition',baseTitle:main.name}];
 });
}
const cache=new Map(),pending=new Map();
async function loadNintendoVariants(item,region,fetchImpl=publicFetch){
 const url=new URL(item.url);
 if(url.protocol!=='https:'||url.hostname!=='www.nintendo.com'||!url.pathname.startsWith('/'+locales[region]+'/store/products/'))throw Error('Ficha no válida');
 const key=region+url.href;
 if(cache.get(key)?.expires>Date.now())return cache.get(key).items;
 if(!pending.has(key))pending.set(key,(async()=>{
  const r=await fetchImpl(url.href,{signal:AbortSignal.timeout(6500),headers:{'User-Agent':'SteamPulsePro/1.0 (product editions)'}});
  if(!r.ok)throw Error('Ficha no disponible');
  const text=await r.text();if(text.length>3000000)throw Error('Ficha demasiado grande');
  const items=nintendoVariants(text,region,url.href);
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(key,{items,expires:Date.now()+60000});return items;
 })());
 try{return await pending.get(key);}finally{pending.delete(key);}
}
module.exports={nintendoVariants,loadNintendoVariants};
