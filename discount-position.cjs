// CheapShark: desc=0 ordena Savings de mayor a menor; desc=1 lo invierte.
// Localizar el tramo evita descargar cientos de páginas antes de llegar al 20%.
async function discountPosition(params, fetchImpl=fetch) {
    const target=Number(params.get('discount')),ascending=params.get('desc')==='1';
    if(!Number.isInteger(target)||target<0||target>100)throw Error('Porcentaje inválido');
    const base=new URL('https://www.cheapshark.com/api/1.0/deals');
    for(const key of ['title','onSale','steamRating','AAA'])if(params.has(key))base.searchParams.set(key,params.get(key));
    base.searchParams.set('pageSize','60');base.searchParams.set('sortBy','Savings');base.searchParams.set('desc',ascending?'1':'0');
    async function page(index){
        const url=new URL(base);url.searchParams.set('pageNumber',String(index));
        const r=await fetchImpl(url.href,{headers:{'User-Agent':'SteamPulsePro/1.0 (game price comparison application)'},signal:AbortSignal.timeout(6500)});
        if(!r.ok){const error=Error('Proveedor no disponible');error.upstreamStatus=r.status;throw error;}
        const rows=await r.json();if(!Array.isArray(rows))throw Error('Respuesta inválida');
        return {rows,total:Number(r.headers.get('X-Total-Page-Count'))};
    }
    const first=await page(0);
    const crosses=rows=>!rows.length||(ascending?Math.round(Number(rows.at(-1).savings))>=target:Math.round(Number(rows.at(-1).savings))<=target);
    if(crosses(first.rows))return {page:0};
    // El encabezado puede estar limitado a 50 aunque existan más páginas.
    let low=0,high=Math.max(1,Math.min(first.total||50,10000));
    while(!crosses((await page(high)).rows)){
        low=high;
        if(high>=10000)return {page:0};
        high=Math.min(high*2,10000);
    }
    while(low<high){
        const mid=Math.floor((low+high)/2),{rows}=await page(mid);
        if(crosses(rows))high=mid;
        else low=mid+1;
    }
    return {page:Math.max(0,low-1)};
}
module.exports={discountPosition};
