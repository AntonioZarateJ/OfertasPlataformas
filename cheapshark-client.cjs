const {BoundedCache}=require('./bounded-cache.cjs');
// Un solo acceso al proveedor por servidor: caché, cola corta y pausa ante 429.
function createCheapSharkClient(fetchImpl, { spacing=650, maxQueueWait=6000, now=Date.now, sleep=ms=>new Promise(r=>setTimeout(r,ms)) }={}) {
 const cache=new BoundedCache({maxEntries:300,maxBytes:24*1024*1024}),pending=new Map();
 let queue=Promise.resolve(),last=0,cooldown=0,queued=0;
 function limited(seconds){return Response.json({error:'La tienda pidió una pausa',retryAfter:seconds},{status:429,headers:{'Retry-After':String(seconds)}});}
 return async function request(input,options={}){
  const url=new URL(input);url.searchParams.sort();const key=url.href;
  if(cache.get(key)?.expires>now())return cache.get(key).response.clone();
  if(pending.has(key))return (await pending.get(key)).clone();
  if(cooldown>now())return limited(Math.ceil((cooldown-now())/1000));
  // Do not accept work whose minimum queue wait already exceeds the useful HTTP budget.
  // Keep the same provider spacing and hard queue bound; clients can retry after the queue drains.
  if(queued>=12||queued*spacing>maxQueueWait)return limited(Math.max(3,Math.ceil(queued*spacing/1000)));
  queued++;
  const work=queue.catch(()=>{}).then(async()=>{
   if(cooldown>now())return limited(Math.ceil((cooldown-now())/1000));
   options.signal?.throwIfAborted();
   const wait=Math.max(0,last+spacing-now());if(wait)await sleep(wait);
   options.signal?.throwIfAborted();last=now();
   const response=await fetchImpl(url.href,options);
   if(response.status===429){
    const raw=response.headers.get('Retry-After');
    const parsed=raw&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-now())/1000);
    const seconds=Number.isFinite(parsed)&&parsed>0?parsed:30;
    // Never shorten the store's requested pause, including pauses longer than five minutes.
    cooldown=Math.min(Number.MAX_SAFE_INTEGER,now()+Math.max(3,seconds)*1000);
    return limited(Math.ceil((cooldown-now())/1000));
   }
   if(response.ok){
    if(cache.size>=300)cache.delete(cache.keys().next().value);
    const body=await response.arrayBuffer();
    const snapshot=new Response(body,{status:response.status,headers:response.headers});
    cache.set(key,{response:snapshot.clone(),bytes:body.byteLength,expires:now()+60000});
    return snapshot;
   }
   return response;
  }).finally(()=>{queued--;pending.delete(key);});
  queue=work;pending.set(key,work);
  return (await work).clone();
 };
}
module.exports={createCheapSharkClient};
