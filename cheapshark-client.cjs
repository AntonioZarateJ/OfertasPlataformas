// Un solo acceso al proveedor por servidor: caché, cola corta y pausa ante 429.
function createCheapSharkClient(fetchImpl, { spacing=650, now=Date.now, sleep=ms=>new Promise(r=>setTimeout(r,ms)) }={}) {
 const cache=new Map(),pending=new Map();
 let queue=Promise.resolve(),last=0,cooldown=0,queued=0;
 function limited(seconds){return Response.json({error:'La tienda pidió una pausa',retryAfter:seconds},{status:429,headers:{'Retry-After':String(seconds)}});}
 return async function request(input,options={}){
  const url=new URL(input);url.searchParams.sort();const key=url.href;
  if(cache.get(key)?.expires>now())return cache.get(key).response.clone();
  if(pending.has(key))return (await pending.get(key)).clone();
  if(cooldown>now())return limited(Math.ceil((cooldown-now())/1000));
  if(queued>=12)return limited(3);
  queued++;
  const work=queue.catch(()=>{}).then(async()=>{
   if(cooldown>now())return limited(Math.ceil((cooldown-now())/1000));
   options.signal?.throwIfAborted();
   const wait=Math.max(0,last+spacing-now());if(wait)await sleep(wait);
   options.signal?.throwIfAborted();last=now();
   const response=await fetchImpl(url.href,options);
   if(response.status===429){
    const seconds=Number(response.headers.get('Retry-After'))||Math.ceil((Date.parse(response.headers.get('Retry-After'))-now())/1000)||30;
    cooldown=now()+Math.min(300,Math.max(3,seconds))*1000;
    return limited(Math.ceil((cooldown-now())/1000));
   }
   if(response.ok){
    if(cache.size>=300)cache.delete(cache.keys().next().value);
    const snapshot=new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});
    cache.set(key,{response:snapshot.clone(),expires:now()+60000});
    return snapshot;
   }
   return response;
  }).finally(()=>{queued--;pending.delete(key);});
  queue=work;pending.set(key,work);
  return (await work).clone();
 };
}
module.exports={createCheapSharkClient};
