const fs=require('node:fs/promises');
const path=require('node:path');
const { consoleCatalog }=require('./console-sources.cjs');
const {loadNintendoVariants}=require('./nintendo-variants.cjs');
const registry=new Map();
function rememberCatalog(data){
 for(const item of data.items||[]) registry.set([data.platform,data.region,item.store,item.id].join('|'),{...item,checkedAt:data.checkedAt});
 while(registry.size>5000)registry.delete(registry.keys().next().value);
}
function signature(title){
 return String(title).normalize('NFD').replace(/[\u0300-\u036f™®]/g,'').toLowerCase()
 .replace(/xbox\s*(series\s*x\s*[|/]?\s*s|one|live|x\s*[|/]\s*s)?|playstation\s*[345]?|ps[345]|psn|nintendo\s*switch\s*2?|steam|pc|windows|global|latam|mexico|europe|united states|united kingdom|key|codigo|clave/gi,' ')
 .replace(/[^a-z0-9]+/g,' ').replace(/\bstandard edition\b/g,' ').replace(/\s+/g,' ').trim();
}
function createHistory(file=process.env.PRICE_HISTORY_PATH||path.join(__dirname,'.data','price-history.json')){
 let data=null,queue=Promise.resolve();
 return async function record(key,quotes,now=Date.now()){
  const run=async()=>{
   if(!data){try{data=JSON.parse(await fs.readFile(file,'utf8'));}catch{data={};}}
   const date=new Date(now).toISOString().slice(0,10);
   const result=quotes.map(quote=>{
    const id=JSON.stringify([key,quote.store,quote.id,quote.currency]);
    const days=data[id]||[];
    let day=days.find(d=>d.date===date);
    if(!day){day={date,min:quote.price,max:quote.price};days.push(day);}
    else{day.min=Math.min(day.min,quote.price);day.max=Math.max(day.max,quote.price);}
    data[id]=days.slice(-90);
    return {...quote,history:{min:Math.min(...data[id].map(d=>d.min)),max:Math.max(...data[id].map(d=>d.max)),days:data[id].length,since:data[id][0].date,scope:'Precios observados por esta web; no es un histórico completo del mercado.'}};
   });
   const keys=Object.keys(data);for(const id of keys.slice(0,Math.max(0,keys.length-3000)))delete data[id];
   try{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(data));await fs.rename(file+'.tmp',file);}catch{result.forEach(q=>q.history.persistent=false);}
   return result;
  };
  const work=queue.then(run,run);queue=work.catch(()=>{});return work;
 };
}
const record=createHistory();
async function compareGame(platform,region,title,id,store,{catalog=consoleCatalog,variantsLoader=loadNintendoVariants,recordPrices=record}={}){
 const selected=registry.get([platform,region,store,id].join('|'));
 const canonical=signature(title);
 const familyTitle=canonical.replace(/\b(ultimate|deluxe|gold|goty|complete|definitive|definitiva|edicion|edition|standard|coleccion|collection)\b/g,' ').replace(/\s+/g,' ').trim();
 const variantRequest=platform==='switch'&&selected?.kind==='official'?variantsLoader(selected,region).catch(()=>null):null;
 const result=await catalog(platform,region,familyTitle||canonical,{source:'all',onlyDeals:false});
 const candidates=[...result.items];
 if(selected&&Date.now()-selected.checkedAt<60000&&!candidates.some(q=>q.id===selected.id&&q.store===selected.store))candidates.push(selected);
let variants=variantRequest?await variantRequest:null;
 const chosen=selected||candidates.find(q=>String(q.id)===String(id)&&q.store===store);
 if(platform==='switch'&&!variantRequest){
  const official=chosen?.kind==='official'?chosen:candidates.find(q=>q.kind==='official'&&signature(q.title)===canonical);
  if(official)variants=await variantsLoader(official,region).catch(()=>null);
 }
 if(variants)candidates.unshift(...variants);
 const seen=new Set();
 const valid=candidates.filter(q=>{
  const key=q.store+'|'+q.id;
  if(seen.has(key)||!Number.isFinite(q.price)||q.price<0||/random|try to get|account|cuenta/i.test(q.title))return false;
  seen.add(key);return true;
 });
 // Switch y Switch 2 no forman una misma oferta, aunque compartan título.
 const hardware=edition=>/switch[ _]*2/i.test(edition||'')?'switch2':/switch/i.test(edition||'')?'switch':null;
 const selectedHardware=platform==='switch'?hardware(chosen?.edition):null;
 const exact=valid.filter(q=>signature(q.title)===canonical && (!selectedHardware || hardware(q.edition)===selectedHardware));
 const family=familyTitle||canonical;
 const editionSuffix=/^(?:(?:coleccion|collection|edicion|edition|deluxe|ultimate|gold|goty|complete|definitive|definitiva|standard|digital|bundle|pack)\s*)+$/;
 const sameFamily=q=>{const s=signature(q.title);return s===family || s.startsWith(family+' ')&&editionSuffix.test(s.slice(family.length+1));};
 const linked=q=>(variants||[]).some(v=>v.id===q.id&&v.store===q.store);
 const otherEditions=valid.filter(q=>!exact.includes(q)&&(sameFamily(q)||linked(q))).slice(0,20);
 const editions=valid.filter(q=>q.kind==='official'&&(sameFamily(q)||linked(q))).map(q=>({...q,selected:exact.some(e=>e.id===q.id&&e.store===q.store),variantType:q.variantType||(signature(q.title)===family?'base':'edition')}));
 exact.sort((a,b)=>(a.kind==='official'?0:1)-(b.kind==='official'?0:1)||a.price-b.price);
 const offers=await recordPrices([platform,region,canonical].join('|'),exact);
 return {title,platform,region,checkedAt:Date.now(),offers,otherEditions,editions,editionsStatus:platform==='switch'?(variants?'ok':'unavailable'):'catalog',sources:result.sources,coverage:'Consultamos la tienda oficial y Eneba. Los demás enlaces son búsquedas externas sin precio verificado.',searchLinks:[
  {name:'G2A',url:'https://www.g2a.com/search?query='+encodeURIComponent(title+' '+({xbox:'Xbox',ps:'PlayStation',switch:'Nintendo Switch'}[platform]))},
  {name:'Eneba',url:'https://www.eneba.com/store/all?text='+encodeURIComponent(title+' '+({xbox:'Xbox',ps:'PSN',switch:'Nintendo Switch'}[platform]))},
  {name:'Kinguin',url:'https://www.kinguin.net/listing?phrase='+encodeURIComponent(title+' '+platform)},
  {name:'Instant Gaming',url:'https://www.instant-gaming.com/es/busquedas/?query='+encodeURIComponent(title+' '+platform)}]};
}
module.exports={rememberCatalog,signature,createHistory,compareGame};
