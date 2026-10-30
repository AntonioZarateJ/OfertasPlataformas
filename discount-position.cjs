// Búsqueda reanudable: nunca cae a un barrido de cientos de páginas.
async function discountPosition(params, fetchImpl=fetch, state={}, {maxRequests=4,budgetMs=8000}={}) {
    const target=Number(params.get('discount')),ascending=params.get('desc')==='1';
    if(!Number.isInteger(target)||target<0||target>100)throw Error('Porcentaje inválido');
    const base=new URL('https://www.cheapshark.com/api/1.0/deals');
    for(const key of ['storeID','title','onSale','steamRating','AAA'])if(params.has(key))base.searchParams.set(key,params.get(key));
    base.searchParams.set('pageSize','60');base.searchParams.set('sortBy','Savings');base.searchParams.set('desc',ascending?'1':'0');
    const started=Date.now();let requests=0;
    const crosses=rows=>!rows.length||(ascending?Math.round(Number(rows.at(-1).savings))>=target:Math.round(Number(rows.at(-1).savings))<=target);
    async function page(index){
        const url=new URL(base);url.searchParams.set('pageNumber',String(index));requests++;
        const r=await fetchImpl(url.href,{headers:{'User-Agent':'SteamPulsePro/1.0 (game price comparison application)'},signal:AbortSignal.timeout(Math.max(1,Math.min(6000,budgetMs-(Date.now()-started))))});
        if(r.status===400&&index>0){state.limitIndex=Math.min(state.limitIndex??Infinity,index);return {rows:[],total:0};}
        if(!r.ok){const error=Error('Proveedor no disponible');error.upstreamStatus=r.status;error.retryAfter=Number(r.headers.get('Retry-After'))||0;throw error;}
        const rows=await r.json();if(!Array.isArray(rows))throw Error('Respuesta inválida');
        state.reviewed=(state.reviewed||0)+1;
        return {rows,total:Number(r.headers.get('X-Total-Page-Count'))};
    }
    if(state.page!==undefined)return {page:state.page};
    try{
    while(requests<maxRequests&&Date.now()-started<budgetMs){
        if(!state.phase){
            const first=await page(0);
            if(crosses(first.rows)){state.page=0;return {page:0};}
            state.low=0;state.high=Math.max(1,Math.min(first.total||50,10000));state.phase='expand';
        }else if(state.phase==='expand'){
            const result=await page(state.high);
            if(crosses(result.rows))state.phase='binary';
            else{
                state.low=state.high;
                if(state.high>=10000)return {page:null,pending:true,limited:true,reviewed:state.reviewed};
                state.high=Math.min(state.high*2,10000);
            }
        }else{
            if(state.low>=state.high){if(state.low>=(state.limitIndex??Infinity))return {page:null,limited:true,pending:false};state.page=Math.max(0,state.low-1);return {page:state.page};}
            const mid=Math.floor((state.low+state.high)/2),{rows}=await page(mid);
            if(crosses(rows))state.high=mid;else state.low=mid+1;
        }
    }
    }catch(error){if(['TimeoutError','AbortError'].includes(error.name))return {page:null,pending:true,slow:true,reviewed:state.reviewed||0};throw error;}
    if(state.phase==='binary'&&state.low>=state.high){if(state.low>=(state.limitIndex??Infinity))return {page:null,limited:true,pending:false};state.page=Math.max(0,state.low-1);return {page:state.page};}
    return {page:null,pending:true,reviewed:state.reviewed||0};
}
module.exports={discountPosition};
