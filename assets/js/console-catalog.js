let consoleResult = null;
let consoleVisible = 60;
let consoleNext = {};
let consoleLoading = false;
// El orden remoto pertenece a la consulta y su cursor. El orden visual puede
// cambiar sin reiniciar ni mezclar páginas obtenidas con distintos órdenes.
let consoleFetchSort = 'relevance';
function changeConsoleOrder() {
    if (consoleResult) renderConsoleCatalog();
}
function filteredConsoleItems() {
    if (!consoleResult) return [];
    const onlyDeals = queryConfig.onSale === '1';
    const android = activeEcosystem === 'android';
    const kind = android ? 'official' : document.getElementById('consoleSource').value;
    const type = android ? document.getElementById('androidType').value : 'all';
    const price = android ? document.getElementById('androidPrice').value : 'all';
    const filter=getDiscountSettings('console');
    return consoleResult.items.filter(item => (kind === 'all' || item.kind === kind) &&
        (type === 'all' || item.appType === type) && (price === 'all' || (price === 'free' ? item.price === 0 : item.price > 0)) &&
        (!onlyDeals || item.discount > 0 && item.regular > item.price) && matchesDiscount(android ? Math.round(item.discount) : item.discount,filter));
}
async function loadConsoleCatalog(reset = true) {
    if (!reset && consoleLoading) return;
    const discountFilter=updateDiscountControls('console');if(!discountFilter.valid)return;
    if (reset) {
        cancelCatalogRequest();
        consoleVisible = 60;
        consoleNext = {};
        consoleResult = null;
        gamesGrid.replaceChildren();
        loadedCountBadge.textContent = '0';
        emptyState.classList.add('hidden-el');
        document.getElementById('androidEmptyState').classList.add('hidden-el');
        showLoader('Buscando en los catálogos de esta plataforma…');
    } else consoleVisible += 60;
    updateScopeNote();
    const generation = catalogGeneration;
    const platform = activeEcosystem;
    const android = platform === 'android';
    const region = currentRegion;
    const query = currentSearchQuery;
    const controller = new AbortController();
    catalogController = controller;
    consoleLoading = true;
    loadMoreBtn.disabled = true;
    const ratingOption = document.querySelector('#consoleOrder option[value="rating"]');
    const hasRatings = platform === 'xbox' || android;
    ratingOption.disabled = !hasRatings;
    ratingOption.textContent = hasRatings ? 'Mejores reseñas disponibles' : 'Reseñas no disponibles en esta fuente';
    if (!hasRatings && document.getElementById('consoleOrder').value === 'rating') document.getElementById('consoleOrder').value = 'relevance';
    const source = android ? 'official' : document.getElementById('consoleSource').value;
    document.getElementById('consoleFiltersCaption').hidden = android;
    document.getElementById('consoleFiltersTitle').textContent = android ? 'Filtros de Google Play' : 'Tu plataforma, tus preferencias';
    document.getElementById('consoleOrderHint').textContent = android ? 'Ordena la selección al instante.' : 'Ordena los juegos cargados al instante. Cargar más amplía la lista.';
    document.getElementById('consoleSourceField').classList.toggle('hidden-el',android);
    document.getElementById('androidFilters').classList.toggle('hidden-el',!android);
    const storeSearch = document.getElementById('androidStoreSearch');
    storeSearch.classList.toggle('hidden-el',!android);
    if (android) {
        const search = new URL(query ? '/store/search' : '/store','https://play.google.com');
        search.search = new URLSearchParams({hl:'es',gl:region,...(query?{q:query,c:'apps'}:{})});
        storeSearch.href = search.href;
        storeSearch.textContent = query ? 'Buscar en todo Google Play ↗' : 'Ver todo Google Play ↗';
        const emptyStore = document.getElementById('androidEmptyStore');
        emptyStore.href = storeSearch.href;
        emptyStore.textContent = storeSearch.textContent;
    }
    const onlyDeals = queryConfig.onSale === '1';
    if (!onlyDeals && document.getElementById('consoleOrder').value.startsWith('discount')) document.getElementById('consoleOrder').value = 'relevance';
    if (reset) consoleFetchSort = document.getElementById('consoleOrder').value;
    const sort = consoleFetchSort;
    document.querySelector('#consoleOrder option[value="discountAsc"]').disabled = !onlyDeals;
    document.querySelector('#consoleOrder option[value="discountDesc"]').disabled = !onlyDeals;
    document.getElementById('consoleTools').classList.remove('hidden-el');
    document.getElementById('catalogError').classList.add('hidden-el');catalogNotice();
    loadMoreContainer.classList.add('hidden-el');
    sortContainer.classList.add('hidden-el');
    setHeaderInfo(`${ECOSYSTEM_META[platform].name} · ${purchaseRegions[region][0]}${query ? ' · ' + query : ''}`,
        android ? 'Juegos y aplicaciones con precios de Google Play web.' : 'Busca juegos con o sin oferta. Mostramos hasta 60 resultados por carga.', 'fa-gamepad', 'sky');
    try {
        let scans = 0,sourceRetries=0;const scanStarted=Date.now();const deadline=scanStarted+45000;
        showLoader('Comparando precios de esta plataforma…');
        while (consoleNext !== null && filteredConsoleItems().length < consoleVisible && scans++ < 240 && Date.now()<deadline) {
            const params = new URLSearchParams({ platform, region, q: query, source, sort, deals: onlyDeals ? '1' : '0', cursor: JSON.stringify(consoleNext) });
            if(!android&&discountFilter.mode!=='any'){params.set('discountMin',String(discountFilter.min));params.set('discountMax',String(discountFilter.max));}
            const result = await catalogJSON(`/api/console-catalog?${params}`, { signal: controller.signal, timeout:16000,ttl:0,deadline });
            if (generation !== catalogGeneration || platform !== activeEcosystem || region !== currentRegion) return;
            if(!android&&result.sources?.some(s=>s.status==='unavailable')&&sourceRetries++<2){await catalogPause(2000,controller.signal);continue;}
            sourceRetries=0;
            if (!Array.isArray(result.items)) throw Error('Respuesta inválida');
            if (!consoleResult) consoleResult = { ...result, items: [] };
            const seen = new Set(consoleResult.items.map(item => item.store + ':' + item.id));
            const added = result.items.filter(item => { const key = item.store + ':' + item.id; if (seen.has(key)) return false; seen.add(key); return true; });
            consoleResult.items.push(...added);
            consoleResult.sources = result.sources;
            consoleResult.checkedAt = result.checkedAt;
            consoleResult.partial ||= result.partial;
            consoleNext = result.next || null;
            if (android) break;
            if(consoleNext&&filteredConsoleItems().length<consoleVisible)await catalogPause(900,controller.signal);
            if(consoleNext && JSON.stringify(consoleNext)===params.get('cursor')){consoleResult.scope+=' La fuente repitió su página; consulta incompleta.';consoleNext=null;break;}
        }
        if (generation !== catalogGeneration) return;
        hideLoader();
        renderConsoleCatalog();
        if (android && consoleResult?.partial && consoleResult.items.length) catalogNotice('Algunas fichas de Google Play no devolvieron precio en esta región.');
    } catch (error) {
        if (generation !== catalogGeneration || controller.signal.aborted) return;
        hideLoader();
        if(consoleResult?.items.length)catalogNotice('Mostramos los precios confirmados. Una tienda no pudo completar su consulta.');else showCatalogError('La tienda sigue sin responder tras varios intentos. Puedes reintentar.');
        if (consoleResult) renderConsoleCatalog();
    } finally {
        if (generation === catalogGeneration) { consoleLoading = false; loadMoreBtn.disabled = false; }
    }
}
function renderConsoleCatalog() {
    if (!consoleResult || consoleResult.platform !== activeEcosystem || consoleResult.region !== currentRegion) return;
    const { items, sources, scope, checkedAt } = consoleResult;
    const onlyDeals = queryConfig.onSale === '1';
    const filtered = filteredConsoleItems();
    const order = document.getElementById('consoleOrder').value;
    const sorters = { priceAsc: (a,b) => a.price-b.price, priceDesc:(a,b)=>b.price-a.price, discountAsc:(a,b)=>a.discount-b.discount, discountDesc:(a,b)=>b.discount-a.discount, rating:(a,b)=>(b.rating ?? -1)-(a.rating ?? -1) || (b.ratingCount||0)-(a.ratingCount||0) };
    if (sorters[order]) filtered.sort(sorters[order]);
    const visible = filtered.slice(0, consoleVisible);
    paginationInfo.textContent = `Mostrando ${visible.length} de ${filtered.length} coincidencias cargadas${consoleNext ? ' · hay más páginas por consultar' : ''}`;
    loadMoreContainer.classList.toggle('hidden-el', !(filtered.length > consoleVisible || consoleNext));
    updateCatalogEndStatus(!!(filtered.length > consoleVisible || consoleNext) || sources.some(s=>s.status==='unavailable'),visible.length);
    document.getElementById('consoleScope').textContent = '';

    document.getElementById('consoleScope').textContent = `${scope} Consulta: ${new Date(checkedAt).toLocaleTimeString('es-MX')}. Importes en la moneda publicada por cada tienda.`;
    const status = document.getElementById('consoleSources');
    status.replaceChildren();
    sources.filter(source => source.status !== 'skipped').forEach(source => {
        const link = document.createElement('a');
        link.href = safeURL(source.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = `${source.name}: ${source.status === 'ok' ? source.count + ' en última página' + (source.total ? ' · ' + source.total + ' disponibles' : '') : 'sin datos disponibles'} ↗`;
        status.appendChild(link);
    });
    const existingCards = new Map([...gamesGrid.children].map(card => [card.dataset.consoleKey, card]));
    const orderedCards = [];
    visible.forEach(item => {
        item.checkedAt=activeEcosystem === 'android' ? item.checkedAt ?? checkedAt : checkedAt;
        const key = [activeEcosystem,currentRegion,item.store,item.id].join(':');
        const signature = JSON.stringify([item.title,item.price,item.regular,item.discount,item.currency,item.edition,item.image,item.imageAlternatives,item.url,item.seller,item.rating,item.ratingCount,item.kind]);
        const existing = existingCards.get(key);
        if(existing?.dataset.quoteSignature === signature){orderedCards.push(existing);return;}
        const format = value => new Intl.NumberFormat('es-MX', { style:'currency', currency:item.currency }).format(value);
        const card = document.createElement('article');
        card.dataset.consoleKey = key; card.dataset.quoteSignature = signature;
        card.className = 'steam-card console-card';
        const platform=ECOSYSTEM_META[activeEcosystem];
        const displayDiscount=Math.round(Number(item.discount)||0);
        const freeDownload = activeEcosystem === 'android' && item.price === 0;
        card.innerHTML = `<div class="console-art"><img class="console-art-backdrop" src="${escapeHTML(safeURL(item.image))}" alt="" aria-hidden="true" loading="lazy"><img class="console-art-cover" src="${escapeHTML(safeURL(item.image))}" alt="${escapeHTML(item.title)}" loading="lazy"><div class="console-art-shade"></div><div class="console-card-badges"><span class="platform-tag"><i class="${platform.icon}"></i> ${escapeHTML(activeEcosystem==='switch'?'Nintendo':activeEcosystem==='ps'?'PlayStation':activeEcosystem==='android'?'Android':'Xbox')}</span><span class="source-tag ${item.kind==='official'?'source-official':'source-market'}">${item.kind==='official'?'Oficial':'Mercado externo'}</span></div>${item.discount>0&&item.regular>item.price?`<span class="console-discount-badge">-${displayDiscount}%</span>`:'<span class="console-regular-badge">Precio sin rebaja comprobada</span>'}${Number.isFinite(item.rating)&&item.ratingCount>0?`<span class="console-rating-badge">★ ${escapeHTML(item.rating)}/5</span>`:''}</div><div class="console-card-body"><p class="console-store">${escapeHTML(item.store)}</p><h3>${escapeHTML(item.title)}</h3><p class="console-edition" title="${escapeHTML(item.edition)}">${escapeHTML(item.edition)}</p>${item.seller?`<p>Vendedor: ${escapeHTML(item.seller)}</p>`:''}<div class="console-price"><div><small>${item.regular>item.price?(item.observedDrop?'Antes observado':'Antes'):'Precio publicado'}</small>${item.regular>item.price?`<del>${escapeHTML(format(item.regular))}</del>`:''}</div><strong>${freeDownload ? 'Gratis' : `${escapeHTML(format(item.price))} <small>${escapeHTML(item.currency)}</small>`}</strong></div><div class="console-card-actions"><a class="console-buy" href="${escapeHTML(safeURL(item.url))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> ${item.kind==='official'?'Tienda oficial':'Ver tienda'}</a></div></div>`;
        const favorite=document.createElement('button');
        favorite.type='button';favorite.className='console-heart console-card-heart';
        favorite.dataset.consoleWish=consoleWishKey(item);
        favorite.onclick=event=>{event.stopPropagation();saveConsoleWish(item,activeEcosystem,currentRegion);};
        card.querySelector('.console-art').appendChild(favorite);
        const compare=document.createElement('button');
        compare.type='button';compare.className='console-compare';compare.innerHTML='<i class="fa-solid fa-scale-balanced"></i> Comparar opciones';
        compare.addEventListener('click',()=>openConsoleComparison(item));
        card.querySelector('.console-card-actions').prepend(compare);
        card.querySelector('.console-art').addEventListener('click',()=>openConsoleComparison(item));
        card.querySelector('h3').addEventListener('click',()=>openConsoleComparison(item));
        card.querySelectorAll('img').forEach(img => setGameArtwork(img,item));
        orderedCards.push(card);
    });
    const wanted = new Set(orderedCards);
    for(const card of [...gamesGrid.children])if(!wanted.has(card))card.remove();
    let cursor = gamesGrid.firstElementChild;
    for(const card of orderedCards){if(card!==cursor)gamesGrid.insertBefore(card,cursor);cursor=card.nextElementSibling;}
    refreshConsoleHearts();
    loadedCountBadge.textContent = visible.length;
    const unavailable=sources.some(s=>s.status==='unavailable');
    const android = activeEcosystem === 'android';
    const empty = !filtered.length && !consoleNext && !unavailable;
    emptyState.classList.toggle('hidden-el', android || !empty);
    const androidEmpty = android && !filtered.length && !unavailable;
    document.getElementById('androidEmptyState').classList.toggle('hidden-el', !androidEmpty);
    if (androidEmpty) {
        document.getElementById('androidEmptyTitle').textContent = onlyDeals ? 'Sin rebajas web verificadas en esta consulta' : 'Sin coincidencias en los resultados consultados';
        document.getElementById('androidEmptyHint').textContent = onlyDeals ? 'La app de Play Store puede mostrar ofertas distintas para tu cuenta o dispositivo.' :
            consoleNext ? 'Carga más resultados o cambia los filtros.' : 'Cambia los filtros o busca directamente en Google Play.';
    }
    if(!filtered.length&&unavailable)showCatalogError('Una tienda no pudo responder. La consulta está incompleta; reintenta para comprobar sus ofertas.');
    if (!android && !filtered.length) document.getElementById('consoleScope').textContent += ' No hay coincidencias con estos filtros en las páginas cargadas. Prueba Catálogo completo, cambia el porcentaje o carga más resultados.';
    syncCatalogBatchView();
}
