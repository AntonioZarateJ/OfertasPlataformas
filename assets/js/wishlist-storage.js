        // --- FUNCIONES DE PERSISTENCIA HÍBRIDA (LOCALSTORAGE + FIREBASE CLOUD) ---
        function loadCloudStateFromStorage() {
            try {
                const rawWish = localStorage.getItem(WISHLIST_STORAGE_KEY);
                if (rawWish) userWishlist = normalizeWishlist(JSON.parse(rawWish));

            } catch (e) {
                console.warn("Error leyendo almacenamiento local:", e);
            }
            refreshCloudProfileHeader();
        }

        function persistWishlistState({ sync = true } = {}) {
            userWishlist=normalizeWishlist(userWishlist);
            try {
                localStorage.setItem(window.accountStorageKey || WISHLIST_STORAGE_KEY, JSON.stringify(userWishlist));
            } catch (error) {
                showToast('No se pudo guardar en este navegador. Exporta tu wishlist para conservarla.', 'fa-solid fa-triangle-exclamation text-amber-400');
            }
            updateWishlistCountersUI();
            return sync && window.accountSync ? window.accountSync() : Promise.resolve(true);
        }

        function normalizeWishlist(value) {
            const result=Object.create(null);
            if(!value||typeof value!=='object'||Array.isArray(value))return result;
            const money=validWishlistAmount;
            for(const [key,item]of Object.entries(value).slice(0,300)){
                if(['__proto__','constructor','prototype'].includes(key)||key.length>600)continue;
                if(!item||typeof item!=='object'||typeof item.title!=='string'||!money(item.salePrice))continue;
                const native=item.native===true;
                if(native&&(!['xbox','ps','switch','android'].includes(item.platform)||!purchaseRegions[item.region]||item.currency!==purchaseRegions[item.region][1]||!money(item.price)))continue;
                const clean={gameID:key,title:item.title.slice(0,240),salePrice:Number(item.salePrice).toFixed(2),normalPrice:money(item.normalPrice)?Number(item.normalPrice).toFixed(2):Number(item.salePrice).toFixed(2),savings:Math.max(0,Math.min(100,Number(item.savings)||0)),targetPriceUsd:!native&&money(item.targetPriceUsd)&&Number(item.targetPriceUsd)>0?Number(item.targetPriceUsd).toFixed(2):null,addedAt:validWishlistTimestamp(item.addedAt)?Number(item.addedAt):Date.now()};
                for(const field of ['dealID','id','edition','store','seller','platform','region','currency'])if(typeof item[field]==='string'||typeof item[field]==='number')clean[field]=String(item[field]).slice(0,350);
                for(const field of ['thumb','image','url','artwork'])if(typeof item[field]==='string')clean[field]=safeURL(item[field].slice(0,4096));
                if(Array.isArray(item.imageAlternatives))clean.imageAlternatives=[...new Set(item.imageAlternatives.slice(0,8).filter(url=>typeof url==='string').map(url=>safeURL(url.slice(0,4096))).filter(Boolean))];
                clean.steamAppID=/^\d{1,12}$/.test(String(item.steamAppID))?String(item.steamAppID):null;
                if(native){clean.native=true;clean.price=Number(item.price);clean.regular=money(item.regular)?Number(item.regular):null;clean.discount=Number(item.discount)||0;clean.kind=item.kind==='external'?'external':'official';clean.targetPrice=money(item.targetPrice)&&Number(item.targetPrice)>0?Number(item.targetPrice):null;}
                if(!native && /^\d{1,6}$/.test(String(item.storeID))) clean.storeID=String(item.storeID);
                if(item.owned===true) clean.owned=true;
                if(item.planned===true) clean.planned=true;
                if((native||clean.storeID)&&money(item.previousPrice)&&validWishlistTimestamp(item.priceChangedAt)){
                    clean.previousPrice=Number(item.previousPrice);
                    clean.priceChangedAt=Number(item.priceChangedAt);
                }
                for(const field of ['checkedAt','priceCheckedAt'])if(validWishlistTimestamp(item[field]))clean[field]=Number(item[field]);
                for(const field of ['rating','ratingCount'])if(money(item[field]))clean[field]=Number(item[field]);
                result[key]=clean;
            }
            return result;
        }

        function validWishlistAmount(value) {
            return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
                Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e12;
        }

        function validWishlistTimestamp(value) {
            const time = Number(value);
            return ['number','string'].includes(typeof value) && Number.isSafeInteger(time) && time > 0 && time <= 8.64e15;
        }

        function wishlistCurrentPrice(item) {
            return Number(item.native ? item.price : item.salePrice);
        }

        function wishlistHasGoal(item) {
            return !item.owned && Number(item.native ? item.targetPrice : item.targetPriceUsd) > 0;
        }

        function wishlistGoalReached(item) {
            return wishlistHasGoal(item) && wishlistCurrentPrice(item) <= Number(item.native ? item.targetPrice : item.targetPriceUsd);
        }

        function wishlistPriceDifference(item) {
            return !item.owned && item.priceChangedAt ? Math.round((wishlistCurrentPrice(item) - item.previousPrice) * 100) / 100 : 0;
        }

        function recordWishlistPrice(item, price, checkedAt, comparable = true) {
            if (item.owned || !validWishlistAmount(price) || !validWishlistTimestamp(checkedAt) ||
                checkedAt < Math.max(item.priceCheckedAt || 0, item.checkedAt || 0)) return false;
            const next = Math.round(Number(price) * 100) / 100;
            const previous = wishlistCurrentPrice(item);
            if (next === previous) return false;
            if (comparable) {
                item.previousPrice = previous;
                item.priceChangedAt = checkedAt;
            }
            if (item.native) item.price = next;
            item.salePrice = next.toFixed(2);
            item.priceCheckedAt = checkedAt;
            return true;
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
            return Boolean(gameID && Object.hasOwn(userWishlist,String(gameID)));
        }

        function toggleGameWishlist(gameObj, customTargetUsd = null) {
            const gId = String(gameObj.gameID || gameObj.dealID || gameObj.title);
            if(!Object.hasOwn(userWishlist,gId)&&Object.keys(userWishlist).length>=300){showToast('Puedes guardar hasta 300 favoritos.');return;}
            if (userWishlist[gId] && customTargetUsd === null) {
                delete userWishlist[gId];
                showToast(`"${gameObj.title}" eliminado de tu Wishlist`, 'fa-solid fa-trash-can text-rose-400');
            } else {
                const existing = userWishlist[gId] || {};
                userWishlist[gId] = {
                    ...existing,
                    gameID: gId,
                    dealID: existing.dealID || gameObj.dealID || '',
                    storeID: existing.storeID || gameObj.storeID,
                    steamAppID: gameObj.steamAppID || existing.steamAppID || null,
                    title: gameObj.title || existing.title || 'Juego',
                    thumb: gameObj.thumb || existing.thumb || '',
                    salePrice: parseFloat(existing.salePrice ?? gameObj.salePrice ?? 0).toFixed(2),
                    normalPrice: parseFloat(existing.normalPrice ?? gameObj.normalPrice ?? 0).toFixed(2),
                    savings: Math.round(parseFloat(existing.savings ?? gameObj.savings ?? 0)),
                    targetPriceUsd: customTargetUsd !== null ? customTargetUsd : (existing.targetPriceUsd || null),
                    addedAt: existing.addedAt || Date.now()
                };
                showToast(
                    customTargetUsd !== null
                        ? `Meta guardada para "${gameObj.title}" (${formatPrice(customTargetUsd, true)})`
                        : `❤️ "${gameObj.title}" guardado en tus favoritos`,
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
            refreshConsoleHearts();
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
            const triggered = list.filter(wishlistGoalReached);
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

