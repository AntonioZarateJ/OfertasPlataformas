        // --- INICIO ---
        window.addEventListener('DOMContentLoaded', async () => {
            loadCloudStateFromStorage();
            updateDrawerLabels();
            updateWishlistCountersUI();
            updateExchangeBadge();
            selectSmartChip('top');
            // El catálogo no espera a servicios auxiliares.
            void loadExchangeRates();
            void loadStoresCatalog();
        });

        // --- CARGA DE TASAS DE CAMBIO Y CATÁLOGO DE TIENDAS ---
        async function loadExchangeRates() {
            try {
                const data = await requestJSON(EXCHANGE_API, { ttl: 3600000 });
                if (data && data.rates) {
                    Object.entries(data.rates).forEach(([currency, rate]) => {
                        if (Number.isFinite(rate) && rate > 0) exchangeRates[currency] = rate;
                    });
                }
            } catch (e) {
                console.warn("Usando tasas de respaldo:", e);
            }
            updateExchangeBadge();
            updateDrawerLabels();
            updateAllPricesOnScreen();
        }

        async function loadStoresCatalog() {
            try {
                const list = await requestJSON(STORES_API, { ttl: 3600000 });
                if (Array.isArray(list)) {
                    list.forEach(st => {
                        storesMap[st.storeID] = {
                            name: st.storeName,
                            active: st.isActive !== 0,
                            icon: st.images?.icon ? `https://www.cheapshark.com${st.images.icon}` : ''
                        };
                    });
                }
            } catch (e) {
                console.warn("Error cargando catálogo de tiendas:", e);
            }
        }

