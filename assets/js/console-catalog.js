let consoleResult = null;
let consoleVisible = 60;
let consoleNext = {};
let consoleLoading = false;
function filteredConsoleItems() {
    if (!consoleResult) return [];
    const onlyDeals = queryConfig.onSale === '1';
    const kind = document.getElementById('consoleSource').value;
    const filter=getDiscountSettings('console');
    return consoleResult.items.filter(item => (kind === 'all' || item.kind === kind) && (!onlyDeals || item.discount > 0 && item.regular > item.price) && matchesDiscount(item.discount,filter));
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
        showLoader('Buscando en los catálogos de esta plataforma…');
    } else consoleVisible += 60;
    updateScopeNote();
    const generation = catalogGeneration;
    const platform = activeEcosystem;
    const region = currentRegion;
    const query = currentSearchQuery;
    const controller = new AbortController();
    catalogController = controller;
    consoleLoading = true;
    loadMoreBtn.disabled = true;
    const ratingOption = document.querySelector('#consoleOrder option[value="rating"]');
    ratingOption.disabled = platform !== 'xbox';
    ratingOption.textContent = platform === 'xbox' ? 'Mejores reseñas disponibles' : 'Reseñas no disponibles en esta fuente';
    if (platform !== 'xbox' && document.getElementById('consoleOrder').value === 'rating') document.getElementById('consoleOrder').value = 'relevance';
    const source = document.getElementById('consoleSource').value;
    const onlyDeals = queryConfig.onSale === '1';
    if (!onlyDeals && document.getElementById('consoleOrder').value.startsWith('discount')) document.getElementById('consoleOrder').value = 'relevance';
    const sort = document.getElementById('consoleOrder').value;
    document.querySelector('#consoleOrder option[value="discountAsc"]').disabled = !onlyDeals;
    document.querySelector('#consoleOrder option[value="discountDesc"]').disabled = !onlyDeals;
    document.getElementById('consoleTools').classList.remove('hidden-el');
    document.getElementById('catalogError').classList.add('hidden-el');
    loadMoreContainer.classList.add('hidden-el');
    sortContainer.classList.add('hidden-el');
    setHeaderInfo(`${ECOSYSTEM_META[platform].name} · ${purchaseRegions[region][0]}${query ? ' · ' + query : ''}`, 'Busca juegos con o sin oferta. Mostramos hasta 60 resultados por carga.', 'fa-gamepad', 'sky');
    try {
        let scans = 0;const scanStarted=Date.now();
        while (consoleNext !== null && filteredConsoleItems().length < consoleVisible && scans++ < 3 && Date.now()-scanStarted<12000) {
            const params = new URLSearchParams({ platform, region, q: query, source, sort, deals: onlyDeals ? '1' : '0', cursor: JSON.stringify(consoleNext) });
            if(discountFilter.mode!=='any'){params.set('discountMin',String(discountFilter.min));params.set('discountMax',String(discountFilter.max));}
            const result = await requestJSON(`/api/console-catalog?${params}`, { signal: controller.signal, timeout: Math.max(1,12000-(Date.now()-scanStarted)) });
            if (generation !== catalogGeneration || platform !== activeEcosystem || region !== currentRegion) return;
            if (!Array.isArray(result.items)) throw Error('Respuesta inválida');
            if (!consoleResult) consoleResult = { ...result, items: [] };
            const seen = new Set(consoleResult.items.map(item => item.store + ':' + item.id));
            const added = result.items.filter(item => { const key = item.store + ':' + item.id; if (seen.has(key)) return false; seen.add(key); return true; });
            consoleResult.items.push(...added);
            consoleResult.sources = result.sources;
            consoleResult.checkedAt = result.checkedAt;
            consoleNext = result.next || null;
            loadingText.textContent=`Buscando en tiendas oficiales y externas… ${scans} lote(s) revisados, ${filteredConsoleItems().length} coincidencias.`;
            if(consoleNext && JSON.stringify(consoleNext)===params.get('cursor')){consoleResult.scope+=' La fuente repitió su página; consulta incompleta.';break;}
        }
        if (generation !== catalogGeneration) return;
        hideLoader();
        renderConsoleCatalog();
    } catch (error) {
        if (generation !== catalogGeneration || controller.signal.aborted) return;
        hideLoader();
        showCatalogError('No se pudo completar la consulta. Puedes reintentar; conservamos los resultados recuperados.');
        if (consoleResult) renderConsoleCatalog();
    } finally {
        if (generation === catalogGeneration) { consoleLoading = false; loadMoreBtn.disabled = false; }
    }
}
function renderConsoleCatalog() {
    if (!consoleResult || consoleResult.platform !== activeEcosystem || consoleResult.region !== currentRegion) return;
    const { items, sources, scope, checkedAt } = consoleResult;
    const kind = document.getElementById('consoleSource').value;
    const onlyDeals = queryConfig.onSale === '1';
    const filtered = filteredConsoleItems();
    const order = document.getElementById('consoleOrder').value;
    const sorters = { priceAsc: (a,b) => a.price-b.price, priceDesc:(a,b)=>b.price-a.price, discountAsc:(a,b)=>a.discount-b.discount, discountDesc:(a,b)=>b.discount-a.discount, rating:(a,b)=>(b.rating ?? -1)-(a.rating ?? -1) || (b.ratingCount||0)-(a.ratingCount||0) };
    if (sorters[order]) filtered.sort(sorters[order]);
    const visible = filtered.slice(0, consoleVisible);
    paginationInfo.textContent = `Mostrando ${visible.length} de ${filtered.length} coincidencias cargadas${consoleNext ? ' · hay más páginas por consultar' : ''}`;
    loadMoreContainer.classList.toggle('hidden-el', !(filtered.length > consoleVisible || consoleNext));
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
    gamesGrid.replaceChildren();
    const fragment = document.createDocumentFragment();
    visible.forEach(item => {
        item.checkedAt=checkedAt;
        const format = value => new Intl.NumberFormat('es-MX', { style:'currency', currency:item.currency }).format(value);
        const card = document.createElement('article');
        card.className = 'steam-card console-card';
        const platform=ECOSYSTEM_META[activeEcosystem];
        const displayDiscount=Math.round(Number(item.discount)||0);
        card.innerHTML = `<div class="console-art"><img class="console-art-backdrop" src="${escapeHTML(safeURL(item.image))}" alt="" aria-hidden="true" loading="lazy"><img class="console-art-cover" src="${escapeHTML(safeURL(item.image))}" alt="${escapeHTML(item.title)}" loading="lazy"><div class="console-art-shade"></div><div class="console-card-badges"><span class="platform-tag"><i class="${platform.icon}"></i> ${escapeHTML(activeEcosystem==='switch'?'Nintendo':activeEcosystem==='ps'?'PlayStation':'Xbox')}</span><span class="source-tag ${item.kind==='official'?'source-official':'source-market'}">${item.kind==='official'?'Oficial':'Mercado externo'}</span></div>${item.discount>0&&item.regular>item.price?`<span class="console-discount-badge">-${displayDiscount}%</span>`:'<span class="console-regular-badge">Precio sin rebaja comprobada</span>'}${Number.isFinite(item.rating)&&item.ratingCount>0?`<span class="console-rating-badge">★ ${escapeHTML(item.rating)}/5</span>`:''}</div><div class="console-card-body"><p class="console-store">${escapeHTML(item.store)}</p><h3>${escapeHTML(item.title)}</h3><p class="console-edition" title="${escapeHTML(item.edition)}">${escapeHTML(item.edition)}</p>${item.seller?`<p>Vendedor: ${escapeHTML(item.seller)}</p>`:''}<div class="console-price"><div><small>${item.regular>item.price?'Antes':'Precio publicado'}</small>${item.regular>item.price?`<del>${escapeHTML(format(item.regular))}</del>`:''}</div><strong>${escapeHTML(format(item.price))} <small>${escapeHTML(item.currency)}</small></strong></div><div class="console-card-actions"><a class="console-buy" href="${escapeHTML(safeURL(item.url))}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> ${item.kind==='official'?'Tienda oficial':'Ver tienda'}</a></div></div>`;
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
        prepareImages(card); fragment.appendChild(card);
    });
    gamesGrid.appendChild(fragment);
    refreshConsoleHearts();
    loadedCountBadge.textContent = visible.length;
    const unavailable=sources.some(s=>s.status==='unavailable');
    emptyState.classList.toggle('hidden-el', filtered.length > 0 || !!consoleNext || unavailable);
    if(!filtered.length&&unavailable)showCatalogError('Una tienda no pudo responder. La consulta está incompleta; reintenta para comprobar sus ofertas.');
    if (!filtered.length) document.getElementById('consoleScope').textContent += ' No hay coincidencias con estos filtros en las páginas cargadas. Prueba Catálogo completo, cambia el porcentaje o carga más resultados.';
}
