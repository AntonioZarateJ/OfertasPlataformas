// Static actions: no inline event handlers, eval or dynamically compiled code.
const uiActions = Object.freeze({
    'select-pc-store': function() { selectPCStore() },
    'filter-wishlist': function() { renderWishlistDrawerItems() },
    'save-account-profile': function(event) { saveAccountProfile(event) },
    'refresh-account': function() { refreshAccountVerification() },
    'reset-account-password': function() { resetAccountPassword() },
    'profile-open-wishlist': function() { closeCloudConfigModal(); openWishlistDrawer() },
    'open-wishlist-drawer': function(event) { openWishlistDrawer() },
    'select-smart-chip-top-link': function(event) { selectSmartChip('top'); return false; },
    'select-ecosystem-pc': function(event) { selectEcosystem('pc') },
    'select-ecosystem-xbox': function(event) { selectEcosystem('xbox') },
    'select-ecosystem-ps': function(event) { selectEcosystem('ps') },
    'select-ecosystem-switch': function(event) { selectEcosystem('switch') },
    'handle-search-submit': function(event) { handleSearchSubmit(event) },
    'open-cloud-config-modal': function(event) { openCloudConfigModal() },
    'select-smart-chip-top': function(event) { selectSmartChip('top') },
    'select-smart-chip-free': function(event) { selectSmartChip('free') },
    'select-smart-chip-all': function(event) { selectSmartChip('all') },
    'reset-fine-tune-filters': function(event) { resetFineTuneFilters() },
    'update-drawer-labels': function(event) { updateDrawerLabels() },
    'apply-custom-drawer-filters': function(event) { applyCustomDrawerFilters() },
    'filter-free-games-by-platform-all': function(event) { filterFreeGamesByPlatform('all') },
    'filter-free-games-by-platform-epic': function(event) { filterFreeGamesByPlatform('epic') },
    'filter-free-games-by-platform-steam': function(event) { filterFreeGamesByPlatform('steam') },
    'filter-free-games-by-platform-gog': function(event) { filterFreeGamesByPlatform('gog') },
    'filter-free-games-by-platform-console': function(event) { filterFreeGamesByPlatform('console') },
    'retry-catalog': function(event) { activeChip === 'free' ? loadFreeGamesMode() : executeCatalogFetch(true) },
    'reset-console-filters': function(event) { resetConsoleFilters() },
    'load-console-catalog': function(event) { loadConsoleCatalog() },
    'apply-console-discount': function(event) { applyConsoleDiscount() },
    'toggle-modal-game-wishlist': function(event) { toggleModalGameWishlist() },
    'save-modal-price-alert': function(event) { saveModalPriceAlert() },
    'switch-modal-comparator-tab-official': function(event) { switchModalComparatorTab('official') },
    'switch-modal-comparator-tab-keys': function(event) { switchModalComparatorTab('keys') },
    'change-modal-key-platform-pc': function(event) { changeModalKeyPlatform('pc') },
    'close-wishlist-drawer': function(event) { closeWishlistDrawer() },
    'export-wishlist-json': function(event) { exportWishlistJson() },
    'clear-entire-wishlist': function(event) { clearEntireWishlist() },
    'close-cloud-config-modal': function(event) { closeCloudConfigModal() },
    'set-auth-mode-login': function(event) { setAuthMode('login') },
    'set-auth-mode-register': function(event) { setAuthMode('register') },
    'submit-account': function(event) { submitAccount(event) },
    'toggle-account-password': function(event) { toggleAccountPassword() },
    'set-auth-mode-reset': function(event) { setAuthMode('reset') },
    'send-account-verification': function(event) { sendAccountVerification() },
    'logout-account': function(event) { logoutAccount() },
    'close-console-comparison': function(event) { closeConsoleComparison() },
});
for (const type of ['click', 'change', 'submit', 'input']) {
    document.querySelectorAll(`[data-ui-${type}]`).forEach(element => {
        const action = element.getAttribute(`data-ui-${type}`);
        if (!Object.hasOwn(uiActions, action)) return;
        element.addEventListener(type, event => {
            if (uiActions[action].call(element, event) === false) event.preventDefault();
        });
    });
}
