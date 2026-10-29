        // --- 1.5 SELECTOR DE ECOSISTEMA / PLATAFORMA (FASE 2: PC, XBOX, PLAYSTATION, SWITCH) ---
        function selectEcosystem(ecoKey) {
            if (!ECOSYSTEM_META[ecoKey]) return;
            document.getElementById('platformPriceNotice').classList.toggle('hidden-el', ecoKey === 'pc');
            activeEcosystem = ecoKey;
            modalKeyPlatform = ecoKey;

            // Actualizar botones superiores
            document.querySelectorAll('.plat-pill').forEach(btn => {
                const key = btn.getAttribute('data-ecosystem');
                btn.className = "plat-pill flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:text-white border border-transparent flex items-center justify-center gap-1.5";
                if (key === ecoKey) {
                    btn.classList.add(`active-${ecoKey}`, 'font-extrabold', 'text-white');
                }
            });

            // Actualizar badge de plataforma activa
            const meta = ECOSYSTEM_META[ecoKey];
            activeEcosystemBadge.className = `text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${meta.colorClass}`;
            activeEcosystemBadge.innerHTML = `<i class="${meta.icon} mr-1"></i>Modo: ${meta.name}`;

            cancelCatalogRequest();
            cancelSuggestions();
            currentDeals = [];
            currentSearchQuery = '';
            gamesGrid.replaceChildren();
            document.getElementById('platformPriceNotice').classList.add('hidden-el');
            document.getElementById('consoleTools').classList.toggle('hidden-el', ecoKey === 'pc');
            document.querySelectorAll('[data-chip]').forEach(button => {
                if (!['top', 'all'].includes(button.dataset.chip)) button.classList.toggle('hidden-el', ecoKey !== 'pc');
            });
            document.getElementById('toggleFineTuneBtn').classList.toggle('hidden-el', ecoKey !== 'pc');
            fineTuneDrawer.classList.add('hidden-el');
            selectSmartChip('top');
        }

        // --- 2. NAVEGACIÓN POR PÍLDORAS INTELIGENTES (SMART CHIPS) ---
        function selectSmartChip(chipKey) {
            cancelCatalogRequest();
            cancelSuggestions();
            document.getElementById('catalogError').classList.add('hidden-el');
            activeChip = chipKey;
            currentSearchQuery = '';
            if (activeEcosystem !== 'pc') {
                document.querySelectorAll('[data-chip]').forEach(button => button.classList.toggle('active', button.dataset.chip === chipKey));
                freeGamesSubBar.classList.add('hidden-el');
                sortContainer.classList.add('hidden-el');
                document.getElementById('consoleOnlyDeals').checked = chipKey !== 'all';
                void loadConsoleCatalog();
                return;
            }

            // Actualizar estilos de las píldoras
            document.querySelectorAll('.smart-chip').forEach(btn => {
                const key = btn.getAttribute('data-chip');
                btn.classList.remove('active', 'active-free');
                if (key === chipKey) {
                    if (chipKey === 'free') {
                        btn.classList.add('active-free');
                    } else {
                        btn.classList.add('active');
                    }
                }
            });

            // Mostrar u ocultar sub-barra de Juegos Gratis
            if (chipKey === 'free') {
                activeFreePlatform = activeEcosystem === 'pc' ? 'all' : 'console';
                freeGamesSubBar.classList.remove('hidden-el');
                sortContainer.classList.add('hidden-el');
                fineTuneDrawer.classList.add('hidden-el');
                loadFreeGamesMode();
                return;
            } else {
                freeGamesSubBar.classList.add('hidden-el');
                sortContainer.classList.remove('hidden-el');
            }

            // Configurar presets automáticos según la píldora elegida
            if (chipKey === 'top') {
                queryConfig = { onSale: '1', minDiscount: 0, steamRating: 0, maxPriceUsd: 50, onlyAAA: false, sortBy: 'Deal Rating' };
                sortSelect.value = 'Deal Rating';
                setHeaderInfo('🔥 Ofertas Top Destacadas', 'Juegos con la mejor relación descuento/calidad en este momento.', 'fa-fire', 'sky');
            } else if (chipKey === 'gems') {
                queryConfig = { onSale: '1', minDiscount: 70, steamRating: 80, maxPriceUsd: 50, onlyAAA: false, sortBy: 'Reviews' };
                sortSelect.value = 'Reviews';
                setHeaderInfo('💎 Joyas Ocultas Aclamadas', 'Filtro inteligente activo: Rebaja mínima del 70% + Reseñas Muy Positivas (>=80%) en Steam.', 'fa-gem', 'cyan');
            } else if (chipKey === 'aaa') {
                queryConfig = { onSale: '1', minDiscount: 20, steamRating: 0, maxPriceUsd: 50, onlyAAA: true, sortBy: 'Savings' };
                sortSelect.value = 'Savings';
                setHeaderInfo('👑 Grandes Producciones (AAA)', 'Títulos de alto presupuesto (Precio normal >= $29.99 USD) actualmente en oferta.', 'fa-crown', 'amber');
            } else if (chipKey === 'deep') {
                queryConfig = { onSale: '1', minDiscount: 85, steamRating: 0, maxPriceUsd: 50, onlyAAA: false, sortBy: 'Savings' };
                sortSelect.value = 'Savings';
                setHeaderInfo('📉 Descuentos Extremos (-85% a -95%)', 'Juegos a precio de remate con al menos 85% de rebaja verificada.', 'fa-arrow-trend-down', 'emerald');
            } else if (chipKey === 'all') {
                queryConfig = { onSale: '0', minDiscount: 0, steamRating: 0, maxPriceUsd: 50, onlyAAA: false, sortBy: 'Deal Rating' };
                sortSelect.value = 'Deal Rating';
                setHeaderInfo('🌐 Explorador de Todo el Catálogo', 'Mostrando juegos con y sin oferta para comparar precios en todas las tiendas.', 'fa-earth-americas', 'purple');
            } else if (chipKey === 'wishlist') {
                sortContainer.classList.add('hidden-el');
                fineTuneDrawer.classList.add('hidden-el');
                setHeaderInfo('❤️ Mi Wishlist & Alertas Activas', 'Tus juegos guardados. Los precios se actualizan al consultar tu wishlist.', 'fa-heart', 'sky');
                renderWishlistChipMode();
                void refreshWishlistPrices();
                return;
            }

            activeCustomFiltersDot.classList.add('hidden-el');
            syncSlidersWithConfig();
            executeCatalogFetch(true);
        }

        function renderWishlistChipMode() {
            cancelCatalogRequest();
            hideLoader();
            gamesGrid.innerHTML = '';
            loadMoreContainer.classList.add('hidden-el');
            const savedList = Object.values(userWishlist);
            loadedCountBadge.textContent = savedList.length;

            if (savedList.length === 0) {
                emptyState.classList.remove('hidden-el');
                return;
            }
            emptyState.classList.add('hidden-el');
            renderStandardGameCards(savedList);
        }

        function setHeaderInfo(title, subtitle, iconClass, colorKey) {
            catalogHeaderTitle.textContent = title;
            resultsSummary.textContent = subtitle;

            const colors = {
                sky: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
                emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
                purple: 'bg-purple-500/15 border-purple-500/30 text-purple-400'
            };
            modeIconBox.className = `w-11 h-11 rounded-xl border flex items-center justify-center text-xl ${colors[colorKey] || colors.sky}`;
            modeIconBox.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        }

        sortSelect.addEventListener('change', () => {
            queryConfig.sortBy = sortSelect.value;
            if (!['free', 'wishlist'].includes(activeChip)) {
                executeCatalogFetch(true);
            }
        });

