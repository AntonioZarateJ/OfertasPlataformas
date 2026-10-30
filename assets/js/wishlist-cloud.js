        // --- 8. FUNCIONES DE WISHLIST DRAWER, ALERTAS DE PRECIO Y CLOUD MODAL (FASE 3) ---
        function syncModalWishlistAndAlertUI(dealItem) {
            if (!dealItem) return;
            const gId = String(dealItem.gameID || dealItem.dealID || dealItem.title);
            const saved = userWishlist[gId];
            const iconEl = document.getElementById('modalWishlistIcon');
            const textEl = document.getElementById('modalWishlistBtnText');
            const statusBadge = document.getElementById('modalAlertStatusBadge');
            const inputEl = document.getElementById('modalTargetPriceInput');
            const rate = exchangeRates[currentCurrency] || 1;

            if (saved) {
                if (iconEl) iconEl.className = 'fa-solid fa-heart text-rose-400';
                if (textEl) textEl.textContent = 'En tu Wishlist';
                if (saved.targetPriceUsd) {
                    if (statusBadge) {
                        statusBadge.classList.remove('hidden-el');
                        statusBadge.textContent = `Meta: ${formatPrice(saved.targetPriceUsd, true)}`;
                    }
                    if (inputEl) inputEl.value = (parseFloat(saved.targetPriceUsd) * rate).toFixed(CURRENCY_CONFIG[currentCurrency]?.decimals ?? 2);
                } else {
                    if (statusBadge) statusBadge.classList.add('hidden-el');
                    if (inputEl) inputEl.value = '';
                }
            } else {
                if (iconEl) iconEl.className = 'fa-regular fa-heart';
                if (textEl) textEl.textContent = 'Guardar';
                if (statusBadge) statusBadge.classList.add('hidden-el');
                const suggestedLocal = Math.max(1, parseFloat(dealItem.salePrice || 10) * 0.85 * rate);
                if (inputEl) inputEl.value = suggestedLocal.toFixed(CURRENCY_CONFIG[currentCurrency]?.decimals ?? 0);
            }
        }

        function toggleModalGameWishlist() {
            if (!activeModalDealContext) return;
            toggleGameWishlist(activeModalDealContext);
            syncModalWishlistAndAlertUI(activeModalDealContext);
        }

        function saveModalPriceAlert() {
            if (!activeModalDealContext) return;
            const inputEl = document.getElementById('modalTargetPriceInput');
            const rawVal = parseFloat(inputEl.value);
            if (!Number.isFinite(rawVal) || rawVal <= 0) {
                showToast('Ingresa un monto válido para tu alerta de precio', 'fa-solid fa-triangle-exclamation text-amber-400');
                return;
            }
            const rate = exchangeRates[currentCurrency] || 1;
            const targetUsd = Math.max(0.01, rawVal / rate).toFixed(2);
            toggleGameWishlist(activeModalDealContext, targetUsd);
            syncModalWishlistAndAlertUI(activeModalDealContext);
        }

        function openWishlistDrawer() {
            renderWishlistDrawerItems();
            document.getElementById('wishlistDrawerModal').classList.remove('hidden-el');
            void refreshWishlistPrices();
            void refreshConsoleWishlistPrices();
        }

        function closeWishlistDrawer() {
            document.getElementById('wishlistDrawerModal').classList.add('hidden-el');
        }

        function renderWishlistDrawerItems() {
            const container = document.getElementById('wishlistItemsContainer');
            const all = Object.values(userWishlist);
            const hasGoal = item => Number(item.native ? item.targetPrice : item.targetPriceUsd) > 0;
            const reached = item => hasGoal(item) && Number(item.native ? item.price : item.salePrice) <= Number(item.native ? item.targetPrice : item.targetPriceUsd);
            document.getElementById('wishGoalsCount').textContent = all.filter(hasGoal).length;
            document.getElementById('wishReachedCount').textContent = all.filter(reached).length;
            document.getElementById('wishlistSyncStatusText').textContent = window.currentAccount ? 'Favoritos asociados a tu cuenta' : 'Guardados en este navegador';
            document.getElementById('wishAccountAction').textContent = window.currentAccount ? 'Ver mi perfil' : 'Iniciar sesión para guardar en mi cuenta';
            const search = document.getElementById('wishSearch').value.trim().toLocaleLowerCase('es');
            const platform = document.getElementById('wishPlatform').value;
            const order = document.getElementById('wishOrder').value;
            const list = all.filter(item => item.title.toLocaleLowerCase('es').includes(search)
                && (platform === 'all' || (item.native ? item.platform : 'pc') === platform)
                && (order !== 'goals' || hasGoal(item)) && (order !== 'reached' || reached(item)))
                .sort((a,b) => order === 'title' ? a.title.localeCompare(b.title, 'es') : (b.addedAt || 0) - (a.addedAt || 0));
            container.innerHTML = '';

            if (list.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12 px-4">
                        <div class="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3 text-lg">
                            <i class="fa-regular fa-heart"></i>
                        </div>
                        <h4 class="text-sm font-bold text-white mb-1">${all.length ? 'No hay favoritos con estos filtros' : 'Tu próxima aventura empieza aquí'}</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            ${all.length ? 'Prueba otro nombre o cambia los filtros de plataforma y metas.' : 'Pulsa el corazón en un juego para guardarlo. También puedes elegir el precio que te gustaría pagar.'}
                        </p>
                    </div>
                `;
                return;
            }

            list.forEach(item => {
                if(item.native){container.appendChild(renderConsoleWishCard(item));return;}
                const saleUsd = parseFloat(item.salePrice || 0);
                const targetUsd = item.targetPriceUsd ? parseFloat(item.targetPriceUsd) : null;
                const alertMet = targetUsd !== null && saleUsd <= targetUsd;
                const img = item.steamAppID ? `${STEAM_HEADER_IMG}${item.steamAppID}/header.jpg` : item.thumb;

                const card = document.createElement('div');
                card.className = `wish-game-card p-3 rounded-xl border transition flex flex-col gap-2.5 ${
                    alertMet ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-[#141e33] border-white/10'
                }`;

                card.innerHTML = `
                    <div class="flex items-center gap-3">
                        <img src="${escapeHTML(safeURL(img))}" alt="${escapeHTML(item.title)}" data-fallback="${escapeHTML(safeURL(item.thumb))}"
                             class="w-16 h-10 object-cover rounded-lg border border-white/10 flex-shrink-0 cursor-pointer">
                        <div class="min-w-0 flex-1">
                            <span class="wish-platform-tag"><i class="fa-brands fa-steam"></i> PC · Comparar tiendas</span>
                            <button type="button" class="wish-game-title">${escapeHTML(item.title)}</button>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-xs font-black text-emerald-400">${formatPrice(saleUsd, true)}</span>
                                ${item.savings > 0 ? `<span class="text-[10px] bg-steam-greenBg text-steam-green px-1.5 py-0.5 rounded font-bold">-${item.savings}%</span>` : ''}
                            </div>
                        </div>
                        <button type="button" class="remove-wish-btn text-gray-400 hover:text-rose-400 p-1.5" title="Eliminar" aria-label="Quitar ${escapeHTML(item.title)} de favoritos">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                    ${targetUsd !== null ? `
                        <div class="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg ${
                            alertMet ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-[#0b101b] text-amber-300 border border-amber-500/20'
                        }">
                            <span><i class="fa-solid fa-bell mr-1"></i>Meta: <strong>${formatPrice(targetUsd, true)}</strong></span>
                            <span class="font-extrabold">${alertMet ? '¡META ALCANZADA! 🔥' : 'Último precio consultado'}</span>
                        </div>
                    ` : ''}
                `;

                card.querySelector('img').addEventListener('click', () => {
                    closeWishlistDrawer();
                    openAnalyticalModal(item);
                });
                card.querySelector('.wish-game-title').addEventListener('click', () => {
                    closeWishlistDrawer();
                    openAnalyticalModal(item);
                });
                card.querySelector('.remove-wish-btn').addEventListener('click', () => {
                    delete userWishlist[item.gameID];
                    persistWishlistState();
                    refreshWishlistHeartButtonsOnGrid();
                    renderWishlistDrawerItems();
                    if (activeChip === 'wishlist') renderWishlistChipMode();
                });

                prepareImages(card);
                container.appendChild(card);
            });
        }

        function clearEntireWishlist() {
            userWishlist = Object.create(null);
            persistWishlistState();
            refreshWishlistHeartButtonsOnGrid();
            renderWishlistDrawerItems();
            if (activeChip === 'wishlist') renderWishlistChipMode();
            showToast('Wishlist vaciada correctamente', 'fa-solid fa-trash text-rose-400');
        }

        function exportWishlistJson() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userWishlist, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", `steampulse_wishlist_${ currentCurrency.toLowerCase() }.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
            showToast('Archivo JSON exportado con éxito');
        }

        function openCloudConfigModal() {
            closeWishlistDrawer();
            document.getElementById('cloudConfigModal').classList.remove('hidden-el');
            renderAccount();
            void refreshAccountVerification();
        }
        function closeCloudConfigModal() { document.getElementById('cloudConfigModal').classList.add('hidden-el'); }

        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            cancelSuggestions();
            closeAnalyticsModal();
            closeWishlistDrawer();
            closeCloudConfigModal();
        });
