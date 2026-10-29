let pendingPCDeals = [];
let pcSourceHasMore = true;
        // Catálogo: cada vista es dueña de su petición; las respuestas antiguas se descartan.
        async function executeCatalogFetch(resetGrid = true) {
            if (activeEcosystem !== 'pc') return loadConsoleCatalog(resetGrid);
            if (resetGrid) cancelCatalogRequest();
            const generation = catalogGeneration;
            const controller = new AbortController();
            catalogController = controller;
            const config = { ...queryConfig };
            const query = currentSearchQuery;
            document.getElementById('catalogError').classList.add('hidden-el');
            if (resetGrid) {
                currentPage = 0;
                pendingPCDeals=[];pcSourceHasMore=true;
                currentDeals = [];
                loadedCountBadge.textContent = '0';
                gamesGrid.replaceChildren();
                emptyState.classList.add('hidden-el');
                loadMoreContainer.classList.add('hidden-el');
                showLoader('Cargando ofertas...');
            }
            try {
                const restricted = config.discountFilter && config.discountFilter.mode !== 'any';
                const pagesToScan = restricted ? 400 : 1;
                const ascending=restricted&&config.discountFilter.max<=50;
                if(restricted && currentPage===0){
                    const seek=new URLSearchParams({discount:String(ascending?config.discountFilter.min:config.discountFilter.max),desc:ascending?'1':'0'});
                    if(query)seek.set('title',query);
                    if(config.onSale==='1'||config.discountFilter.min>0)seek.set('onSale','1');
                    if(config.steamRating>0)seek.set('steamRating',String(config.steamRating));
                    if(config.onlyAAA)seek.set('AAA','1');
                    loadingText.textContent='Localizando el porcentaje en el catálogo de las tiendas…';
                    try{const position=await requestJSON('/api/deals-position?'+seek,{signal:controller.signal,timeout:45000});if(generation!==catalogGeneration)return;if(Number.isInteger(position.page)&&position.page>=0)currentPage=position.page;}catch(error){if(controller.signal.aborted)throw error;}
                }
                let fetchedBatch = pendingPCDeals.splice(0);
                let pagesRead = 0;
                let scanFailure=false;
                let hasMore = pcSourceHasMore;
                for (let i = 0; i < pagesToScan && hasMore && new Set(fetchedBatch.map(d=>d.gameID||d.dealID)).size < 60; i++) {
                    const params = new URLSearchParams({ pageSize: '60', pageNumber: String(currentPage + i), sortBy: restricted ? 'Savings' : config.sortBy });
                    if (query) params.set('title', query);
                    // Consultar todas las tiendas cubiertas por CheapShark, no sólo Steam.
                    if (restricted) params.set('desc',ascending?'1':'0');
                    if (config.onSale === '1'||restricted&&config.discountFilter.min>0) params.set('onSale', '1');
                    if (config.steamRating > 0) params.set('steamRating', String(config.steamRating));

                    if (config.onlyAAA) params.set('AAA', '1');
                    let data;
                    try{data=await requestJSON(`${DEALS_API}?${params}`,{signal:controller.signal});}
                    catch(error){if(controller.signal.aborted||!pagesRead&&!fetchedBatch.length)throw error;scanFailure=true;break;}
                    if (generation !== catalogGeneration) return;
                    if (!Array.isArray(data)) throw new Error('Respuesta de catálogo inválida');
                    pagesRead++;
                    hasMore = data.length === 60;
                    fetchedBatch.push(...data.filter(d => matchesDiscount(d.savings || 0, config.discountFilter)));
                    loadingText.textContent = `Buscando coincidencias en las tiendas… ${pagesRead} página(s) revisadas, ${new Set(fetchedBatch.map(d=>d.gameID||d.dealID)).size} juegos encontrados.`;
                    if(restricted && data.length && data.every(d=>ascending?Math.round(Number(d.savings||0))>config.discountFilter.max:Math.round(Number(d.savings||0))<config.discountFilter.min))hasMore=false;
                    if (!hasMore || new Set(fetchedBatch.map(d=>d.gameID||d.dealID)).size >= 60) break;
                }
                if (generation !== catalogGeneration) return;
                currentPage += pagesRead;
                const seen = new Set(currentDeals.map(d => d.gameID || d.dealID));
                const uniqueNew = fetchedBatch.filter(d => {
                    const key = d.gameID || d.dealID;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                pcSourceHasMore=hasMore;
                pendingPCDeals=uniqueNew.splice(60);
                hasMore=hasMore||pendingPCDeals.length>0;
                currentDeals.push(...uniqueNew);
                updateSavedPrices(uniqueNew);
                loadedCountBadge.textContent = currentDeals.length;
                hideLoader();
                emptyState.classList.toggle('hidden-el', currentDeals.length > 0 || hasMore);
                if(restricted){
                    const sorts={Price:(a,b)=>Number(a.salePrice)-Number(b.salePrice),Savings:(a,b)=>Number(b.savings)-Number(a.savings),Reviews:(a,b)=>Number(b.steamRatingPercent)-Number(a.steamRatingPercent),Metacritic:(a,b)=>Number(b.metacriticScore)-Number(a.metacriticScore),Release:(a,b)=>Number(b.releaseDate)-Number(a.releaseDate),'Deal Rating':(a,b)=>Number(b.dealRating)-Number(a.dealRating),DealRating:(a,b)=>Number(b.dealRating)-Number(a.dealRating)};
                    currentDeals.sort(sorts[config.sortBy]||sorts.DealRating);gamesGrid.replaceChildren();renderStandardGameCards(currentDeals);
                }else renderStandardGameCards(uniqueNew);
                loadMoreContainer.classList.toggle('hidden-el', !hasMore);
                paginationInfo.textContent = `Mostrando ${currentDeals.length} juegos · ${pagesRead} página(s) consultadas${hasMore ? ' · hay más catálogo disponible' : ' · páginas disponibles revisadas'}`;
                if(restricted)paginationInfo.textContent+=' · orden sobre las coincidencias cargadas';
                if(scanFailure)showCatalogError('La tienda limitó o interrumpió la consulta. Conservamos los resultados recuperados; puedes continuar con Cargar más.');
                else if (!currentDeals.length && hasMore) showCatalogError('La búsqueda sigue teniendo páginas pendientes; aún no podemos concluir que no haya ofertas. Continúa la búsqueda.');
            } catch (error) {
                if (generation !== catalogGeneration || controller.signal.aborted) return;
                hideLoader();
                showCatalogError('No se pudo cargar el catálogo. Comprueba tu conexión e inténtalo de nuevo.');
            } finally {
                if (generation === catalogGeneration) catalogController = null;
            }
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
                    : (game.thumb || 'https://placehold.co/460x215/131c2e/38bdf8?text=SteamPulse');
                const fallbackImg = game.thumb || 'https://placehold.co/460x215/131c2e/38bdf8?text=Game';

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
