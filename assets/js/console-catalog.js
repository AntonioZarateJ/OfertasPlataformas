let consoleResult = null;
let consoleVisible = 60;
let consoleNext = {};
let consoleLoading = false;
function filteredConsoleItems() {
    if (!consoleResult) return [];
    const onlyDeals = document.getElementById('consoleOnlyDeals').checked;
    const kind = document.getElementById('consoleSource').value;
    const maxText = document.getElementById('consoleMaxPrice').value;
    const max = maxText === '' ? Infinity : Math.max(0, Number(maxText));
    return consoleResult.items.filter(item => (kind === 'all' || item.kind === kind) && (!onlyDeals || item.discount > 0 && item.regular > item.price) && item.price <= max);
}
async function loadConsoleCatalog(reset = true) {
    if (!reset && consoleLoading) return;
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
    const onlyDeals = document.getElementById('consoleOnlyDeals').checked;
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
        let scans = 0;
        while (consoleNext !== null && filteredConsoleItems().length < consoleVisible && scans++ < 4) {
            const params = new URLSearchParams({ platform, region, q: query, source, sort, deals: onlyDeals ? '1' : '0', cursor: JSON.stringify(consoleNext) });
            const result = await requestJSON(`/api/console-catalog?${params}`, { signal: controller.signal, timeout: 16000 });
            if (generation !== catalogGeneration || platform !== activeEcosystem || region !== currentRegion) return;
            if (!Array.isArray(result.items)) throw Error('Respuesta inválida');
            if (!consoleResult) consoleResult = { ...result, items: [] };
            const seen = new Set(consoleResult.items.map(item => item.store + ':' + item.id));
            const added = result.items.filter(item => { const key = item.store + ':' + item.id; if (seen.has(key)) return false; seen.add(key); return true; });
            consoleResult.items.push(...added);
            consoleResult.sources = result.sources;
            consoleResult.checkedAt = result.checkedAt;
            consoleNext = result.next || null;
            if (!added.length && consoleNext && scans >= 2) break;
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
    const onlyDeals = document.getElementById('consoleOnlyDeals').checked;
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
        const format = value => new Intl.NumberFormat('es-MX', { style:'currency', currency:item.currency }).format(value);
        const card = document.createElement('article');
        card.className = 'steam-card console-card';
        card.innerHTML = `<img loading="lazy" src="${escapeHTML(safeURL(item.image))}" alt="${escapeHTML(item.title)}"><div class="console-card-body"><p class="console-store">${escapeHTML(item.store)} · ${item.kind === 'official' ? 'Oficial' : 'Mercado externo'}</p><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.edition)}</p><p>${Number.isFinite(item.rating) ? '★ ' + escapeHTML(item.rating) + '/5 · ' + escapeHTML(item.ratingCount || 0) + ' reseñas' : 'Sin valoración publicada por esta fuente'}</p>${item.seller ? `<p>Vendedor: ${escapeHTML(item.seller)}</p>` : ''}<div class="console-price">${item.regular > item.price ? `<del>${escapeHTML(format(item.regular))}</del><span>-${item.discount}%</span>` : '<small>Sin descuento comprobado</small>'}<strong>${escapeHTML(format(item.price))} ${escapeHTML(item.currency)}</strong></div><a class="console-buy" href="${escapeHTML(safeURL(item.url))}" target="_blank" rel="noopener noreferrer">Ver esta edición en la tienda ↗</a></div>`;
        prepareImages(card); fragment.appendChild(card);
    });
    gamesGrid.appendChild(fragment);
    loadedCountBadge.textContent = visible.length;
    emptyState.classList.toggle('hidden-el', filtered.length > 0);
    if (!filtered.length) document.getElementById('consoleScope').textContent += ' No hay coincidencias con estos filtros en las páginas cargadas. Prueba sin límite de presupuesto o carga más resultados.';
}
