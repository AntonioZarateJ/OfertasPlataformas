        // --- ENDPOINTS ---
        const DEALS_API = "/api/deals";
        const GAMES_API = "/api/games";
        const STORES_API = "/api/stores";
        const EXCHANGE_API = "/api/exchange-rates";
        const GAMERPOWER_API = "/api/giveaways";
        const STEAM_APP_URL = "https://store.steampowered.com/app/";
        const STEAM_HEADER_IMG = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/";
        const CHEAPSHARK_REDIRECT = "https://www.cheapshark.com/redirect?dealID=";

        // Tasas de respaldo
        const FALLBACK_RATES = {
            USD: 1,
            MXN: 19.85,
            EUR: 0.92,
            GBP: 0.79,
            ARS: 985.50,
            COP: 4180.00,
            CLP: 945.00,
            BRL: 5.65,
            JPY: 152.40
        };

        const CURRENCY_CONFIG = {
            MXN: { locale: 'es-MX', decimals: 2 },
            USD: { locale: 'en-US', decimals: 2 },
            EUR: { locale: 'es-ES', decimals: 2 },
            GBP: { locale: 'en-GB', decimals: 2 },
            ARS: { locale: 'es-AR', decimals: 2 },
            COP: { locale: 'es-CO', decimals: 0 },
            CLP: { locale: 'es-CL', decimals: 0 },
            BRL: { locale: 'pt-BR', decimals: 2 },
            JPY: { locale: 'ja-JP', decimals: 0 }
        };

        // Respaldo verificado de promociones permanentes/activas en caso de bloqueo CORS de GamerPower
        const CURATED_FREE_GIVEAWAYS = [
            {
                id: "epic-weekly-1",
                title: "Juegos Gratis de la Semana en Epic Games Store",
                worth: "29.99",
                thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
                description: "Epic Games regala entre 1 y 3 juegos completos cada jueves a las 10:00 AM (Hora de México) para conservar para siempre en tu biblioteca.",
                open_giveaway_url: "https://store.epicgames.com/es-MX/free-games",
                platforms: "PC, Epic Games Store",
                end_date: "Renovación cada Jueves",
                platformKey: "epic"
            },
            {
                id: "steam-free-specials",
                title: "Promociones 100% Gratis para Conservar en Steam",
                worth: "19.99",
                thumbnail: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80",
                description: "Lista oficial filtrada en vivo de juegos y expansiones con 100% de descuento temporal en la tienda de Valve.",
                open_giveaway_url: "https://store.steampowered.com/search/?maxprice=free&specials=1",
                platforms: "PC, Steam",
                end_date: "Tiempo Limitado",
                platformKey: "steam"
            },
            {
                id: "gog-freebies",
                title: "Colección de Juegos Clásicos y Regalos DRM-Free en GOG",
                worth: "14.99",
                thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
                description: "Descarga directa de juegos completos sin DRM y giveaways activos en GOG.com.",
                open_giveaway_url: "https://www.gog.com/en/partner/free_games",
                platforms: "PC, GOG",
                end_date: "Disponible Ahora",
                platformKey: "gog"
            }
        ];

        // --- ESTADO GLOBAL ---
        let exchangeRates = { ...FALLBACK_RATES };
        let currentCurrency = 'MXN';
        let storesMap = {};
        let activeChip = 'top'; // 'top', 'free', 'gems', 'aaa', 'deep', 'all', 'custom', 'search'
        let activeEcosystem = 'pc'; // 'pc', 'xbox', 'ps', 'switch'
        let modalKeyPlatform = 'pc';
        let activeModalTab = 'official'; // 'official' o 'keys'
        let currentDeals = [];
        let allFreeGamesCache = [];
        let activeFreePlatform = 'all';
        let currentPage = 0;
        let isLoadingMore = false;
        let currentSearchQuery = '';
        let activeModalGameData = null;
        let activeModalDealContext = null;

        // --- ESTADO FASE 3: WISHLIST CLOUD & ALERTAS DE PRECIO ---
        const WISHLIST_STORAGE_KEY = 'steampulse_wishlist_v3';
        const CLOUD_PROFILE_KEY = 'steampulse_cloud_profile_v3';
        let userWishlist = {}; // { gameID: { gameID, steamAppID, title, thumb, saleUsd, normalUsd, savings, targetPriceUsd, addedAt } }
        let cloudProfile = {
            alias: 'Invitado Cloud',
            email: '',
            firebaseUrl: ''
        };

        // Configuración de Ecosistemas (Fase 2)
        const ECOSYSTEM_META = {
            pc: {
                name: 'PC (Steam / Epic)',
                shortBadge: 'PC Digital',
                icon: 'fa-brands fa-steam',
                colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                searchSuffix: 'Steam PC'
            },
            xbox: {
                name: 'Xbox Series X|S / One',
                shortBadge: 'Xbox Key',
                icon: 'fa-brands fa-xbox',
                colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                searchSuffix: 'Xbox Live Key'
            },
            ps: {
                name: 'PlayStation 5 / PS4',
                shortBadge: 'PSN Key',
                icon: 'fa-brands fa-playstation',
                colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                searchSuffix: 'PSN PlayStation'
            },
            switch: {
                name: 'Nintendo Switch',
                shortBadge: 'Switch eShop',
                icon: 'fa-solid fa-gamepad',
                colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                searchSuffix: 'Nintendo Switch'
            }
        };

        // Catálogo curado de Mercados de Keys con buena reputación y filtros de seguridad
        const KEY_MARKETS_CATALOG = [
            {
                id: 'eneba',
                name: 'Eneba',
                badge: 'Popular en México / LATAM',
                trustScore: '99.4% Seguro',
                paymentInfo: 'Acepta OXXO, PayPal, Tarjetas y SPEI',
                discountFactor: 0.82, // Estimación competitiva respecto al precio oficial
                color: 'from-purple-600 to-indigo-600',
                icon: 'fa-solid fa-bolt',
                buildUrl: (title, plat) => `https://www.eneba.com/latam/store/all?text=${encodeURIComponent(title + ' ' + ECOSYSTEM_META[plat].searchSuffix)}&sortBy=PRICE_ASC`
            },
            {
                id: 'cdkeys',
                name: 'CDKeys',
                badge: 'Venta Directa (Sin Vendedores Terceros)',
                trustScore: '99.8% Seguro',
                paymentInfo: 'Tienda directa sin comisiones ocultas • Entrega inmediata',
                discountFactor: 0.80,
                color: 'from-sky-500 to-blue-600',
                icon: 'fa-solid fa-shield-heart',
                buildUrl: (title, plat) => `https://www.cdkeys.com/catalogsearch/result/?q=${encodeURIComponent(title + ' ' + (plat === 'pc' ? 'PC' : plat))}`
            },
            {
                id: 'instantgaming',
                name: 'Instant Gaming',
                badge: 'Precios Bajos en lanzamientos AAA',
                trustScore: '99.2% Seguro',
                paymentInfo: 'Soporte 24/7 y verificación instantánea de región',
                discountFactor: 0.84,
                color: 'from-orange-500 to-rose-600',
                icon: 'fa-solid fa-fire-flame-simple',
                buildUrl: (title, plat) => `https://www.instant-gaming.com/es/busquedas/?query=${encodeURIComponent(title + ' ' + (plat === 'pc' ? '' : plat))}`
            },
            {
                id: 'g2a',
                name: 'G2A Marketplace',
                badge: 'Mayor Catálogo Mundial de Keys',
                trustScore: 'Verificar Vendedor >99%',
                paymentInfo: 'Usa siempre G2A Shield y revisa etiqueta GLOBAL / LATAM',
                discountFactor: 0.85,
                color: 'from-amber-500 to-orange-600',
                icon: 'fa-solid fa-globe',
                buildUrl: (title, plat) => `https://www.g2a.com/es/search?query=${encodeURIComponent(title + ' ' + ECOSYSTEM_META[plat].searchSuffix)}&sort=price-lowest-first`
            },
            {
                id: 'kinguin',
                name: 'Kinguin',
                badge: 'Especialista en Keys de Steam y Xbox',
                trustScore: '98.9% Seguro',
                paymentInfo: 'Protección al comprador disponible',
                discountFactor: 0.86,
                color: 'from-emerald-500 to-teal-600',
                icon: 'fa-solid fa-crown',
                buildUrl: (title, plat) => `https://www.kinguin.net/listing?phrase=${encodeURIComponent(title + ' ' + ECOSYSTEM_META[plat].searchSuffix)}&sort=price.lowest`
            }
        ];

        // Palabras clave de franquicias frecuentemente disponibles en Game Pass / PS Plus
        const SUBSCRIPTION_HINTS = [
            'halo', 'forza', 'gears', 'doom', 'fallout', 'skyrim', 'starfield', 'sea of thieves',
            'age of empires', 'psychonauts', 'dishonored', 'wolfenstein', 'prey', 'fable',
            'persona', 'yakuza', 'like a dragon', 'resident evil', 'assassin', 'far cry', 'battlefield',
            'mass effect', 'dead space', 'star wars', 'dirt', 'f1', 'fifa', 'ea sports', 'minecraft'
        ];

        function checkSubscriptionHint(title = '') {
            const lower = title.toLowerCase();
            return SUBSCRIPTION_HINTS.some(k => lower.includes(k));
        }

        // Parámetros de consulta actuales
        let queryConfig = {
            onSale: '1',
            minDiscount: 0,
            steamRating: 0,
            maxPriceUsd: 50,
            onlyAAA: false,
            sortBy: 'Deal Rating'
        };

        // --- ELEMENTOS DOM ---
        const currencySelect = document.getElementById('currencySelect');
        const sortSelect = document.getElementById('sortSelect');
        const sortContainer = document.getElementById('sortContainer');
        const exchangeRateBadge = document.getElementById('exchangeRateBadge');
        const liveCurrencyNotice = document.getElementById('liveCurrencyNotice');
        const noticeCurrencyCode = document.getElementById('noticeCurrencyCode');

        // Cajón Ajustes Finos
        const toggleFineTuneBtn = document.getElementById('toggleFineTuneBtn');
        const fineTuneDrawer = document.getElementById('fineTuneDrawer');
        const activeCustomFiltersDot = document.getElementById('activeCustomFiltersDot');
        const drawerDiscountSlider = document.getElementById('drawerDiscountSlider');
        const drawerDiscountLabel = document.getElementById('drawerDiscountLabel');
        const drawerRatingSlider = document.getElementById('drawerRatingSlider');
        const drawerRatingLabel = document.getElementById('drawerRatingLabel');

        // Sub-barra Juegos Gratis
        const freeGamesSubBar = document.getElementById('freeGamesSubBar');

        // Catálogo y estados
        const gamesGrid = document.getElementById('gamesGrid');
        const loadingState = document.getElementById('loadingState');
        const loadingText = document.getElementById('loadingText');
        const emptyState = document.getElementById('emptyState');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const paginationInfo = document.getElementById('paginationInfo');
        const catalogHeaderTitle = document.getElementById('catalogHeaderTitle');
        const resultsSummary = document.getElementById('resultsSummary');
        const loadedCountBadge = document.getElementById('loadedCountBadge');
        const modeIconBox = document.getElementById('modeIconBox');
        const activeEcosystemBadge = document.getElementById('activeEcosystemBadge');

        // Buscador
        const predictiveSearchInput = document.getElementById('predictiveSearchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const searchDropdown = document.getElementById('searchDropdown');
        const searchDropdownContent = document.getElementById('searchDropdownContent');

        // Modal Analítico
        const analyticsModal = document.getElementById('analyticsModal');
        const closeAnalyticsModalBtn = document.getElementById('closeAnalyticsModalBtn');
        const modalLoading = document.getElementById('modalLoading');
        const modalDataContent = document.getElementById('modalDataContent');
        const modalHeaderImg = document.getElementById('modalHeaderImg');
        const modalCoverImg = document.getElementById('modalCoverImg');
        const modalGameTitle = document.getElementById('modalGameTitle');
        const modalBadgesRow = document.getElementById('modalBadgesRow');
        const modalSteamDirectBtn = document.getElementById('modalSteamDirectBtn');
        const modalProtonDbBtn = document.getElementById('modalProtonDbBtn');
        const historicalLowBanner = document.getElementById('historicalLowBanner');
        const priceComparisonBars = document.getElementById('priceComparisonBars');
        const multiStoreList = document.getElementById('multiStoreList');
        const modalStoresCount = document.getElementById('modalStoresCount');
        const tabOfficialBtn = document.getElementById('tabOfficialBtn');
        const tabKeysBtn = document.getElementById('tabKeysBtn');
        const officialStoresPanel = document.getElementById('officialStoresPanel');
        const keyMarketsPanel = document.getElementById('keyMarketsPanel');
        const keyStoresList = document.getElementById('keyStoresList');

