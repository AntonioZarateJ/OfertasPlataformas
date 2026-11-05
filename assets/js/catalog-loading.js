let catalogLogoTimer;
let catalogLogoIndex = 0;
const LOADING_LOGOS = {
    steam: '<i class="fa-brands fa-steam"></i>',
    epic: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 5h30v32L24 44 9 37Z" fill="currentColor"/><text x="24" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="13" fill="#0d1725">EPIC</text><text x="24" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="6" fill="#0d1725">GAMES</text></svg>',
    gog: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="8" width="42" height="32" rx="9" fill="currentColor"/><text x="24" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="20" fill="#0d1725">gog</text></svg>',
    xbox: '<i class="fa-brands fa-xbox"></i>',
    ps: '<i class="fa-brands fa-playstation"></i>',
    switch: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M22 5H15C8 5 5 10 5 17v14c0 8 4 12 10 12h7Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M27 5h6c7 0 10 5 10 12v14c0 8-4 12-10 12h-6Z" fill="currentColor"/><circle cx="14" cy="17" r="4" fill="currentColor"/><circle cx="35" cy="30" r="4" fill="#0d1725"/></svg>'
};
function catalogLoadingMessage() {
    return activeChip === 'free' ? 'Cargando juegos gratis… Espera un momento.' : queryConfig.onSale === '1' ? 'Cargando ofertas… Espera un momento.' : 'Cargando juegos… Espera un momento.';
}
function loadingLogoKeys() {
    if (activeEcosystem !== 'pc') return [activeEcosystem];
    const selected = queryConfig.storeID;
    return selected === '1' ? ['steam'] : selected === '25' ? ['epic'] : selected === '7' ? ['gog'] : ['steam', 'epic', 'gog'];
}
function paintCatalogLogo() {
    const keys = loadingLogoKeys();
    const logo = LOADING_LOGOS[keys[catalogLogoIndex % keys.length]] || LOADING_LOGOS.steam;
    for (const mark of document.querySelectorAll('[data-loading-logo]')) mark.innerHTML = logo;
}
function resetLoadMoreButton() {
    clearInterval(catalogLogoTimer); catalogLogoTimer = null;
    loadMoreBtn.disabled = false;
    loadMoreBtn.removeAttribute('aria-busy');
    loadMoreBtn.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i><span>Cargar más juegos</span>';
}
function beginCatalogLoading() {
    clearInterval(catalogLogoTimer); catalogLogoIndex = 0;
    gamesGrid.setAttribute('aria-busy', 'true');
    document.getElementById('catalogEndStatus').classList.add('hidden-el');
    if (isLoadingMore) {
        loadMoreContainer.classList.remove('hidden-el');
        loadMoreBtn.disabled = true; loadMoreBtn.setAttribute('aria-busy', 'true');
        loadMoreBtn.innerHTML = '<span class="catalog-loading-mark compact-loading-mark" data-loading-logo aria-hidden="true"></span><span>Cargando… Espera un momento.</span>';
        document.getElementById('loadMoreStatus').textContent = 'Cargando juegos. Espera un momento.';
    }
    paintCatalogLogo();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && loadingLogoKeys().length > 1) {
        catalogLogoTimer = setInterval(() => { catalogLogoIndex++; paintCatalogLogo(); }, 1400);
    }
}
function finishCatalogLoading() {
    gamesGrid.removeAttribute('aria-busy');
    resetLoadMoreButton();
    document.getElementById('loadMoreStatus').textContent = '';
}
function updateCatalogEndStatus(more, count) {
    document.getElementById('catalogEndStatus').classList.toggle('hidden-el', more || !count);
}
