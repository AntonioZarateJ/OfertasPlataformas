        let modalController = null;
        let modalGeneration = 0;
        const modalLoadingTemplate = modalLoading.innerHTML;
        // --- 7. MODAL ANALÍTICO MULTITIENDA, MERCADOS DE KEYS Y MÍNIMO HISTÓRICO (FASE 2 & 3) ---
        function switchModalComparatorTab(tabName) {
            activeModalTab = tabName;
            if (tabName === 'official') {
                tabOfficialBtn.className = "flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 bg-sky-500 text-gray-950 shadow";
                tabKeysBtn.className = "flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 text-amber-300 hover:bg-white/5";
                officialStoresPanel.classList.remove('hidden-el');
                keyMarketsPanel.classList.add('hidden-el');
            } else {
                tabKeysBtn.className = "flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 bg-amber-400 text-gray-950 shadow";
                tabOfficialBtn.className = "flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 text-sky-300 hover:bg-white/5";
                officialStoresPanel.classList.add('hidden-el');
                keyMarketsPanel.classList.remove('hidden-el');
            }
        }

        function changeModalKeyPlatform(platKey) {
            modalKeyPlatform = platKey;
            document.querySelectorAll('.modal-plat-btn').forEach(btn => {
                if (btn.getAttribute('data-modal-plat') === platKey) {
                    btn.className = "modal-plat-btn px-2.5 py-1 rounded-lg text-xs font-extrabold bg-sky-500 text-gray-950 shadow";
                } else {
                    btn.className = "modal-plat-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-steam-base text-gray-300 hover:text-white";
                }
            });

            if (activeModalGameData && activeModalDealContext) {
                renderKeyMarketsList(activeModalGameData, activeModalDealContext);
            }
        }

        async function openAnalyticalModal(dealItem) {
            modalController?.abort();
            const controller = new AbortController();
            modalController = controller;
            const generation = ++modalGeneration;
            modalLoading.innerHTML = modalLoadingTemplate;
            activeModalDealContext = dealItem;
            activeModalGameData = null;
            modalKeyPlatform = activeEcosystem;

            // Si el usuario está en modo consola (Xbox/PS/Switch), abrimos directo la pestaña de Keys; si está en PC, Tiendas Oficiales
            switchModalComparatorTab(activeEcosystem === 'pc' ? 'official' : 'keys');
            changeModalKeyPlatform(activeEcosystem);

            const steamId = dealItem.steamAppID;
            const highResImg = steamId ? `${STEAM_HEADER_IMG}${steamId}/header.jpg` : (dealItem.thumb || '');

            modalHeaderImg.src = highResImg;
            modalCoverImg.src = highResImg;
            modalGameTitle.textContent = dealItem.title || 'Cargando...';
            syncModalWishlistAndAlertUI(dealItem);
            document.getElementById('regionalSteamQuote')?.remove();
            const regionalQuote = document.createElement('p');
            regionalQuote.id = 'regionalSteamQuote';
            regionalQuote.className = 'text-sm text-emerald-300 p-3';
            modalGameTitle.parentElement.appendChild(regionalQuote);
            if (steamId) void showSteamRegionalPrice(regionalQuote, steamId);

            if (steamId) {
                modalSteamDirectBtn.href = `${STEAM_APP_URL}${steamId}`;
                modalSteamDirectBtn.classList.remove('hidden-el');
                modalProtonDbBtn.href = `https://www.protondb.com/app/${steamId}`;
                modalProtonDbBtn.classList.remove('hidden-el');
            } else {
                modalSteamDirectBtn.classList.add('hidden-el');
                modalProtonDbBtn.href = `https://www.protondb.com/search?q=${encodeURIComponent(dealItem.title || '')}`;
                modalProtonDbBtn.classList.remove('hidden-el');
            }

            modalBadgesRow.innerHTML = '';
            if (dealItem.steamRatingPercent) {
                modalBadgesRow.innerHTML += `<span class="bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[11px] font-bold px-2 py-0.5 rounded">👍 ${escapeHTML(dealItem.steamRatingPercent)}% en Steam</span>`;
            }
            if (dealItem.metacriticScore && parseInt(dealItem.metacriticScore) > 0) {
                modalBadgesRow.innerHTML += `<span class="bg-amber-400 text-gray-950 font-black text-[11px] px-2 py-0.5 rounded">Metacritic ${escapeHTML(dealItem.metacriticScore)}</span>`;
            }
            if (checkSubscriptionHint(dealItem.title)) {
                modalBadgesRow.innerHTML += `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold px-2 py-0.5 rounded"><i class="fa-solid fa-ticket mr-1"></i>Frecuente en Game Pass / PS Plus</span>`;
            }

            analyticsModal.classList.remove('hidden-el');
            modalLoading.classList.remove('hidden-el');
            modalDataContent.classList.add('hidden-el');

            try {
                if (!dealItem.gameID) throw new Error('Juego sin identificador');
                const gameData = await requestJSON(`${GAMES_API}?id=${encodeURIComponent(dealItem.gameID)}`, { signal: controller.signal });
                if (generation !== modalGeneration) return;
                if (!gameData || !Array.isArray(gameData.deals)) throw new Error('Respuesta inválida');
                activeModalGameData = gameData;

                modalLoading.classList.add('hidden-el');
                modalDataContent.classList.remove('hidden-el');
                renderModalAnalyticsContent(gameData, dealItem);
            } catch (e) {
                if (controller.signal.aborted || generation !== modalGeneration) return;
                modalLoading.innerHTML = `<p class="text-xs text-rose-400">No se pudo obtener el desglose de tiendas en este momento.</p>`;
            }
        }

        function renderModalAnalyticsContent(gameData, dealContext) {
            document.querySelectorAll('.modal-currency-label').forEach(el => el.textContent = currentCurrency);

            const dealsList = [...(gameData.deals || [])].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            const bestDeal = dealsList[0] || { price: dealContext.salePrice || 0, retailPrice: dealContext.normalPrice || 0 };

            const currentLowestUsd = parseFloat(bestDeal.price || 0);
            const retailUsd = parseFloat(bestDeal.retailPrice || dealContext.normalPrice || currentLowestUsd);
            const cheapestEver = gameData.cheapestPriceEver || { price: currentLowestUsd, date: Date.now() / 1000 };
            const historicalLowUsd = parseFloat(cheapestEver.price ?? currentLowestUsd);
            const histDate = new Date((cheapestEver.date || Date.now() / 1000) * 1000).toLocaleDateString('es-MX', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            const isHistoricalLow = currentLowestUsd <= (historicalLowUsd + 0.05);

            if (isHistoricalLow) {
                historicalLowBanner.className = "rounded-xl p-4 border bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border-amber-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4";
                historicalLowBanner.innerHTML = `
                    <div class="flex items-center gap-3.5">
                        <div class="w-11 h-11 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center text-xl font-black shadow-lg flex-shrink-0">
                            <i class="fa-solid fa-fire-flame-curved"></i>
                        </div>
                        <div>
                            <span class="text-[11px] font-black uppercase tracking-wider text-amber-400 block">¡Mínimo Histórico Detectado!</span>
                            <h4 class="text-white font-bold text-sm">Hoy está en su precio más bajo registrado en tiendas oficiales.</h4>
                            <p class="text-xs text-gray-300 mt-0.5">Récord registrado el ${histDate}.</p>
                        </div>
                    </div>
                    <div class="bg-black/40 px-3.5 py-2 rounded-lg border border-amber-400/30 text-right">
                        <span class="text-[10px] text-gray-400 block">Mínimo Histórico</span>
                        <span class="text-amber-400 font-black text-base">${formatPrice(historicalLowUsd, true)}</span>
                    </div>
                `;
            } else {
                historicalLowBanner.className = "rounded-xl p-4 border bg-[#152033] border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4";
                historicalLowBanner.innerHTML = `
                    <div class="flex items-center gap-3.5">
                        <div class="w-11 h-11 rounded-xl bg-steam-base text-sky-400 flex items-center justify-center text-xl border border-sky-400/30 flex-shrink-0">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </div>
                        <div>
                            <span class="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">Registro Histórico</span>
                            <h4 class="text-white font-semibold text-sm">Su mínimo histórico oficial fue de <strong class="text-emerald-400">${formatPrice(historicalLowUsd, true)}</strong></h4>
                            <p class="text-xs text-gray-400 mt-0.5">Alcanzado el ${histDate}.</p>
                        </div>
                    </div>
                `;
            }

            const maxRef = Math.max(retailUsd, currentLowestUsd, historicalLowUsd, 1);
            const curPct = Math.max(12, Math.round((currentLowestUsd / maxRef) * 100));
            const histPct = Math.max(12, Math.round((historicalLowUsd / maxRef) * 100));

            priceComparisonBars.innerHTML = `
                <div class="bg-[#121a2a] p-3.5 rounded-xl border border-white/5">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-gray-400">Precio Regular</span>
                        <span class="text-gray-300 font-bold line-through">${formatPrice(retailUsd, true)}</span>
                    </div>
                    <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
                        <div class="bg-gray-500 h-full rounded-full" style="width: 100%"></div>
                    </div>
                </div>
                <div class="bg-[#121a2a] p-3.5 rounded-xl border border-emerald-500/30">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-emerald-400 font-semibold">Referencia CheapShark (USD convertido)</span>
                        <span class="text-emerald-400 font-black">${formatPrice(currentLowestUsd, true)}</span>
                    </div>
                    <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
                        <div class="bg-emerald-400 h-full rounded-full" style="width: ${curPct}%"></div>
                    </div>
                </div>
                <div class="bg-[#121a2a] p-3.5 rounded-xl border border-amber-400/30">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-amber-400 font-semibold">Mínimo Histórico</span>
                        <span class="text-amber-400 font-black">${formatPrice(historicalLowUsd, true)}</span>
                    </div>
                    <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
                        <div class="bg-amber-400 h-full rounded-full" style="width: ${histPct}%"></div>
                    </div>
                </div>
            `;

            modalStoresCount.textContent = `${dealsList.length}`;
            multiStoreList.innerHTML = '';

            dealsList.forEach((deal, idx) => {
                const st = storesMap[deal.storeID] || { name: `Tienda #${deal.storeID}`, icon: '' };
                const savings = Math.round(parseFloat(deal.savings || 0));
                const isBest = idx === 0;

                const row = document.createElement('div');
                row.className = `flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border transition ${
                    isBest ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-[#151f30] border-white/5 hover:border-sky-400/40'
                }`;

                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        ${st.icon ? `<img src="${escapeHTML(safeURL(st.icon))}" alt="${escapeHTML(st.name)}" class="w-6 h-6 rounded">` : `<i class="fa-solid fa-store text-sky-400"></i>`}
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold text-white">${escapeHTML(st.name)}</span>
                                ${isBest ? `<span class="text-[10px] bg-emerald-400 text-gray-950 px-2 py-0.5 rounded font-black uppercase">Referencia</span>` : ''}
                            </div>
                            <span class="text-[11px] text-gray-400">Distribuidor Autorizado • Normal: ${formatPrice(deal.retailPrice, false)}</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 ml-auto">
                        ${savings > 0 ? `<span class="bg-steam-greenBg text-steam-green text-xs font-extrabold px-2 py-1 rounded">-${savings}%</span>` : ''}
                        <div class="text-right min-w-[95px]">
                            <span class="text-base font-black text-white block">${formatPrice(deal.price, true)}</span>
                        </div>
                        <a href="${escapeHTML(dealRedirectURL(deal.dealID))}" target="_blank" rel="noopener noreferrer"
                           class="bg-sky-400 hover:bg-sky-300 text-gray-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5">
                            <span>Ir a Tienda</span>
                            <i class="fa-solid fa-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                `;
                multiStoreList.appendChild(row);
                if (String(deal.storeID) === '1' && dealContext.steamAppID) {
                    void steamRegionalPrice(dealContext.steamAppID).then(quote => {
                        if (!quote || !row.isConnected || currentCurrency !== quote.currency) return;
                        const price = row.querySelector('.text-base.font-black');
                        if (price) price.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: quote.currency }).format(quote.amount) + ' ' + quote.currency + ' (' + purchaseRegions[quote.region][0] + ')';
                    });
                }
            });

            // Guardar una alerta desde el modal debe usar el precio comparado actual.
            dealContext.salePrice = currentLowestUsd.toFixed(2);
            dealContext.normalPrice = retailUsd.toFixed(2);
            updateSavedPrices([dealContext]);
            syncModalWishlistAndAlertUI(dealContext);

            // Renderizar Pestaña 2: Mercados de Keys (Eneba, CDKeys, G2A, Instant Gaming, Kinguin)
            renderKeyMarketsList(gameData, dealContext);
        }

        function renderKeyMarketsList(gameData, dealContext) {
            keyStoresList.innerHTML = '';
            const title = dealContext.title || (gameData.info && gameData.info.title) || 'Game';
            const dealsList = [...(gameData.deals || [])].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

            const platMeta = ECOSYSTEM_META[modalKeyPlatform] || ECOSYSTEM_META.pc;

            KEY_MARKETS_CATALOG.forEach((market, index) => {
                // Estimación orientativa basada en el mejor precio actual

                const searchUrl = market.buildUrl(title, modalKeyPlatform);

                const item = document.createElement('div');
                item.className = "flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#151f30] border border-amber-500/25 hover:border-amber-400/70 transition";

                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${market.color} text-white flex items-center justify-center font-black shadow-md flex-shrink-0">
                            <i class="${market.icon}"></i>
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-sm font-black text-white">${market.name}</span>
                                <span class="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-bold">${market.badge}</span>
                                <span class="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                                    <i class="fa-solid fa-shield-halved mr-0.5"></i>Revisar vendedor
                                </span>
                            </div>
                            <p class="text-[11px] text-gray-400 mt-0.5">
                                <strong class="text-sky-300">${platMeta.shortBadge} (Comprobar región)</strong> • ${market.paymentInfo}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 ml-auto">
                        <div class="text-right">
                            <span class="text-[10px] uppercase tracking-wider text-gray-400 block">Precio no verificado</span>
                            <span class="text-base font-black text-amber-300 block">Consultar tienda</span>
                        </div>
                        <a href="${escapeHTML(safeURL(searchUrl))}" target="_blank" rel="noopener noreferrer"
                           class="bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-gray-950 font-black text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg">
                            <i class="fa-solid fa-key"></i>
                            <span>Buscar Key (${platMeta.shortBadge.split(' ')[0]})</span>
                            <i class="fa-solid fa-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                `;

                keyStoresList.appendChild(item);
            });
        }

        function closeAnalyticsModal() {
            modalController?.abort();
            modalGeneration++;
            analyticsModal.classList.add('hidden-el');
        }
        closeAnalyticsModalBtn.addEventListener('click', closeAnalyticsModal);
        analyticsModal.addEventListener('click', (e) => {
            if (e.target === analyticsModal) closeAnalyticsModal();
        });

        function showLoader(msg) {
            if (msg) loadingText.textContent = msg;
            loadingState.classList.remove('hidden-el');
            gamesGrid.classList.add('hidden-el');
        }

        function hideLoader() {
            loadingState.classList.add('hidden-el');
            gamesGrid.classList.remove('hidden-el');
        }

