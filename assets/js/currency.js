        const priceFormatters = new Map();
        function formatPrice(usdAmount, includeCode = true) {
            const num = parseFloat(usdAmount);
            if (!Number.isFinite(num) || num < 0) return includeCode ? `— ${currentCurrency}` : '—';
            const rate = exchangeRates[currentCurrency] || 1;
            const converted = num * rate;
            const cfg = CURRENCY_CONFIG[currentCurrency] || { locale: 'es-MX', decimals: 2 };

            if (!priceFormatters.has(currentCurrency)) priceFormatters.set(currentCurrency, new Intl.NumberFormat(cfg.locale, {
                style: 'currency',
                currency: currentCurrency,
                minimumFractionDigits: cfg.decimals,
                maximumFractionDigits: cfg.decimals
            }));
            const formatted = priceFormatters.get(currentCurrency).format(converted);

            return includeCode ? `${formatted} ${currentCurrency}` : formatted;
        }

        function updateExchangeBadge() {
            if (currentCurrency === 'USD') {
                exchangeRateBadge.textContent = `Base: 1.00 USD`;
            } else {
                exchangeRateBadge.textContent = `1 USD ≈ ${formatPrice(1, true)}`;
            }
        }

        currencySelect.addEventListener('change', (e) => {
            currentCurrency = e.target.value;
            updateExchangeBadge();
            updateDrawerLabels();
            updateAllPricesOnScreen();

            if (!analyticsModal.classList.contains('hidden-el') && activeModalGameData) {
                renderModalAnalyticsContent(activeModalGameData, activeModalDealContext);
                syncModalWishlistAndAlertUI(activeModalDealContext);
            }
            if (!document.getElementById('wishlistDrawerModal').classList.contains('hidden-el')) renderWishlistDrawerItems();
        });

        function updateAllPricesOnScreen() {
            const boxes = document.querySelectorAll('.price-box');
            boxes.forEach(box => {
                const normalUsd = box.getAttribute('data-normal-usd');
                const saleUsd = box.getAttribute('data-sale-usd');
                const isFreeCard = box.getAttribute('data-is-free') === '1';

                const normalEl = box.querySelector('.normal-val');
                const saleEl = box.querySelector('.sale-val');

                if (normalEl && normalUsd) normalEl.textContent = formatPrice(normalUsd, false);
                if (saleEl && !isFreeCard && saleUsd) saleEl.textContent = currentCurrency === box.dataset.regionalCurrency ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: currentCurrency }).format(Number(box.dataset.regionalAmount)) + ' ' + currentCurrency : formatPrice(saleUsd, true);

                box.classList.remove('price-flash');

            });

            if (boxes.length) {
                void gamesGrid.offsetWidth;
                boxes.forEach(box => box.classList.add('price-flash'));
            }
            noticeCurrencyCode.textContent = currentCurrency;
            liveCurrencyNotice.classList.remove('hidden-el');
        }

