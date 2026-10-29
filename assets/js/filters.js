function getDiscountSettings(prefix) {
    const mode=document.getElementById(prefix+'DiscountMode').value;
    const first=document.getElementById(prefix==='drawer'?'drawerDiscountSlider':'consoleDiscountValue');
    const end=document.getElementById(prefix+'DiscountEnd');
    const min=Number(first.value),max=mode==='exact'?min:Number(end.value);
    const valid=mode==='any'||first.value!==''&&Number.isInteger(min)&&min>=0&&min<=100&&(mode!=='range'||end.value!==''&&Number.isInteger(max)&&max>=min&&max<=100);
    return {mode,min,max,valid};
}
function matchesDiscount(value,filter={mode:'any'}) {
    const number=Number(value);
    if(!Number.isFinite(number))return false;
    const percent=Math.round(number);
    return filter.mode==='any'||filter.mode==='exact'&&percent===filter.min||filter.mode==='range'&&percent>=filter.min&&percent<=filter.max;
}
function discountDescription(filter) {
    return filter.mode==='any'?'Cualquier porcentaje de descuento':filter.mode==='exact'?`${filter.min}% exacto`:`Entre ${filter.min}% y ${filter.max}%, incluidos`;
}
function updateDiscountControls(prefix) {
    const filter=getDiscountSettings(prefix);
    document.getElementById(prefix+'ValueLabel').classList.toggle('hidden-el',filter.mode==='any');
    document.getElementById(prefix+'EndLabel').classList.toggle('hidden-el',filter.mode!=='range');
    document.getElementById(prefix+'DiscountLabel').textContent=filter.valid?discountDescription(filter):'Introduce porcentajes enteros de 0 a 100. El inicio no puede superar el final.';
    return filter;
}
function updateScopeNote() {
    const offers=queryConfig.onSale==='1';
    document.getElementById('catalogScopeNote').textContent=offers?'Solo ofertas: juegos con descuento. Ajusta el porcentaje si quieres afinar los resultados.':'Catálogo completo: incluye juegos con y sin descuento. Los demás filtros se siguen aplicando.';
    const filter=activeEcosystem==='pc'?queryConfig.discountFilter:getDiscountSettings('console');
    if(filter&&filter.mode!=='any')document.getElementById('catalogScopeNote').textContent+=' · '+discountDescription(filter)+'.';
    if(activeChip==='free')document.getElementById('catalogScopeNote').textContent='Gratis: promociones y directorios para reclamar juegos sin costo.';
    document.querySelectorAll('[data-chip="top"],[data-chip="all"]').forEach(button=>button.classList.toggle('active',activeChip!=='free'&&button.dataset.chip===(offers?'top':'all')));
}
function updateDrawerLabels() {
    updateDiscountControls('drawer');
    const rating=Number(drawerRatingSlider.value);
    drawerRatingLabel.textContent=rating?`Al menos ${rating}% de reseñas positivas`:'Sin mínimo de reseñas';
}
function syncSlidersWithConfig(){drawerRatingSlider.value=queryConfig.steamRating;updateDrawerLabels();updateScopeNote();}
toggleFineTuneBtn.addEventListener('click',()=>fineTuneDrawer.classList.toggle('hidden-el'));
[drawerDiscountSlider,drawerRatingSlider,document.getElementById('drawerDiscountEnd')].forEach(el=>el.addEventListener('input',updateDrawerLabels));
function applyCustomDrawerFilters(){
    const filter=updateDiscountControls('drawer');
    if(!filter.valid){showToast('Revisa el porcentaje o el rango de descuento.');return;}
    cancelSuggestions();
    queryConfig.discountFilter=filter;
    queryConfig.minDiscount=0;
    queryConfig.steamRating=Number(drawerRatingSlider.value);
    queryConfig.maxPriceUsd=50;queryConfig.onlyAAA=false;
    freeGamesSubBar.classList.add('hidden-el');
    activeCustomFiltersDot.classList.toggle('hidden-el',filter.mode==='any'&&!queryConfig.steamRating);
    activeChip=currentSearchQuery?'search':queryConfig.onSale==='1'?'top':'all';
    setHeaderInfo(currentSearchQuery?`Resultados para: ${currentSearchQuery}`:queryConfig.onSale==='1'?'Ofertas de PC':'Catálogo de PC',discountDescription(filter)+' · '+drawerRatingLabel.textContent,'fa-filter','sky');
    updateScopeNote();executeCatalogFetch(true);
}
function resetFineTuneFilters(){
    document.getElementById('drawerDiscountMode').value='any';drawerDiscountSlider.value=10;document.getElementById('drawerDiscountEnd').value=50;drawerRatingSlider.value=0;applyCustomDrawerFilters();
}
function applyConsoleDiscount(){
    const filter=updateDiscountControls('console');if(!filter.valid)return;
    void loadConsoleCatalog();
}
function resetConsoleFilters(){document.getElementById('consoleSource').value='all';document.getElementById('consoleOrder').value='relevance';document.getElementById('consoleDiscountMode').value='any';document.getElementById('consoleDiscountValue').value=10;document.getElementById('consoleDiscountEnd').value=50;applyConsoleDiscount();}
updateDiscountControls('console');
