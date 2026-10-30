        function expandGameAlias(query) {
            const aliases = { 'gta v': 'Grand Theft Auto V', 'gta 5': 'Grand Theft Auto V', 'gta iv': 'Grand Theft Auto IV', 'rdr2': 'Red Dead Redemption 2', 'rdr 2': 'Red Dead Redemption 2', 'cs2': 'Counter-Strike 2', 'gow': 'God of War', 'tlou': 'The Last of Us', 're4': 'Resident Evil 4' };
            return aliases[query.trim().toLowerCase().replace(/\s+/g, ' ')] || query.trim();
        }
        let searchTimer = null;
        let searchController = null;
        let searchGeneration = 0;
        function cancelSuggestions() {
            clearTimeout(searchTimer);
            searchController?.abort();
            searchGeneration++;
            searchDropdown.classList.add('hidden-el');
        }
        predictiveSearchInput.addEventListener('input', e => {
            cancelSuggestions();
            const query = e.target.value.trim();
            clearSearchBtn.classList.toggle('hidden-el', !query);
            if (query.length >= 2) searchTimer = setTimeout(() => fetchLiveSuggestions(query), 280);
        });
        clearSearchBtn.addEventListener('click', () => {
            cancelSuggestions();
            predictiveSearchInput.value = '';
            currentSearchQuery='';
            clearSearchBtn.classList.add('hidden-el');
            if (activeChip === 'search') selectSmartChip('top');
        });
        document.addEventListener('click', e => {
            if (!searchDropdown.contains(e.target) && e.target !== predictiveSearchInput) cancelSuggestions();
        });

        async function fetchLiveSuggestions(query) {
            if (activeEcosystem !== 'pc') return;
            const generation = searchGeneration;
            const controller = new AbortController();
            searchController = controller;
            try {
                const list = await requestJSON(`${GAMES_API}?title=${encodeURIComponent(expandGameAlias(query))}&limit=6`, { signal: controller.signal });
                if (generation !== searchGeneration || predictiveSearchInput.value.trim() !== query) return;

                searchDropdownContent.innerHTML = '';
                if (!Array.isArray(list) || list.length === 0) {
                    searchDropdownContent.innerHTML = `<div class="p-3.5 text-xs text-gray-400 text-center">Presiona Enter para buscar "${escapeHTML(query)}" en todo el catálogo</div>`;
                    searchDropdown.classList.remove('hidden-el');
                    return;
                }

                const fragment = document.createDocumentFragment();
                list.forEach(item => {
                    const thumb = item.steamAppID
                        ? `${STEAM_HEADER_IMG}${item.steamAppID}/header.jpg`
                        : item.thumb;

                    const row = document.createElement('div');
                    row.className = "p-2.5 hover:bg-steam-base/80 flex items-center justify-between gap-3 cursor-pointer transition";
                    row.innerHTML = `
                        <div class="flex items-center gap-3 min-w-0">
                            <img src="${escapeHTML(safeURL(thumb))}" alt="" data-fallback="${escapeHTML(safeURL(item.thumb))}" class="w-14 h-8 object-cover rounded border border-white/10 flex-shrink-0">
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-white truncate">${escapeHTML(item.external)}</p>
                                <span class="text-[10px] text-sky-400">Comparar Tiendas Oficiales + Keys</span>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <span class="text-xs font-extrabold text-emerald-400 block">${formatPrice(item.cheapest, true)}</span>
                        </div>
                    `;
                    row.addEventListener('click', () => {
                        searchDropdown.classList.add('hidden-el');
                        openAnalyticalModal({
                            gameID: item.gameID,
                            steamAppID: item.steamAppID,
                            title: item.external,
                            salePrice: item.cheapest,
                            normalPrice: item.cheapest,
                            thumb: item.thumb
                        });
                    });
                    prepareImages(row);
                    fragment.appendChild(row);
                });

                searchDropdownContent.appendChild(fragment);
                searchDropdown.classList.remove('hidden-el');
            } catch (err) {
                if (!controller.signal.aborted) console.warn("Error en sugerencias predictivas:", err);
            }
        }

        function handleSearchSubmit(e) {
            e.preventDefault();
            const q = predictiveSearchInput.value.trim();
            if (!q) return;

            cancelSuggestions();
            activeChip = 'search';
            currentSearchQuery = expandGameAlias(q);
            if (activeEcosystem !== 'pc') {
                queryConfig.onSale='0';updateScopeNote();
                sortContainer.classList.add('hidden-el');
                void loadConsoleCatalog();
                return;
            }

            document.querySelectorAll('.smart-chip').forEach(btn => btn.classList.remove('active', 'active-free'));
            freeGamesSubBar.classList.add('hidden-el');
            sortContainer.classList.remove('hidden-el');

            queryConfig.onSale = '0';
            updateScopeNote();
            queryConfig.minDiscount = 0;
            queryConfig.maxPriceUsd = 50;
            queryConfig.onlyAAA = false;

            setHeaderInfo(
                `🔎 Resultados para: "${q}"`,
                'Mostrando coincidencias con y sin descuento en tiendas oficiales y mercados de keys.',
                'fa-magnifying-glass',
                'sky'
            );
            executeCatalogFetch(true);
        }

