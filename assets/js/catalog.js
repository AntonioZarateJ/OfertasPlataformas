let pcFetchSort='DealRating';
let pcStoreIDs=[],pcStoreIndex=0,pcNeedsSeek=true;
let pendingPCDeals=[],pcSourceHasMore=true;
function advancePCStore(){
    pcStoreIDs=[...new Set([...pcStoreIDs,...getPCStoreIDs()])];
    pcStoreIndex++;currentPage=0;pcNeedsSeek=true;
    pcSourceHasMore=pcStoreIndex<pcStoreIDs.length;
}
async function executeCatalogFetch(resetGrid=true){
    if(activeEcosystem!=='pc')return loadConsoleCatalog(resetGrid);
    renderPCStoreControls();
    if(resetGrid)cancelCatalogRequest();
    const generation=catalogGeneration,controller=new AbortController();catalogController=controller;
    const config=structuredClone(queryConfig),query=currentSearchQuery;
    const restricted=config.discountFilter?.mode!=='any'&&!!config.discountFilter;
    const ascending=restricted&&config.discountFilter.max<=50;
    const deadline=Date.now()+45000;let partial=false,failure=null;
    document.getElementById('catalogError').classList.add('hidden-el');catalogNotice();
    if(resetGrid){
        pcFetchSort=canonicalPCSort(config.sortBy);
        currentPage=0;currentDeals=[];pendingPCDeals=[];pcSourceHasMore=true;pcNeedsSeek=true;pcStoreIndex=0;
        pcStoreIDs=getPCStoreIDs();
        gamesGrid.replaceChildren();loadedCountBadge.textContent='0';emptyState.classList.add('hidden-el');
    }
    const target=currentDeals.length+60;
    loadMoreContainer.classList.add('hidden-el');showLoader('Buscando precios y descuentos…');
    const append=()=>{
        const additions=pendingPCDeals.splice(0,Math.max(0,target-currentDeals.length));
        currentDeals.push(...additions);updateSavedPrices(additions);renderStandardGameCards(additions);
        loadedCountBadge.textContent=currentDeals.length;
        if(currentDeals.length)gamesGrid.classList.remove('hidden-el');
    };
    try{
        while(generation===catalogGeneration){
            append();
            if(currentDeals.length>=target||!pcSourceHasMore)break;
            if(Date.now()>=deadline){partial=true;break;}
            if(restricted&&pcNeedsSeek){
                const seek=new URLSearchParams({discount:String(ascending?config.discountFilter.min:config.discountFilter.max),desc:ascending?'1':'0',storeID:pcStoreIDs[pcStoreIndex]||'1'});
                if(query)seek.set('title',query);
                if(config.onSale==='1'||config.discountFilter.min>0)seek.set('onSale','1');
                if(config.steamRating>0)seek.set('steamRating',String(config.steamRating));
                loadingText.textContent='Buscando en '+(storesMap[pcStoreIDs[pcStoreIndex]]?.name||'Steam')+'…';
                const position=await catalogJSON('/api/deals-position?'+seek,{signal:controller.signal,timeout:10000,ttl:0,deadline});
                if(generation!==catalogGeneration)return;
                if(position.limited){partial=true;advancePCStore();await catalogPause(700,controller.signal);continue;}
                if(position.pending){await catalogPause(position.slow?2000:1000,controller.signal);continue;}
                if(!Number.isInteger(position.page)||position.page<0)throw Error('Respuesta de paginación inválida');
                currentPage=position.page;pcNeedsSeek=false;
            }
            const params=new URLSearchParams({pageSize:'60',pageNumber:String(currentPage),sortBy:restricted?'Savings':pcFetchSort});
            if(config.storeID && config.storeID!=='all')params.set('storeID',config.storeID);
            if(query)params.set('title',query);
            if(restricted){params.set('desc',ascending?'1':'0');params.set('storeID',pcStoreIDs[pcStoreIndex]||'1');}
            if(config.onSale==='1'||restricted&&config.discountFilter.min>0)params.set('onSale','1');
            if(config.steamRating>0)params.set('steamRating',String(config.steamRating));
            if(config.onlyAAA)params.set('AAA','1');
            let data;
            try{data=await catalogJSON(`${DEALS_API}?${params}`,{signal:controller.signal,deadline});}
            catch(error){if(restricted&&error.status===400){partial=true;advancePCStore();continue;}throw error;}
            if(generation!==catalogGeneration)return;
            if(!Array.isArray(data))throw Error('Respuesta de catálogo inválida');
            currentPage++;
            const seen=new Set([...currentDeals,...pendingPCDeals].map(d=>String(d.gameID||d.dealID)));
            for(const game of data){const key=String(game.gameID||game.dealID);if(!seen.has(key)&&matchesDiscount(game.savings||0,config.discountFilter)){seen.add(key);pendingPCDeals.push(game);}}
            const end=data.length<60||restricted&&data.length&&data.every(d=>ascending?Math.round(Number(d.savings||0))>config.discountFilter.max:Math.round(Number(d.savings||0))<config.discountFilter.min);
            if(end){if(restricted)advancePCStore();else pcSourceHasMore=false;}
            append();loadingText.textContent=`Comparando precios… ${currentDeals.length} juegos encontrados.`;
            if(!restricted||currentDeals.length>=target)break;
            await catalogPause(700,controller.signal);
        }
    }catch(error){if(controller.signal.aborted||generation!==catalogGeneration)return;failure=error;partial=true;}
    finally{
        if(generation===catalogGeneration){
            catalogController=null;hideLoader();
            const more=pcSourceHasMore||pendingPCDeals.length>0;
            loadMoreContainer.classList.toggle('hidden-el',!more||!!failure&&!currentDeals.length);
            loadMoreBtn.classList.remove('hidden-el');
            emptyState.classList.toggle('hidden-el',currentDeals.length>0||more||partial);
            paginationInfo.textContent=`Mostrando ${currentDeals.length} juegos${more?' · puedes cargar otros 60':''}`;
            if(currentDeals.length){
                renderSortedPCCatalog();
            }
            if(failure&&!currentDeals.length)showCatalogError('La tienda sigue sin responder después de varios intentos. Puedes reintentar; no significa que no existan ofertas.');
            else if(partial)catalogNotice('Mostramos los precios confirmados. Algunas tiendas no permitieron completar la consulta.');
        }
    }
}

function canonicalPCSort(value){return value==='Deal Rating'?'DealRating':value;}
function renderSortedPCCatalog(){
    const metric={Savings:'savings',Reviews:'steamRatingPercent',Metacritic:'metacriticScore',Release:'releaseDate',DealRating:'dealRating'};
    const order=canonicalPCSort(queryConfig.sortBy),field=metric[order]||'dealRating';
    const key=game=>String(game.gameID||game.dealID||game.title);
    const cards=new Map([...gamesGrid.children].map(card=>[card.dataset.cardId,card]));
    const price=game=>{
        const box=cards.get(key(game))?.querySelector('.price-box');
        return box&&box.dataset.regionalCurrency===currentCurrency?Number(box.dataset.regionalAmount):Number(game.salePrice)*(exchangeRates[currentCurrency]||1);
    };
    currentDeals.sort((a,b)=>order==='Price'?price(a)-price(b):(Number(b[field])||0)-(Number(a[field])||0));
    // Move existing nodes: preserve images, listeners and regional quotes without fetching again.
    currentDeals.forEach(game=>{const card=cards.get(key(game));if(card)gamesGrid.appendChild(card);else renderStandardGameCards([game]);});
}

        function renderStandardGameCards(games) {
            const ecoMeta = ECOSYSTEM_META[activeEcosystem] || ECOSYSTEM_META.pc;

            const fragment = document.createDocumentFragment();
            games.forEach(game => {
                const steamId = game.steamAppID;
                const savings = Math.round(parseFloat(game.savings || 0));
                const saleUsd = parseFloat(game.salePrice || 0).toFixed(2);
                const normalUsd = parseFloat(game.normalPrice || 0).toFixed(2);
                const isAAA = parseFloat(normalUsd) >= 29.99;
                const hasSubHint = checkSubscriptionHint(game.title);

                const headerImg = steamId
                    ? `${STEAM_HEADER_IMG}${steamId}/header.jpg`
                    : (game.thumb || '');
                const fallbackImg = game.thumb || '';

                // Si el usuario eligió consola (Xbox/PS/Switch), el botón rápido apunta al buscador de Keys de esa consola; en PC va a Steam
                const directStoreUrl = activeEcosystem === 'pc'
                    ? (game.dealID ? dealRedirectURL(game.dealID) : `${STEAM_APP_URL}${steamId}`)
                    : KEY_MARKETS_CATALOG[0].buildUrl(game.title, activeEcosystem);

                const directBtnLabel = activeEcosystem === 'pc' ? 'Tienda' : `Key ${ecoMeta.shortBadge.split(' ')[0]}`;

                const ratingPct = parseInt(game.steamRatingPercent || 0);
                const metacritic = parseInt(game.metacriticScore || 0);
                const storeName = activeEcosystem === 'pc'
                    ? (storesMap[game.storeID]?.name || (String(game.storeID)==='1'?'Steam':'Tienda oficial'))
                    : ecoMeta.shortBadge;

                const card = document.createElement('div');
                card.className = "steam-card rounded-2xl overflow-hidden flex flex-col group";
                card.dataset.cardId=String(game.gameID||game.dealID||game.title);

                card.innerHTML = `
                    <!-- Portada Clickable -->
                    <div class="relative w-full pt-[46.7%] bg-[#090d16] overflow-hidden cursor-pointer open-modal-trigger">
                        <img src="${escapeHTML(safeURL(headerImg))}" alt="${escapeHTML(game.title)}" loading="lazy"
                             data-fallback="${escapeHTML(safeURL(fallbackImg))}"
                             class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#131c2e] via-transparent to-black/30 opacity-85"></div>

                        <!-- Badge Descuento o Precio Regular -->
                        ${savings > 0 ? `
                            <div class="absolute bottom-2.5 left-2.5 bg-steam-greenBg text-steam-green font-black px-2.5 py-0.5 text-xs sm:text-sm rounded-lg shadow-lg border border-steam-green/50">
                                -${savings}%
                            </div>
                        ` : `
                            <div class="absolute bottom-2.5 left-2.5 bg-steam-base/90 text-gray-300 font-bold px-2.5 py-0.5 text-[11px] rounded-lg border border-white/10">
                                Precio Regular
                            </div>
                        `}

                        <!-- Indicador Game Pass / PS Plus en esquina inferior derecha -->
                        ${hasSubHint ? `
                            <div class="absolute bottom-2.5 right-12 bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1" title="Este título o franquicia suele estar en catálogos como Xbox Game Pass o PS Plus">
                                <i class="fa-solid fa-ticket text-emerald-400"></i>
                                <span>Game Pass / Plus</span>
                            </div>
                        ` : ''}

                        <!-- Botón Corazón Wishlist (Fase 3) -->
                        <button type="button" data-game-id="${escapeHTML(game.gameID || game.dealID || game.title)}"
                            class="wishlist-card-btn absolute bottom-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition shadow-lg border ${
                                isGameInWishlist(game.gameID || game.dealID || game.title)
                                    ? 'bg-rose-500 text-white border-rose-300'
                                    : 'bg-black/75 hover:bg-rose-500/80 text-gray-200 hover:text-white border-white/15'
                            }"
                            title="Guardar en mi Wishlist / Crear alerta">
                            <i class="${isGameInWishlist(game.gameID || game.dealID || game.title) ? 'fa-solid' : 'fa-regular'} fa-heart text-xs"></i>
                        </button>

                        <!-- Badges Superiores Izquierda -->
                        <div class="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                            ${isAAA ? `<span class="bg-amber-500 text-gray-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow uppercase"><i class="fa-solid fa-crown mr-1"></i>AAA</span>` : ''}
                            <span class="bg-black/75 backdrop-blur-sm text-gray-100 text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/15 flex items-center gap-1">
                                <i class="${ecoMeta.icon}"></i>
                                <span>${escapeHTML(storeName)}</span>
                            </span>
                        </div>

                        <!-- Calificaciones Derecha -->
                        <div class="absolute top-2.5 right-2.5 flex items-center gap-1">
                            ${metacritic > 0 ? `<span class="bg-amber-400 text-gray-950 font-black text-[10px] px-1.5 py-0.5 rounded" title="Metacritic">${metacritic}</span>` : ''}
                            ${ratingPct > 0 ? `<span class="bg-black/75 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-400/30"><i class="fa-solid fa-thumbs-up mr-1"></i>${ratingPct}%</span>` : ''}
                        </div>
                    </div>

                    <!-- Información -->
                    <div class="p-4 flex flex-col flex-grow">
                        <h3 class="text-white font-bold text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-sky-400 transition cursor-pointer open-modal-trigger" title="${escapeHTML(game.title)}">
                            ${escapeHTML(game.title)}
                        </h3>
                        <p class="text-[11px] text-gray-400 mt-0.5 mb-3 flex items-center justify-between">
                            <span>${game.steamRatingText ? `Reseñas: ${escapeHTML(game.steamRatingText)}` : `Oficiales + Keys disponibles`}</span>
                            <span class="text-amber-400/90 font-semibold"><i class="fa-solid fa-key text-[10px] mr-0.5"></i>Eneba/CDKeys</span>
                        </p>

                        <div class="mt-auto">
                            <div class="price-box flex items-center justify-between bg-[#0b101b] px-3 py-2 rounded-xl mb-3 border border-white/5"
                                 data-normal-usd="${normalUsd}" data-sale-usd="${saleUsd}">
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-gray-400 block">Referencia USD convertida</span>
                                    <span class="normal-val text-xs text-gray-500 ${savings > 0 ? 'line-through' : ''}">${formatPrice(normalUsd, false)}</span>
                                </div>
                                <div class="text-right">
                                    <span class="sale-val text-steam-green font-black text-base block leading-none">
                                        ${formatPrice(saleUsd, true)}
                                    </span>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <button type="button" class="open-modal-trigger bg-steam-base hover:bg-steam-light text-sky-400 font-bold py-2 px-2.5 rounded-xl text-xs border border-sky-500/30 transition flex items-center justify-center gap-1.5">
                                    <i class="fa-solid fa-scale-balanced"></i>
                                    <span>Oficial vs Keys</span>
                                </button>
                                <a href="${escapeHTML(safeURL(directStoreUrl))}" target="_blank" rel="noopener noreferrer"
                                   class="bg-sky-500/20 hover:bg-sky-400 hover:text-gray-950 text-sky-300 font-bold py-2 px-2.5 rounded-xl text-xs border border-sky-400/40 transition flex items-center justify-center gap-1.5">
                                    <i class="fa-solid fa-cart-shopping"></i>
                                    <span>${directBtnLabel}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                card.querySelectorAll('.open-modal-trigger').forEach(el => {
                    el.addEventListener('click', () => openAnalyticalModal(game));
                });

                const wishBtn = card.querySelector('.wishlist-card-btn');
                if (wishBtn) {
                    wishBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        toggleGameWishlist(game);
                    });
                }

                const regional = document.createElement('p');
                regional.className = 'text-xs text-emerald-300 px-4 pb-3';
                card.appendChild(regional);
                if (steamId && String(game.storeID)==='1') void showSteamRegionalPrice(regional, steamId);
                else regional.textContent='Referencia de esta tienda en USD convertida; confirma el precio regional al comprar.';
                prepareImages(card);
                fragment.appendChild(card);
            });
            gamesGrid.appendChild(fragment);
        }

        // Botón Cargar más
        loadMoreBtn.addEventListener('click', async () => {
            if (isLoadingMore || ['free', 'wishlist'].includes(activeChip)) return;
            isLoadingMore = true;
            const generation = catalogGeneration;
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Cargando más títulos...';
            try { await executeCatalogFetch(false); }
            finally {
                if (generation === catalogGeneration) {
                    isLoadingMore = false;
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span>Cargar Más Juegos</span>';
                }
            }
        });
