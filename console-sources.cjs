const locales = { MX:'es-MX', US:'en-US', ES:'es-ES', GB:'en-GB', BR:'pt-BR', JP:'ja-JP' };
const currencies = { MX:'MXN', US:'USD', ES:'EUR', GB:'GBP', BR:'BRL', JP:'JPY' };
function embedded(html, marker) {
 const start=html.indexOf(marker); if(start<0)throw Error('Formato de tienda no reconocido');
 const text=html.slice(start+marker.length); const first=text.indexOf('{');
 let depth=0,quoted=false,escaped=false;
 for(let i=first;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(text.slice(first,i+1));}
 throw Error('Datos incompletos');
}
async function get(url,json=false,headers={}) {
 const r=await fetch(url,{headers:{'User-Agent':'SteamPulsePro/1.0 (regional price comparison)',...headers},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('HTTP '+r.status);return json?r.json():r.text();
}
function walk(o,visit){if(!o||typeof o!=='object')return;visit(o);Object.values(o).forEach(v=>walk(v,visit));}
function xboxData(state,region){
 const products=state.core2?.products?.productSummaries;if(!products)throw Error('Catálogo no disponible');
 return Object.values(products).flatMap(p=>{
  if(!p.availableOn?.some(x=>/XboxOne|XboxSeries/i.test(x))||p.productKind!=='Game')return [];
  const q=p.specificPrices?.purchaseable?.filter(x=>x.currency===currencies[region]&&x.eligibilityInfo?.eligibility==='None'&&Number.isFinite(x.listPrice)).sort((a,b)=>a.listPrice-b.listPrice)[0];if(!q)return [];
  return [{id:p.productId,title:p.title,price:q.listPrice,regular:q.msrp,currency:q.currency,discount:q.discountPercentage||0,image:p.images?.boxArt?.url||p.images?.poster?.url,url:`https://www.xbox.com/${locales[region]}/games/store/game/${p.productId}`,rating:Number.isFinite(p.averageRating)?p.averageRating:null,ratingCount:p.ratingCount||0,edition:p.availableOn.join(' / '),store:'Xbox Store',kind:'official'}];
 });
}
function nintendoData(data,region){const found=new Map();walk(data,p=>{if(!p.name||!p.urlKey||p.prices?.currency!==currencies[region])return;const platform=typeof p.platform==='string'?p.platform:p.platform?.label;if(!/Nintendo Switch/.test(platform||''))return;const q=p.prices;if(!Number.isFinite(q.finalPrice))return;found.set(p.nsuid||p.urlKey,{id:p.nsuid||p.urlKey,title:p.name,price:q.finalPrice,regular:q.regularPrice,currency:q.currency,discount:q.percentOff||0,image:p.productImageSquare?.url||(p.productImage?.publicId?'https://assets.nintendo.com/image/upload/q_auto/f_auto/'+p.productImage.publicId:''),url:`https://www.nintendo.com/${locales[region].toLowerCase()}/store/products/${p.urlKey}/`,edition:platform,store:'Nintendo eShop',kind:'official'});});if(!found.size)throw Error('No se encontraron precios regionales');return [...found.values()];}
function money(text,region){const parts=new Intl.NumberFormat(locales[region]).formatToParts(1234.5);const group=parts.find(p=>p.type==='group')?.value,decimal=parts.find(p=>p.type==='decimal')?.value;let s=String(text||'');if(group)s=s.split(group).join('');if(decimal)s=s.replace(decimal,'.');s=s.replace(/[^0-9.]/g,'');return s?Number(s):NaN;}
function playstationData(data,region){const products=data.data?.categoryStrandRetrieve?.products;if(!Array.isArray(products))throw Error('Catálogo no disponible');return products.flatMap(p=>{if(!p.price||p.price.isTiedToSubscription||p.price.isExclusive||p.storeDisplayClassification==='ADD_ON')return [];const price=p.price.isFree?0:money(p.price.discountedPrice,region),regular=money(p.price.basePrice,region);if(!Number.isFinite(price))return [];return [{id:p.id,title:p.name,price,regular,currency:currencies[region],discount:Number(String(p.price.discountText||'').replace(/[^0-9]/g,''))||0,image:p.media?.find(m=>m.type==='IMAGE')?.url,url:`https://store.playstation.com/${locales[region].toLowerCase()}/${p.isConcept?'concept':'product'}/${p.id}`,edition:p.platforms?.join(' / ')+' · '+p.localizedStoreDisplayClassification,store:'PlayStation Store',kind:'official'}];});}
function enebaData(data,platform,region){return Object.values(data).flatMap(p=>{
 if(p.__typename!=='Product'||p.type?.value!=='GAME')return [];
 if(platform==='xbox' && /\(PC\)|Windows/i.test(p.name||'') && !/Xbox One|Xbox Series/i.test(p.name||''))return [];
 const drm=p.drm?.name||'';if(!({xbox:/xbox/i,ps:/playstation|psn/i,switch:/nintendo/i}[platform]).test(drm))return [];
 const codes={MX:['mexico','latam','global'],US:['united-states','north-america','global'],ES:['europe','spain','global'],GB:['united-kingdom','europe','global'],BR:['brazil','latam','global'],JP:['japan','global']}[region];if(!p.regions?.some(r=>codes.includes(r.code)))return [];
 const a=data[p.cheapestAuction?.__ref];if(!a?.isInStock||!a.isAddableToCart)return [];
 const q=a[`price({"currency":"${currencies[region]}"})`];if(!q||!Number.isFinite(q.amount))return [];
 const regular=a[`msrp({"currency":"${currencies[region]}"})`];
 return [{id:p.slug,title:p.name,price:q.amount/100,regular:regular?.amount/100||null,currency:q.currency,discount:regular?.amount>q.amount?Math.round((1-q.amount/regular.amount)*100):0,image:p['cover({"width":300})']?.src,url:'https://www.eneba.com/'+p.slug,edition:drm+' · '+p.regions.map(r=>r.name).join(', '),store:'Eneba',kind:'external',seller:a.merchant?.displayname}];
});}
async function consoleCatalog(...args){ return require('./console-paged.cjs').catalog(...args); }
module.exports={consoleCatalog,xboxData,nintendoData,playstationData,enebaData,embedded};
