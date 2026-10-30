// Las metas de consola conservan moneda, tienda y región; nunca se convierten a USD.
function consoleWishKey(item, platform = activeEcosystem, region = currentRegion) {
    return `console:${platform}:${region}:${item.store}:${item.id}`;
}
function consoleWishItem(item, platform = activeEcosystem, region = currentRegion) {
    return { ...item, native: true, platform, region, gameID: consoleWishKey(item,platform,region),
        image:item.image||item.thumb||'',thumb:item.image||item.thumb||'',checkedAt:item.checkedAt??null,salePrice:String(item.price), savings:Math.round(item.discount||0) };
}
function nativeMoney(amount,currency) {
    return new Intl.NumberFormat('es-MX',{style:'currency',currency}).format(amount)+' '+currency;
}
function saveConsoleWish(item, platform, region, target = null) {
    const saved=consoleWishItem(item,platform,region), key=saved.gameID, old=userWishlist[key];
    if(old && target===null) delete userWishlist[key];
    else userWishlist[key]={...saved, targetPrice:target??old?.targetPrice??null, addedAt:old?.addedAt||Date.now()};
    persistWishlistState(); refreshConsoleHearts();
    showToast(userWishlist[key] ? target!==null?'Precio objetivo guardado. Revísalo en tu Wishlist.':'Juego guardado en tu Wishlist':'Juego eliminado de tu Wishlist');
}
function refreshConsoleHearts() {
    document.querySelectorAll('[data-console-wish]').forEach(button=>{
        const saved=!!userWishlist[button.dataset.consoleWish];
        button.setAttribute('aria-pressed',String(saved));
        button.setAttribute('aria-label',saved?'Quitar de Wishlist':'Guardar en Wishlist');
        button.innerHTML=`<i class="${saved?'fa-solid':'fa-regular'} fa-heart"></i>`;
    });
}
function addConsoleSaveControls(container,item,platform,region) {
    const key=consoleWishKey(item,platform,region), saved=userWishlist[key];
    const panel=document.createElement('section'); panel.className='console-save-panel';
    panel.innerHTML=`<div class="console-save-title"><div><strong><i class="fa-regular fa-bell"></i> Tu precio ideal</strong><p>Guarda esta edición y revisa tu meta al abrir tu Wishlist.</p></div><button type="button" class="console-heart" data-console-wish="${escapeHTML(key)}"></button></div><form><label for="consoleTarget">Quiero pagar este importe o menos (${escapeHTML(item.currency)})</label><div class="console-target-row"><input id="consoleTarget" name="target" type="number" step="0.01" min="0.01" required inputmode="decimal" placeholder="Ej. 300" value="${saved?.targetPrice||''}"><button type="submit">Guardar meta</button></div><p role="status" id="consoleAlertFeedback">${saved?.targetPrice?'Meta guardada: '+escapeHTML(nativeMoney(saved.targetPrice,item.currency)):''}</p></form><small>Solo para ${escapeHTML(item.store)} · ${escapeHTML(purchaseRegions[region][0])}. Los avisos por correo aún no están activos.</small>`;
    panel.querySelector('[data-console-wish]').onclick=()=>{
        saveConsoleWish(item,platform,region);
        if(!userWishlist[key]){panel.querySelector('[role=status]').textContent='';panel.querySelector('input').value='';}
    };
    panel.querySelector('form').onsubmit=event=>{
        event.preventDefault(); const amount=Number(panel.querySelector('input').value);
        if(!Number.isFinite(amount)||amount<=0)return;
        saveConsoleWish(item,platform,region,amount);
        panel.querySelector('[role=status]').textContent='Meta guardada: '+nativeMoney(amount,item.currency);
    };
    const metrics=container.querySelector('.comparison-metrics');
    if(metrics)metrics.after(panel);else container.prepend(panel);
    refreshConsoleHearts();
}
async function refreshConsoleWishlistPrices() {
    const owner=window.accountStorageKey;
    for(const saved of Object.values(userWishlist).filter(item=>item.native)) {
        try {
            const params=new URLSearchParams({platform:saved.platform,region:saved.region,title:saved.title,id:saved.id,store:saved.store});
            const data=await requestJSON('/api/console-comparison?'+params,{timeout:18000});
            if(owner!==window.accountStorageKey)return;
            if(data.platform!==saved.platform||data.region!==saved.region)continue;
            const quote=data.offers.find(q=>String(q.id)===String(saved.id)&&q.store===saved.store&&q.currency===saved.currency);
            if(!quote || !userWishlist[saved.gameID])continue;
            Object.assign(userWishlist[saved.gameID],{price:quote.price,salePrice:String(quote.price),checkedAt:data.checkedAt});
            persistWishlistState();
            if(!document.getElementById('wishlistDrawerModal').classList.contains('hidden-el'))renderWishlistDrawerItems();
        } catch { /* Conservar el último precio observado, sin marcarlo como actualizado. */ }
    }
}
function renderConsoleWishCard(item) {
    const card=document.createElement('article');card.className='native-wish-card';
    const met=item.targetPrice>0&&item.price<=item.targetPrice;
    card.innerHTML=`<button class="native-wish-open" type="button"><img src="${escapeHTML(safeURL(item.image||item.thumb))}" alt=""><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(ECOSYSTEM_META[item.platform].name)} · ${escapeHTML(purchaseRegions[item.region][0])} · ${escapeHTML(item.store)}</small><b>${escapeHTML(nativeMoney(item.price,item.currency))}</b></span></button><button type="button" class="native-wish-remove" aria-label="Eliminar de Wishlist"><i class="fa-solid fa-trash-can"></i></button><p>${item.targetPrice?'Meta: '+escapeHTML(nativeMoney(item.targetPrice,item.currency))+(met?' · Meta alcanzada según el último precio':' · Pendiente'):'Pulsa el juego para comparar o guardar una meta.'}</p><small>Última consulta: ${item.checkedAt?escapeHTML(new Date(item.checkedAt).toLocaleString('es-MX')):'fecha no disponible'}</small>`;
    card.querySelector('.native-wish-open').onclick=()=>{closeWishlistDrawer();openConsoleComparison(item,item.platform,item.region);};
    card.querySelector('.native-wish-remove').onclick=()=>{delete userWishlist[item.gameID];persistWishlistState();refreshConsoleHearts();renderWishlistDrawerItems();};
    prepareImages(card);return card;
}
