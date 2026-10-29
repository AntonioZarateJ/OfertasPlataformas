        // --- FUNCIONES DE PERSISTENCIA HÍBRIDA (LOCALSTORAGE + FIREBASE CLOUD) ---
        function loadCloudStateFromStorage() {
            try {
                const rawWish = localStorage.getItem(WISHLIST_STORAGE_KEY);
                if (rawWish) userWishlist = normalizeWishlist(JSON.parse(rawWish));

                const rawProf = localStorage.getItem(CLOUD_PROFILE_KEY);
                if (rawProf) {
                    const profile = JSON.parse(rawProf);
                    for (const key of ['alias', 'email', 'firebaseUrl']) {
                        if (typeof profile?.[key] === 'string') cloudProfile[key] = profile[key];
                    }
                }
            } catch (e) {
                console.warn("Error leyendo almacenamiento local:", e);
            }
            refreshCloudProfileHeader();
        }

        let cloudWriteQueue = Promise.resolve(true);
        function persistWishlistState({ sync = true } = {}) {
            try {
                localStorage.setItem(window.accountStorageKey || WISHLIST_STORAGE_KEY, JSON.stringify(userWishlist));
            } catch (error) {
                showToast('No se pudo guardar en este navegador. Exporta tu wishlist para conservarla.', 'fa-solid fa-triangle-exclamation text-amber-400');
            }
            updateWishlistCountersUI();
            return sync && window.accountSync ? window.accountSync() : Promise.resolve(true);
        }

        function normalizeWishlist(value) {
            const result = {};
            if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
            Object.entries(value).forEach(([key, item]) => {
                if (['__proto__', 'constructor', 'prototype'].includes(key)) return;
                if (!item || typeof item !== 'object' || typeof item.title !== 'string') return;
                if (!Number.isFinite(Number(item.salePrice)) || Number(item.salePrice) < 0) return;
                result[key] = { ...item, gameID: key, savings: Number(item.savings) || 0, targetPriceUsd: Number(item.targetPriceUsd) > 0 ? Number(item.targetPriceUsd).toFixed(2) : null };
            });
            return result;
        }

        function saveCloudProfile() {
            try { localStorage.setItem(CLOUD_PROFILE_KEY, JSON.stringify(cloudProfile)); return true; }
            catch { showToast('No se pudo guardar el perfil en este navegador.', 'fa-solid fa-triangle-exclamation text-amber-400'); return false; }
        }

        function refreshCloudProfileHeader() {
            document.getElementById('userAccountLabel').textContent = window.currentAccount?.displayName || (window.currentAccount ? 'Mi cuenta' : 'Iniciar sesión');
            document.getElementById('cloudStatusLabel').textContent = window.currentAccount ? 'Mi cuenta y wishlist' : 'Accede y guarda tu wishlist';
        }

        function showToast(message, iconClass = 'fa-solid fa-circle-check text-emerald-400') {
            const toast = document.getElementById('toastNotification');
            const icon = document.getElementById('toastIcon');
            const msg = document.getElementById('toastMessage');
            if (!toast) return;
            icon.className = `${iconClass} text-base`;
            msg.textContent = message;
            toast.classList.remove('hidden-el');
            clearTimeout(window._toastTimer);
            window._toastTimer = setTimeout(() => {
                toast.classList.add('hidden-el');
            }, 3200);
        }

        function isGameInWishlist(gameID) {
            return Boolean(gameID && userWishlist[gameID]);
        }

        function toggleGameWishlist(gameObj, customTargetUsd = null) {
            const gId = String(gameObj.gameID || gameObj.dealID || gameObj.title);
            if (userWishlist[gId] && customTargetUsd === null) {
                delete userWishlist[gId];
                showToast(`"${gameObj.title}" eliminado de tu Wishlist`, 'fa-solid fa-trash-can text-rose-400');
            } else {
                const existing = userWishlist[gId] || {};
                userWishlist[gId] = {
                    gameID: gId,
                    dealID: gameObj.dealID || existing.dealID || '',
                    steamAppID: gameObj.steamAppID || existing.steamAppID || null,
                    title: gameObj.title || existing.title || 'Juego',
                    thumb: gameObj.thumb || existing.thumb || '',
                    salePrice: parseFloat(gameObj.salePrice ?? existing.salePrice ?? 0).toFixed(2),
                    normalPrice: parseFloat(gameObj.normalPrice ?? existing.normalPrice ?? 0).toFixed(2),
                    savings: Math.round(parseFloat(gameObj.savings ?? existing.savings ?? 0)),
                    targetPriceUsd: customTargetUsd !== null ? customTargetUsd : (existing.targetPriceUsd || null),
                    addedAt: existing.addedAt || Date.now()
                };
                showToast(
                    customTargetUsd !== null
                        ? `🔔 Alerta creada para "${gameObj.title}" (${formatPrice(customTargetUsd, true)})`
                        : `❤️ "${gameObj.title}" guardado en tu Wishlist Cloud`,
                    'fa-solid fa-heart text-rose-400'
                );
            }
            persistWishlistState();
            refreshWishlistHeartButtonsOnGrid();
            if (activeChip === 'wishlist') {
                renderWishlistChipMode();
            }
        }

        function refreshWishlistHeartButtonsOnGrid() {
            document.querySelectorAll('.wishlist-card-btn').forEach(btn => {
                const gId = btn.getAttribute('data-game-id');
                const inWish = isGameInWishlist(gId);
                const hasAlert = inWish && userWishlist[gId].targetPriceUsd;
                btn.className = `wishlist-card-btn absolute bottom-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition shadow-lg border ${
                    inWish
                        ? 'bg-rose-500 text-white border-rose-300'
                        : 'bg-black/75 hover:bg-rose-500/80 text-gray-200 hover:text-white border-white/15'
                }`;
                btn.innerHTML = `<i class="${inWish ? 'fa-solid' : 'fa-regular'} fa-heart text-xs"></i>${hasAlert ? '<span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300"></span>' : ''}`;
            });
        }

        function updateWishlistCountersUI() {
            const list = Object.values(userWishlist);
            const total = list.length;
            const navBadge = document.getElementById('navWishlistCount');
            const mobBadge = document.getElementById('mobileWishlistCount');
            const drawerTotal = document.getElementById('drawerWishlistTotal');

            if (navBadge) navBadge.textContent = total;
            if (mobBadge) mobBadge.textContent = total;
            if (drawerTotal) drawerTotal.textContent = total;

            // Evaluar cuántas alertas de precio ya se cumplieron
            const triggered = list.filter(item => item.targetPriceUsd && Number.isFinite(Number(item.salePrice)) && parseFloat(item.salePrice) <= parseFloat(item.targetPriceUsd));
            const topAlertBadge = document.getElementById('triggeredAlertsTopBadge');
            const topAlertCount = document.getElementById('triggeredAlertsCount');
            const bellDot = document.getElementById('alertBellDot');

            if (triggered.length > 0) {
                if (topAlertBadge) topAlertBadge.classList.remove('hidden-el');
                if (topAlertCount) topAlertCount.textContent = triggered.length;
                if (bellDot) bellDot.classList.remove('hidden-el');
            } else {
                if (topAlertCount) topAlertCount.textContent = '0';
                if (topAlertBadge) topAlertBadge.classList.add('hidden-el');
                if (bellDot) bellDot.classList.add('hidden-el');
            }
        }

