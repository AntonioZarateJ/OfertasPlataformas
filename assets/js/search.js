function expandGameAlias(query) {
    const aliases = { 'gta v':'Grand Theft Auto V', 'gta 5':'Grand Theft Auto V', 'gta iv':'Grand Theft Auto IV', 'rdr2':'Red Dead Redemption 2', 'rdr 2':'Red Dead Redemption 2', 'cs2':'Counter-Strike 2', 'gow':'God of War', 'tlou':'The Last of Us', 're4':'Resident Evil 4' };
    return aliases[query.trim().toLowerCase().replace(/\s+/g,' ')] || query.trim();
}
let searchTimer = null;
let searchController = null;
let searchGeneration = 0;
let suggestionActions = [];
let selectedSuggestion = -1;
function cancelSuggestions() {
    clearTimeout(searchTimer); searchController?.abort(); searchGeneration++;
    suggestionActions = []; selectedSuggestion = -1;
    searchDropdown.classList.add('hidden-el');
    predictiveSearchInput.setAttribute('aria-expanded','false');
    predictiveSearchInput.removeAttribute('aria-activedescendant');
}
function revealSuggestions() {
    searchDropdown.classList.remove('hidden-el');
    predictiveSearchInput.setAttribute('aria-expanded','true');
}
function suggestionsMessage(message) {
    suggestionActions=[];selectedSuggestion=-1;
    predictiveSearchInput.removeAttribute('aria-activedescendant');
    searchDropdownContent.replaceChildren();
    const status = document.createElement('p');status.className='suggestion-status';status.setAttribute('role','status');status.textContent=message;
    searchDropdownContent.append(status);revealSuggestions();
}
function selectSuggestion(index) {
    const rows = searchDropdownContent.querySelectorAll('[role=option]');
    if(!rows.length)return;
    selectedSuggestion=(index+rows.length)%rows.length;
    rows.forEach((row,i)=>row.setAttribute('aria-selected',String(i===selectedSuggestion)));
    predictiveSearchInput.setAttribute('aria-activedescendant',rows[selectedSuggestion].id);
    rows[selectedSuggestion].scrollIntoView({block:'nearest'});
}
function appendSuggestion(row,action) {
    const index=suggestionActions.length;
    row.type='button';row.id=`suggestion-${searchGeneration}-${index}`;row.tabIndex=-1;
    row.setAttribute('role','option');row.setAttribute('aria-selected','false');
    row.addEventListener('click',()=>{cancelSuggestions();action();});
    row.addEventListener('mouseenter',()=>selectSuggestion(index));
    suggestionActions.push(action);searchDropdownContent.append(row);
}
predictiveSearchInput.addEventListener('input',event=>{
    cancelSuggestions();const query=event.target.value.trim();
    clearSearchBtn.classList.toggle('hidden-el',!query);
    if(query.length>=2)searchTimer=setTimeout(()=>fetchLiveSuggestions(query),activeEcosystem==='pc'?280:500);
});
predictiveSearchInput.addEventListener('keydown',event=>{
    if(searchDropdown.classList.contains('hidden-el'))return;
    if(['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();selectSuggestion(event.key==='ArrowDown'?selectedSuggestion+1:selectedSuggestion<0?-1:selectedSuggestion-1);
    }else if(event.key==='Enter'&&selectedSuggestion>=0){
        event.preventDefault();const action=suggestionActions[selectedSuggestion];cancelSuggestions();action?.();
    }else if(event.key==='Escape'){event.preventDefault();cancelSuggestions();}
    else if(event.key==='Tab')cancelSuggestions();
});
clearSearchBtn.addEventListener('click',()=>{
    cancelSuggestions();predictiveSearchInput.value='';currentSearchQuery='';
    clearSearchBtn.classList.add('hidden-el');
    if(activeChip==='search')selectSmartChip('top');
});
document.addEventListener('click',event=>{
    if(!searchDropdown.contains(event.target)&&event.target!==predictiveSearchInput)cancelSuggestions();
});
async function fetchLiveSuggestions(query) {
    const generation=searchGeneration,platform=activeEcosystem,region=currentRegion;
    searchController?.abort();const controller=new AbortController();searchController=controller;
    const current=()=>!controller.signal.aborted&&generation===searchGeneration&&platform===activeEcosystem&&region===currentRegion&&predictiveSearchInput.value.trim()===query;
    suggestionsMessage('Buscando juegos y ediciones…');
    try {
        let list,partial=false,more=false;
        if(platform==='pc'){
            list=await requestJSON(`${GAMES_API}?title=${encodeURIComponent(expandGameAlias(query))}&limit=6`,{signal:controller.signal});
            if(!Array.isArray(list))throw Error('Respuesta de búsqueda inválida');
        }else{
            // Una sola página, sin barridos ni filtros de descuento. La búsqueda
            // completa conserva la paginación y los filtros elegidos por el usuario.
            const params=new URLSearchParams({platform,region,q:expandGameAlias(query),source:'all',sort:'relevance',deals:'0',cursor:'{}'});
            const data=await requestJSON('/api/console-catalog?'+params,{signal:controller.signal,timeout:16000});
            if(data.platform!==platform||data.region!==region||!Array.isArray(data.items))throw Error('Respuesta de búsqueda inválida');
            partial=data.sources?.some(source=>source.status==='unavailable')||false;more=!!data.next;
            const seen=new Set();
            list=data.items.filter(item=>{
                const key=item.store+':'+item.id;
                if(seen.has(key)||typeof item.title!=='string'||item.currency!==purchaseRegions[region][1]||!Number.isFinite(item.price)||item.price<0)return false;
                seen.add(key);return true;
            }).sort((a,b)=>Number(b.kind==='official')-Number(a.kind==='official')).slice(0,8);
        }
        if(!current())return;
        searchDropdownContent.replaceChildren();suggestionActions=[];selectedSuggestion=-1;
        if(!list.length){
            const status=document.createElement('p');status.className='suggestion-status';
            status.textContent=partial?'La consulta está incompleta. Abre los resultados para reintentar.':more?'Hay más páginas por consultar. Abre los resultados para continuar.':'No hay coincidencias en esta consulta. Puedes abrir los resultados completos.';
            searchDropdownContent.append(status);
        }
        for(const item of list){
            const row=document.createElement('button');row.className='suggestion-row';
            const title=platform==='pc'?item.external:item.title;
            const detail=platform==='pc'?'PC · Comparar tiendas y versiones':`${item.store} · ${item.edition||ECOSYSTEM_META[platform].name}`;
            const price=platform==='pc'?formatPrice(item.cheapest,true):new Intl.NumberFormat('es-MX',{style:'currency',currency:item.currency,currencyDisplay:'narrowSymbol'}).format(item.price)+' '+item.currency;
            row.innerHTML=`<img alt="" width="72" height="45"><span class="suggestion-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></span><span class="suggestion-price"><b>${escapeHTML(price)}</b><small>${platform==='pc'?'Referencia convertida':escapeHTML(purchaseRegions[region][0])}</small></span>`;
            const game=platform==='pc'?{gameID:item.gameID,steamAppID:item.steamAppID,title:item.external,salePrice:item.cheapest,normalPrice:item.cheapest,thumb:item.thumb}:item;
            if(platform==='pc')setGameArtwork(row.querySelector('img'),{...game,artwork:item.steamAppID?`${STEAM_HEADER_IMG}${item.steamAppID}/header.jpg`:item.thumb});
            else setGameArtwork(row.querySelector('img'),item);
            appendSuggestion(row,()=>platform==='pc'?openAnalyticalModal(game):openConsoleComparison(item,platform,region));
        }
        const all=document.createElement('button');all.className='suggestion-all';all.textContent='Ver resultados y filtros para “'+query+'” →';
        appendSuggestion(all,()=>predictiveSearchInput.form.requestSubmit());
        if(partial){const note=document.createElement('p');note.className='suggestion-status';note.textContent='Una tienda no respondió. Mostramos las coincidencias recuperadas.';searchDropdownContent.append(note);}
        revealSuggestions();
    }catch(error){
        if(current())suggestionsMessage('No pudimos cargar la vista previa. Puedes buscar con Enter para reintentar.');
    }
}
function handleSearchSubmit(event) {
    event.preventDefault();const query=predictiveSearchInput.value.trim();if(!query)return;
    cancelSuggestions();activeChip='search';currentSearchQuery=expandGameAlias(query);
    if(activeEcosystem!=='pc'){
        queryConfig.onSale='0';updateScopeNote();sortContainer.classList.add('hidden-el');void loadConsoleCatalog();return;
    }
    document.querySelectorAll('.smart-chip').forEach(button=>button.classList.remove('active','active-free'));
    freeGamesSubBar.classList.add('hidden-el');sortContainer.classList.remove('hidden-el');
    queryConfig.onSale='0';updateScopeNote();queryConfig.minDiscount=0;queryConfig.maxPriceUsd=50;queryConfig.onlyAAA=false;
    setHeaderInfo(`🔎 Resultados para: "${query}"`,'Mostrando coincidencias con y sin descuento en tiendas oficiales y mercados de keys.','fa-magnifying-glass','sky');
    executeCatalogFetch(true);
}
