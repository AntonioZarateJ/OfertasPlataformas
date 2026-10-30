const { randomBytes } = require('node:crypto');
const { embedded, xboxData, playstationData, enebaData } = require('./console-sources.cjs');
const locales={MX:'es-MX',US:'en-US',ES:'es-ES',GB:'en-GB',BR:'pt-BR',JP:'ja-JP'};
const currencies={MX:'MXN',US:'USD',ES:'EUR',GB:'GBP',BR:'BRL',JP:'JPY'};
async function request(url,body,headers={}){
 const r=await fetch(url,{method:body?'POST':'GET',headers:{'User-Agent':'SteamPulsePro/1.0 (catalog search)','Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}
async function xbox(region,q,cursor,onlyDeals,sort){
 const filters={PlayWith:{id:'PlayWith',choices:[{id:'XboxOne'},{id:'XboxSeriesX|S'}]}};
 if(onlyDeals)filters.Price={id:'Price',choices:[{id:'OnSale'}]};
 const orders={priceAsc:'Price asc',priceDesc:'Price desc',discountDesc:'DiscountPercentage desc',rating:'MostPopular desc'};
 if(orders[sort])filters.orderby={id:'orderby',choices:[{id:orders[sort]}]};
 const data=await request(`https://emerald.xboxservices.com/xboxcomfd/${q?'search/games':'browse'}?locale=${locales[region]}`,{Filters:Buffer.from(JSON.stringify(filters)).toString('base64'),ReturnFilters:false,ChannelId:q?'games':'',ChannelKeyToBeUsedInResponse:'page',Query:q||undefined,EncodedCT:cursor||undefined},{'x-ms-api-version':'1.1','MS-CV':randomBytes(16).toString('base64')+'.0'});
 const channel=data.channels?.page;if(!channel)throw Error('Catálogo vacío');
 const items=xboxData({core2:{products:{productSummaries:data.productSummaries}}},region);
 return {items,next:channel.encodedCT||null,total:channel.totalItems,limited:!!q&&!channel.encodedCT&&channel.totalItems>(channel.products?.length||0)};
}
async function ps(region,q,cursor,onlyDeals){
 const offset=Number(cursor?.offset||0);
 const operation=q?'getSearchResults':'categoryGridRetrieve';
 const variables=q?{countryCode:region,languageCode:locales[region].split('-')[0],nextCursor:cursor?.token||'',pageOffset:offset,pageSize:24,searchTerm:q}:{id:onlyDeals?'3f772501-f6f8-49b7-abac-874a88ca4897':'28c9c2b2-cecc-415c-9a08-482a605cb104',pageArgs:{size:24,offset},sortBy:null,filterBy:[],facetOptions:[],maxResults:null};
 const hash=q?'4df6284f982e57bec70f23c77e2c219dc792eb19af7fb3d3a81767aa3f1958aa':'88c0b9a1273c6d320c51cd73e390924e21ae28bf09f01cde8b84b1034b16cd03';
 const url=new URL('https://web.np.playstation.com/api/graphql/v1//op');url.searchParams.set('operationName',operation);url.searchParams.set('variables',JSON.stringify(variables));url.searchParams.set('extensions',JSON.stringify({persistedQuery:{version:1,sha256Hash:hash}}));
 const data=await request(url,null,{'x-psn-store-locale-override':locales[region],Accept:'application/json',Origin:'https://store.playstation.com'});
 const result=q?data.data?.universalSearch:data.data?.categoryGridRetrieve;
 if(!result)throw Error('Búsqueda no disponible');
 const products=result.concepts?.length?result.concepts.map(c=>({...c,isConcept:true,platforms:['PlayStation'],localizedStoreDisplayClassification:'Juego / edición disponible'})):result.products||result.results||[];
 const items=playstationData({data:{categoryStrandRetrieve:{products}}},region);
 const last=result.pageInfo?.isLast ?? products.length<24;
 return {items,next:last?null:{offset:offset+24,token:result.next||''},total:result.pageInfo?.totalCount};
}
async function nintendo(region,q,cursor,onlyDeals,sort,discount){
 // Clave pública de búsqueda usada por el propio escaparate; no es una clave administrativa.
 const filters=onlyDeals?['price.discounted=1']:[];
 if(discount)filters.push(`price.percentOff>=${discount.min-.5} AND price.percentOff<${discount.max+.5}`);
 const params=new URLSearchParams({query:q,hitsPerPage:'60',page:String(cursor||0),filters:filters.join(' AND ')});
 const data=await request('https://u3b6gr4ua3-dsn.algolia.net/1/indexes/*/queries',{requests:[{indexName:'store_game_'+locales[region].replace('-','_').toLowerCase(),params:params.toString()}]},{'x-algolia-api-key':'a29c6927638bfd8cee23993e51e721c9','x-algolia-application-id':'U3B6GR4UA3'});
 const result=data.results?.[0];if(!Array.isArray(result?.hits))throw Error('Catálogo no disponible para esta región');
 const items=result.hits.flatMap(p=>{
 if((p.eshopDetails?.isPurchasable===false||p.isSalableQty===false)&&!p.eshopDetails?.isPreorderable)return [];
 if(!/Nintendo Switch/.test(p.platform||'')||!p.eshopDetails||p.eshopDetails.currency!==currencies[region]||!Number.isFinite(p.price?.finalPrice)||p.dlcType)return [];
 return [{id:p.objectID||p.urlKey,title:p.title,price:p.price.finalPrice,regular:p.price.regPrice,currency:p.eshopDetails.currency,discount:p.price.percentOff||0,image:p.productImageSquare||'https://assets.nintendo.com/image/upload/q_auto/f_auto/'+p.productImage,url:new URL(p.url,'https://www.nintendo.com').href,edition:p.platform,store:'Nintendo eShop',kind:'official'}];
 });
 return {items,next:result.page+1<result.nbPages?result.page+1:null,total:result.nbHits};
}
async function external(platform,region,q,page,sort){
 if(q) return searchEneba(platform,region,q,page);
 const url=new URL('https://www.eneba.com/latam/store/'+({xbox:'xbox-games',ps:'psn-games',switch:'nintendo-games'}[platform]));url.searchParams.set('currency',currencies[region]);url.searchParams.set('page',String(page||1));if(q)url.searchParams.set('text',q);
 if(sort==='priceAsc'||sort==='priceDesc')url.searchParams.set('sortBy',sort==='priceAsc'?'PRICE_ASC':'PRICE_DESC');
 const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);
 const data=embedded(await r.text(),'id="__APOLLO_STATE__"');
 const search=Object.entries(data.ROOT_QUERY||{}).find(([k])=>k.startsWith('search('))?.[1];
 const response=search?.__ref?data[search.__ref]:search;
 const connection=response?.results;
 const items=enebaData(data,platform,region);
 return {items,next:connection?.edges?.length && (page||1)*20<connection.totalCount?(page||1)+1:null,total:connection?.totalCount,url:url.href};
}
async function searchEneba(platform,region,q,page=1){
 const regionCodes={MX:['global','latam','mexico'],US:['global','north_america','united_states'],ES:['global','europe','spain'],GB:['global','europe','united_kingdom'],BR:['global','latam','brazil'],JP:['global','japan']}[region];
 const drm={xbox:'xbox',ps:'psn',switch:'nintendo'}[platform];
 const data=await request('https://ihjzq5lw2r-dsn.algolia.net/1/indexes/*/queries',{requests:[{indexName:'products_'+region.toLowerCase(),query:q,page:(page||1)-1,hitsPerPage:60,filters:`drmName:${drm} AND productType:game AND (${regionCodes.map(c=>'productRegions:'+c).join(' OR ')})`}]},{'x-algolia-api-key':'53864095e814940ffed0f69a897331f1','x-algolia-application-id':'IHJZQ5LW2R'});
 const result=data.results?.[0];if(!Array.isArray(result?.hits))throw Error('Búsqueda de Eneba no disponible');
 const items=result.hits.flatMap(p=>{
  const title=p.translations?.es?.name||p.translations?.en_US?.name||'';
  if(!p.stockAvailable||p.productType!=='game'||/random|try to get|account|cuenta/i.test(title))return [];
  const works=p.worksOn||[];
  if(platform==='xbox'&&!works.some(w=>/XBOX_ONE|XBOX_SERIES/.test(w)))return [];
  if(platform==='ps'&&!works.some(w=>/PS[345]|PLAYSTATION/.test(w)))return [];
  if(platform==='switch'&&!works.some(w=>/SWITCH|NINTENDO/.test(w)))return [];
  const amount=p.lowestPrice?.[currencies[region]],regular=p.msrp?.[currencies[region]];
  if(!Number.isFinite(amount))return [];
  const divisor=['JPY'].includes(currencies[region])?1:100;
  return [{id:p.slug,title,price:amount/divisor,regular:Number.isFinite(regular)?regular/divisor:null,discount:regular>amount?Math.round((1-amount/regular)*100):0,currency:currencies[region],edition:works.join(' / ')+' · '+p.productRegions.join(', '),store:'Eneba',kind:'external',image:p.images?.cover300?.src,url:'https://www.eneba.com/'+p.slug}];
 });
 return {items,next:result.page+1<result.nbPages?result.page+2:null,total:result.nbHits};
}
async function catalog(platform,region,q='',options={}){
 const {cursor={},onlyDeals=false,sort='relevance',source='all',discount=null}=options;
 const jobs=[source==='external'||cursor.official===false?null:({xbox,ps,switch:nintendo}[platform])(region,q,cursor.official,onlyDeals,sort,discount),source==='official'||cursor.external===false?null:external(platform,region,q,cursor.external,sort)];
 const result=await Promise.allSettled(jobs);
 const names=[{xbox:'Xbox Store',ps:'PlayStation Store',switch:'Nintendo eShop'}[platform],'Eneba'];
 const items=result.flatMap(r=>r.status==='fulfilled'&&r.value?r.value.items:[]);
 const next={official:false,external:false};
 const sources=result.map((r,i)=>{const value=r.status==='fulfilled'?r.value:null;if(value)next[i?'external':'official']=value.next??false;return {name:names[i],status:value?'ok':jobs[i]?'unavailable':'skipped',count:value?.items.length||0,total:value?.total,url:i?'https://www.eneba.com/store/'+({xbox:'xbox-games',ps:'psn-games',switch:'nintendo-games'}[platform]):platform==='xbox'?`https://www.xbox.com/${locales[region]}/games/all-games`:platform==='ps'?`https://store.playstation.com/${locales[region].toLowerCase()}/pages/browse`:`https://www.nintendo.com/${locales[region].toLowerCase()}/store/games/`};});
 return {platform,region,currency:currencies[region],items,sources,next:next.official!==false||next.external!==false?next:null,checkedAt:Date.now(),scope:'Resultados de búsqueda y catálogo de las tiendas. Orden y filtros sobre los productos cargados; los datos y la cobertura dependen de cada fuente.'+(result.some(r=>r.status==='fulfilled'&&r.value?.limited)?' Xbox limita la búsqueda a sus primeras coincidencias; prueba un nombre más específico.':'')};
}
module.exports={catalog};
