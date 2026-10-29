        // --- 4. MOTOR DUAL DE "🎁 JUEGOS 100% GRATIS" (EPIC / STEAM / GOG / CONSOLAS) ---
        async function loadFreeGamesMode() {
            cancelCatalogRequest();
            const generation = catalogGeneration;
            const controller = new AbortController();
            catalogController = controller;
            document.getElementById('catalogError').classList.add('hidden-el');
            currentPage = 0;
            gamesGrid.innerHTML = '';
            emptyState.classList.add('hidden-el');
            loadMoreContainer.classList.add('hidden-el');
            setHeaderInfo(
                '🎁 Cazador de Juegos 100% Gratis & Giveaways Activos',
                'Escaneando regalos temporales en Epic Games Store, Steam, GOG y consolas para que los reclames a $0.00.',
                'fa-gift',
                'emerald'
            );
            showLoader("Buscando juegos con 100% de descuento y giveaways en Epic Games, Steam y GOG...");

            if (allFreeGamesCache.length) {
                hideLoader();
                filterFreeGamesByPlatform(activeFreePlatform);
            }
            try {
                const [cheapSharkFree, gamerPowerFree] = await Promise.all([
                    fetchCheapSharkFreeDeals(controller.signal),
                    fetchGamerPowerGiveaways(controller.signal)
                ]);

                if (generation !== catalogGeneration || activeChip !== 'free') return;
                // Unificar ambas fuentes en formato común
                const normalizedCS = cheapSharkFree.map(deal => {
                    const stName = storesMap[deal.storeID]?.name || (deal.storeID === '25' ? 'Epic Games Store' : 'Steam / PC');
                    let platKey = 'pc';
                    if (deal.storeID === '25' || stName.toLowerCase().includes('epic')) platKey = 'epic';
                    else if (deal.storeID === '1' || stName.toLowerCase().includes('steam')) platKey = 'steam';
                    else if (deal.storeID === '7' || stName.toLowerCase().includes('gog')) platKey = 'gog';

                    return {
                        id: `cs-${deal.dealID}`,
                        title: deal.title,
                        normalUsd: parseFloat(deal.normalPrice || 14.99).toFixed(2),
                        thumb: deal.steamAppID ? `${STEAM_HEADER_IMG}${deal.steamAppID}/header.jpg` : deal.thumb,
                        fallbackThumb: deal.thumb,
                        storeName: stName,
                        platformKey: platKey,
                        claimUrl: dealRedirectURL(deal.dealID),
                        endDate: 'Oferta 100% Activa Hoy',
                        description: 'Juego con 100% de descuento verificado en tienda oficial.'
                    };
                });

                const normalizedGP = gamerPowerFree.map(item => {
                    const plats = (item.platforms || 'PC').toLowerCase();
                    let platKey = 'pc';
                    if (plats.includes('epic')) platKey = 'epic';
                    else if (plats.includes('steam')) platKey = 'steam';
                    else if (plats.includes('gog')) platKey = 'gog';
                    else if (plats.includes('playstation') || plats.includes('xbox') || plats.includes('switch')) platKey = 'console';

                    const rawWorth = (item.worth || '$14.99').replace(/[^0-9.]/g, '');
                    return {
                        id: `gp-${item.id}`,
                        title: item.title,
                        normalUsd: parseFloat(rawWorth || 14.99).toFixed(2),
                        thumb: item.thumbnail || item.image,
                        fallbackThumb: item.thumbnail,
                        storeName: item.platforms || 'PC / Multiplataforma',
                        platformKey: item.platformKey || platKey,
                        claimUrl: item.open_giveaway_url || item.gamerpower_url,
                        endDate: item.end_date && item.end_date !== 'N/A' ? `Termina: ${item.end_date.split(' ')[0]}` : 'Por Tiempo Limitado',
                        description: item.description || 'Promoción gratuita oficial por tiempo limitado.'
                    };
                });

                // Combinar evitando títulos duplicados
                const seenTitles = new Set();
                const merged = [];
                [...normalizedCS, ...normalizedGP, ...CURATED_FREE_GIVEAWAYS.map(c => ({
                    id: c.id,
                    isDirectory: true,
                    title: c.title,
                    normalUsd: c.worth,
                    thumb: c.thumbnail,
                    fallbackThumb: c.thumbnail,
                    storeName: c.platforms,
                    platformKey: c.platformKey,
                    claimUrl: c.open_giveaway_url,
                    endDate: c.end_date,
                    description: c.description
                }))].forEach(item => {
                    const cleanKey = item.title.toLowerCase().trim();
                    if (!seenTitles.has(cleanKey)) {
                        seenTitles.add(cleanKey);
                        merged.push(item);
                    }
                });

                allFreeGamesCache = merged;
                hideLoader();
                filterFreeGamesByPlatform(activeFreePlatform);

            } catch (err) {
                if (generation !== catalogGeneration || controller.signal.aborted) return;
                showCatalogError('No se pudieron consultar los juegos gratuitos.');
                hideLoader();
            }
        }

        async function fetchCheapSharkFreeDeals(signal) {
            try {
                const data = await requestJSON(`${DEALS_API}?upperPrice=0&onSale=1&pageSize=40`, { signal, timeout: 4500 });
                return Array.isArray(data) ? data : [];
            } catch { return []; }
        }

        async function fetchGamerPowerGiveaways(signal) {
            try {
                const data = await requestJSON(GAMERPOWER_API, { signal, timeout: 4500 });
                return Array.isArray(data) ? data.slice(0, 28) : [];
            } catch { return []; }
        }

        function filterFreeGamesByPlatform(platKey) {
            activeFreePlatform = platKey;

            document.querySelectorAll('.free-plat-btn').forEach(btn => {
                if (btn.getAttribute('data-free-plat') === platKey) {
                    btn.className = "free-plat-btn bg-emerald-500 text-gray-950 font-extrabold text-xs px-3 py-1 rounded-lg transition";
                } else {
                    btn.className = "free-plat-btn bg-steam-base hover:bg-steam-light text-gray-300 text-xs px-3 py-1 rounded-lg border border-white/10 transition";
                }
            });

            const filtered = platKey === 'all'
                ? allFreeGamesCache
                : allFreeGamesCache.filter(g => g.platformKey === platKey);

            gamesGrid.innerHTML = '';
            loadedCountBadge.textContent = filtered.length;

            if (filtered.length === 0) {
                emptyState.classList.remove('hidden-el');
                return;
            }

            emptyState.classList.add('hidden-el');
            const fragment = document.createDocumentFragment();
            filtered.forEach(freeItem => {
                const card = document.createElement('div');
                card.className = "free-card rounded-2xl overflow-hidden flex flex-col group";

                card.innerHTML = `
                    <div class="relative w-full pt-[48%] bg-[#090f16] overflow-hidden">
                        <img src="${escapeHTML(safeURL(freeItem.thumb))}" alt="${escapeHTML(freeItem.title)}" loading="lazy"
                             onerror="this.onerror=null; this.src='https://placehold.co/460x215/0f2922/10b981?text=100%25+GRATIS';"
                             class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#0d1620] via-transparent to-black/30"></div>

                        <!-- Etiqueta 100% Gratis -->
                        <div class="absolute bottom-2.5 left-2.5 bg-emerald-500 text-gray-950 font-black px-2.5 py-1 text-xs rounded-lg shadow-lg flex items-center gap-1">
                            <i class="fa-solid fa-gift"></i>
                            <span>${freeItem.isDirectory ? 'Explorar regalos' : '¡100% GRATIS!'}</span>
                        </div>

                        <!-- Plataforma -->
                        <div class="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                            ${escapeHTML(freeItem.storeName)}
                        </div>

                        <div class="absolute top-2.5 right-2.5 bg-black/75 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-400/30">
                            ${escapeHTML(freeItem.endDate)}
                        </div>
                    </div>

                    <div class="p-4 flex flex-col flex-grow">
                        <h3 class="text-white font-bold text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-emerald-400 transition" title="${escapeHTML(freeItem.title)}">
                            ${escapeHTML(freeItem.title)}
                        </h3>
                        <p class="text-xs text-gray-400 mt-1 mb-3 line-clamp-2 leading-relaxed">
                            ${escapeHTML(freeItem.description)}
                        </p>

                        <div class="mt-auto">
                            ${freeItem.isDirectory ? '<p class="text-xs text-gray-400 mb-3">Consulta los regalos disponibles en la tienda.</p>' : `<div class="price-box flex items-center justify-between bg-[#091119] px-3 py-2 rounded-xl mb-3 border border-emerald-500/20"
                                 data-normal-usd="${freeItem.normalUsd}" data-sale-usd="0" data-is-free="1">
                                <div>
                                    <span class="text-[10px] uppercase tracking-wider text-gray-400 block">Valor Normal</span>
                                    <span class="normal-val text-xs text-gray-500 line-through">${formatPrice(freeItem.normalUsd, false)}</span>
                                </div>
                                <div class="text-right">
                                    <span class="sale-val text-emerald-400 font-black text-base block">
                                        GRATIS ($0)
                                    </span>
                                </div>
                            </div>`}

                            <a href="${escapeHTML(safeURL(freeItem.claimUrl))}" target="_blank" rel="noopener noreferrer"
                               class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-gray-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60">
                                <i class="fa-solid fa-unlock-keyhole"></i>
                                <span>${freeItem.isDirectory ? 'Ver regalos en la tienda' : 'Reclamar Gratis Ahora'}</span>
                            </a>
                        </div>
                    </div>
                `;

                prepareImages(card);
                fragment.appendChild(card);
            });
            gamesGrid.appendChild(fragment);
        }

