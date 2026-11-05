// La selección de novedades sólo cambia la vista; conserva datos y cursores.
let catalogBatchKeys=new Set();
let catalogBatchOnly=false;
function catalogCardKey(card){return card.dataset.consoleKey||card.dataset.cardId||'';}
function catalogCardKeys(){return new Set([...gamesGrid.children].map(catalogCardKey).filter(Boolean));}
function clearCatalogBatch(){
    catalogBatchKeys.clear();catalogBatchOnly=false;
    document.getElementById('catalogBatchBar').hidden=true;
    gamesGrid.querySelectorAll('.catalog-batch-hidden,.catalog-new-card').forEach(card=>card.classList.remove('catalog-batch-hidden','catalog-new-card'));
}
function syncCatalogBatchView(){
    const bar=document.getElementById('catalogBatchBar');
    if(!catalogBatchKeys.size){bar.hidden=true;return;}
    let fresh=0;
    for(const card of gamesGrid.children){
        const added=catalogBatchKeys.has(catalogCardKey(card));
        if(added)fresh++;
        card.classList.toggle('catalog-new-card',added);
        card.classList.toggle('catalog-batch-hidden',catalogBatchOnly&&!added);
    }
    if(!fresh){clearCatalogBatch();return;}
    bar.hidden=false;
    document.getElementById('catalogBatchText').textContent=catalogBatchOnly
        ? `Viendo ${fresh} juegos recién añadidos, con el orden elegido.`
        : `${fresh} juegos añadidos. Algunos pueden aparecer antes en la lista.`;
    document.getElementById('catalogBatchShowNew').hidden=catalogBatchOnly;
    document.getElementById('catalogBatchShowAll').hidden=!catalogBatchOnly;
    loadedCountBadge.textContent=catalogBatchOnly?fresh:gamesGrid.children.length;
}
function announceCatalogBatch(before){
    const added=new Set([...catalogCardKeys()].filter(key=>!before.has(key)));
    if(added.size)catalogBatchKeys=added;
    syncCatalogBatchView();
}
function showCatalogBatch(onlyNew){
    catalogBatchOnly=onlyNew;syncCatalogBatchView();
    if(onlyNew){
        // Saltar al primer resultado de la vista nueva evita recorrer lo ya visto.
        const first=gamesGrid.querySelector('.catalog-new-card');
        if(first){first.setAttribute('tabindex','-1');first.focus({preventScroll:true});first.scrollIntoView({block:'start',behavior:'auto'});}
    }
}
function dismissCatalogBatch(){
    clearCatalogBatch();loadedCountBadge.textContent=gamesGrid.children.length;
}
