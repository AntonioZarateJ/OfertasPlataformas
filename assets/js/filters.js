        // --- 3. CAJÓN OCULTO DE "AJUSTES FINOS" ---
        toggleFineTuneBtn.addEventListener('click', () => {
            fineTuneDrawer.classList.toggle('hidden-el');
        });

        function updateDrawerLabels() {
            const disc = parseInt(drawerDiscountSlider.value);
            drawerDiscountLabel.textContent = disc === 0 ? '0% (Todos)' : `-${disc}% o más`;

            const rat = parseInt(drawerRatingSlider.value);
            drawerRatingLabel.textContent = rat === 0 ? 'Todas' : `>= ${rat}% Positivas`;

            const maxP = parseInt(drawerPriceSlider.value);
            drawerPriceLabel.textContent = maxP >= 50 ? 'Sin límite' : `Máx ${formatPrice(maxP, true)}`;
            drawerMinPriceHint.textContent = formatPrice(5, false);
            drawerMidPriceHint.textContent = formatPrice(25, false);
        }

        function syncSlidersWithConfig() {
            drawerDiscountSlider.value = queryConfig.minDiscount;
            drawerRatingSlider.value = queryConfig.steamRating;
            drawerPriceSlider.value = queryConfig.maxPriceUsd;
            drawerOnSaleToggle.checked = queryConfig.onSale === '1';
            updateDrawerLabels();
        }

        [drawerDiscountSlider, drawerRatingSlider, drawerPriceSlider].forEach(el => {
            el.addEventListener('input', updateDrawerLabels);
        });

        function applyCustomDrawerFilters() {
            cancelSuggestions();
            currentSearchQuery = '';
            activeChip = 'custom';
            document.querySelectorAll('.smart-chip').forEach(btn => btn.classList.remove('active', 'active-free'));
            freeGamesSubBar.classList.add('hidden-el');
            sortContainer.classList.remove('hidden-el');

            queryConfig.minDiscount = parseInt(drawerDiscountSlider.value);
            queryConfig.steamRating = parseInt(drawerRatingSlider.value);
            queryConfig.maxPriceUsd = parseInt(drawerPriceSlider.value);
            queryConfig.onSale = drawerOnSaleToggle.checked ? '1' : '0';
            queryConfig.onlyAAA = false;

            activeCustomFiltersDot.classList.remove('hidden-el');
            setHeaderInfo(
                '⚙️ Catálogo con Ajustes Finos Personalizados',
                `Descuento >= ${queryConfig.minDiscount}% • Reseñas >= ${queryConfig.steamRating}% • ${queryConfig.maxPriceUsd < 50 ? 'Tope ' + formatPrice(queryConfig.maxPriceUsd, true) : 'Sin tope de precio'}`,
                'fa-sliders',
                'sky'
            );
            executeCatalogFetch(true);
        }

        function resetFineTuneFilters() {
            selectSmartChip('top');
            fineTuneDrawer.classList.add('hidden-el');
        }

