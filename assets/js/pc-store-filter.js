// Store selection is sent upstream so pagination covers the selected catalogue.
function getPCStoreIDs() {
    const selected = queryConfig.storeID || 'all';
    return selected !== 'all' ? [selected] : [...new Set(['1', ...Object.keys(storesMap).filter(id => storesMap[id].active !== false)])];
}
function renderPCStoreControls() {
    document.getElementById('pcStoreBar').classList.toggle('hidden-el', activeEcosystem !== 'pc' || ['free', 'wishlist'].includes(activeChip));
    const select = document.getElementById('pcStoreSelect');
    const entries = new Map([['1','Steam'], ['25','Epic Games Store'], ['7','GOG']]);
    for (const [id, store] of Object.entries(storesMap)) if (store.active !== false) entries.set(id, store.name);
    select.replaceChildren(new Option('Todas las tiendas oficiales', 'all'));
    for (const [id, name] of entries) select.add(new Option(name, id));
    select.value = queryConfig.storeID || 'all';
    const links = document.getElementById('pcExternalLinks');
    links.replaceChildren();
    const label = document.createElement('span'); label.textContent = 'Buscar keys ↗'; links.append(label);
    for (const market of KEY_MARKETS_CATALOG.slice(0,4)) {
        const anchor = document.createElement('a'); anchor.textContent = market.name;
        anchor.href = safeURL(market.buildUrl(currentSearchQuery || '', 'pc'));
        anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; links.append(anchor);
    }
}
function selectPCStore() {
    const id = document.getElementById('pcStoreSelect').value;
    if (id !== 'all' && !/^\d{1,5}$/.test(id)) return;
    queryConfig.storeID = id;
    executeCatalogFetch(true);
}
