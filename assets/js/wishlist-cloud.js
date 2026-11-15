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

        function appendWishlistReview(card, item) {
            card.dataset.wishKey = item.gameID;
            const review = document.createElement('div');
            review.className = 'wish-card-review';
            const difference = wishlistPriceDifference(item);
            if (difference) {
                const change = document.createElement('p');
                change.className = difference < 0 ? 'wish-price-down' : 'wish-price-up';
                const currency = item.native ? item.currency : 'USD';
                change.textContent = `${difference < 0 ? 'Bajó' : 'Subió'} ${nativeMoney(Math.abs(difference), currency)}${item.native ? '' : ' · Referencia'}`;
                review.append(change);
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wish-owned-button';
            button.textContent = 'Ya lo tengo';
            button.setAttribute('aria-label', 'Ya lo tengo: ' + item.title);
            button.setAttribute('aria-pressed', String(Boolean(item.owned)));
            button.addEventListener('click', () => {
                const saved = userWishlist[item.gameID];
                if (!saved) return;
                if (saved.owned) {
                    delete saved.owned;
                    void refreshWishlistPrices();
                    void refreshConsoleWishlistPrices();
                } else {
                    saved.owned = true;
                }
                persistWishlistState();
                refreshWishlistHeartButtonsOnGrid();
                renderWishlistDrawerItems();
            });
            review.append(button);
            card.append(review);
        }

        function renderWishlistDrawerItems() {
            const container = document.getElementById('wishlistItemsContainer');
            const focusedKey = document.activeElement?.matches('.wish-owned-button') ?
                document.activeElement.closest('[data-wish-key]').dataset.wishKey : null;
            const all = Object.values(userWishlist);
            const lower = all.filter(item => wishlistPriceDifference(item) < 0).length;
            const higher = all.filter(item => wishlistPriceDifference(item) > 0).length;
            document.getElementById('wishLowerCount').textContent = lower;
            document.getElementById('wishHigherCount').textContent = higher;
            document.getElementById('wishChangeCount').textContent = lower + higher ? String(lower + higher) : '';
            document.getElementById('wishGoalsCount').textContent = all.filter(wishlistHasGoal).length;
            document.getElementById('wishReachedCount').textContent = all.filter(wishlistGoalReached).length;
            document.getElementById('wishlistSyncStatusText').textContent = window.currentAccount ? 'Favoritos asociados a tu cuenta' : 'Guardados en este navegador';
            document.getElementById('wishAccountAction').textContent = window.currentAccount ? 'Ver mi perfil' : 'Iniciar sesión para guardar en mi cuenta';
            const search = document.getElementById('wishSearch').value.trim().toLocaleLowerCase('es');
            const platform = document.getElementById('wishPlatform').value;
            const order = document.getElementById('wishOrder').value;
            const hideOwned = document.getElementById('wishHideOwned');
            const list = all.filter(item => item.title.toLocaleLowerCase('es').includes(search)
                && (platform === 'all' || (item.native ? item.platform : 'pc') === platform)
                && (!hideOwned.checked || !item.owned) && (order !== 'changed' || wishlistPriceDifference(item))
                && (order !== 'goals' || wishlistHasGoal(item)) && (order !== 'reached' || wishlistGoalReached(item)))
                .sort((a,b) => {
                    if (order === 'title') return a.title.localeCompare(b.title, 'es');
                    if (order === 'changed') return b.priceChangedAt - a.priceChangedAt;
                    return b.addedAt - a.addedAt;
                });
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
                if (focusedKey) hideOwned.focus({preventScroll:true});
                return;
            }

            list.forEach(item => {
                if(item.native){container.appendChild(renderConsoleWishCard(item));return;}
                const saleUsd = parseFloat(item.salePrice || 0);
                const targetUsd = wishlistHasGoal(item) ? Number(item.targetPriceUsd) : null;
                const alertMet = wishlistGoalReached(item);
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
                            <span class="wish-platform-tag"><i class="fa-brands fa-steam"></i> PC · ${escapeHTML(storesMap[item.storeID]?.name || 'Referencia en USD')}</span>
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

                appendWishlistReview(card, item);
                prepareImages(card);
                container.appendChild(card);
            });
            if (focusedKey) {
                const card = [...container.children].find(item => item.dataset.wishKey === focusedKey);
                (card?.querySelector('.wish-owned-button') || hideOwned).focus({preventScroll:true});
            }
        }

        function clearEntireWishlist() {
            userWishlist = Object.create(null);
            persistWishlistState();
            refreshWishlistHeartButtonsOnGrid();
            renderWishlistDrawerItems();
            if (activeChip === 'wishlist') renderWishlistChipMode();
            showToast('Wishlist vaciada correctamente', 'fa-solid fa-trash text-rose-400');
        }

        function downloadWishlistList() {
            const list = Object.values(userWishlist).sort((a,b) => a.title.localeCompare(b.title,'es'));
            if(!list.length){showToast('Guarda un juego para descargar tu lista.');return;}
            const singleLine = text => String(text || '').replace(/[\r\n\t\u0000-\u001f\u007f]+/g,' ');
            const money = (value,currency) => new Intl.NumberFormat('es-MX',{style:'currency',currency}).format(Number(value))+' '+currency;
            const lines = ['MIS FAVORITOS · RADARPLAY', 'Preparado el '+new Date().toLocaleString('es-MX'), list.length+' juegos guardados', '',
                'Precios orientativos según la última consulta. Confirma el importe, la edición y la región en la tienda.',
                'Las referencias de PC se convierten desde USD; no garantizan el precio regional de Steam.', ''];
            for(const [index,item] of list.entries()){
                lines.push((index+1)+'. '+singleLine(item.title));
                lines.push('   Plataforma: '+(item.native?ECOSYSTEM_META[item.platform].name:'PC'));
                if(item.owned) lines.push('   Estado: Ya lo tengo');
                if(item.native) lines.push('   Tienda y región: '+singleLine(item.store)+' · '+purchaseRegions[item.region][0]);
                lines.push('   Último precio: '+(item.native?money(item.price,item.currency):formatPrice(item.salePrice,true)+' (referencia convertida)'));
                if(item.targetPrice||item.targetPriceUsd)lines.push('   Mi meta: '+(item.native?money(item.targetPrice,item.currency):formatPrice(item.targetPriceUsd,true)+' (referencia convertida)'));
                const url=item.native?safeURL(item.url):item.dealID?dealRedirectURL(item.dealID):item.steamAppID?STEAM_APP_URL+item.steamAppID:'';
                if(url)lines.push('   Ver tienda: '+singleLine(url));
                lines.push('');
            }
            lines.push('Consulta tus favoritos en https://salesplataforms.onrender.com/', 'Los avisos por correo están en preparación.');
            const dataStr = URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", 'mis-favoritos-radarplay.txt');
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
            setTimeout(()=>URL.revokeObjectURL(dataStr),1000);
            showToast('Lista descargada con tus juegos, precios y metas.');
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
