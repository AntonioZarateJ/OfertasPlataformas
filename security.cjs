const net = require('node:net');

const regions = ['MX', 'US', 'ES', 'GB', 'BR', 'JP'];
const sorts = ['DealRating', 'Title', 'Savings', 'Price', 'Metacritic', 'Reviews', 'ReviewCount', 'Release', 'Store', 'Recent'];
const parameters = {
    '/api/deals': ['desc', 'pageSize', 'pageNumber', 'sortBy', 'storeID', 'title', 'onSale', 'steamRating', 'upperPrice', 'AAA', 'id'],
    '/api/games': ['id', 'title', 'limit'],
    '/api/stores': [], '/api/exchange-rates': [], '/api/giveaways': [], '/api/auth-config': [],
    '/api/steam-prices': ['appids', 'region'],
    '/api/pc-editions': ['appid', 'region'],
    '/api/deals-position': ['discount', 'desc', 'storeID', 'title', 'onSale', 'steamRating', 'AAA'],
    '/api/console-catalog': ['platform', 'region', 'q', 'sort', 'source', 'deals', 'cursor', 'discountMin', 'discountMax'],
    '/api/console-comparison': ['platform', 'region', 'title', 'id', 'store']
};
function validInteger(value, min, max) {
    return /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
}
function validateQuery(url) {
    const allowed = parameters[url.pathname];
    if (!allowed) return false;
    const seen = new Set();
    for (const [key, value] of url.searchParams) {
        if (!allowed.includes(key) || seen.has(key) || /[\u0000-\u001f\u007f]/.test(value)) return false;
        seen.add(key);
        if (value.length > (key === 'cursor' ? 6000 : key === 'appids' ? 700 : 350)) return false;
        if (['desc', 'onSale', 'AAA', 'deals'].includes(key) && !['0', '1'].includes(value)) return false;
        if (key === 'appids' && !/^\d{1,10}(,\d{1,10}){0,59}$/.test(value)) return false;
        if (key === 'region' && !regions.includes(value)) return false;
        if (key === 'pageNumber' && !validInteger(value, 0, 10000)) return false;
        if (key === 'pageSize' && !validInteger(value, 1, 60)) return false;
        if (key === 'limit' && !validInteger(value, 1, 60)) return false;
        if (['steamRating', 'discount', 'discountMin', 'discountMax'].includes(key) && !validInteger(value, 0, 100)) return false;
        if (key === 'storeID' && !/^\d{1,5}(,\d{1,5}){0,9}$/.test(value)) return false;
        if (key === 'upperPrice' && (!/^\d{1,5}(\.\d{1,2})?$/.test(value) || Number(value) > 10000)) return false;
        if (key === 'sortBy') {
            if (value === 'Deal Rating') url.searchParams.set(key, 'DealRating');
            else if (!sorts.includes(value)) return false;
        }
        if (key === 'id' && url.pathname === '/api/games' && !/^\d{1,12}$/.test(value)) return false;
    }
    url.searchParams.sort();
    return true;
}
function securityHeaders(res, secure = false, authDomain = '') {
    const authOrigin=/^(?!.*\.\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(authDomain)?' https://'+authDomain:'';
    const policy = [
        "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
        "script-src 'self' https://www.gstatic.com", "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' https: data:",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.gstatic.com" + authOrigin,
        "frame-src https://*.firebaseapp.com https://*.web.app" + authOrigin
    ];
    res.setHeader('Content-Security-Policy', policy.join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}
function createApiGuard({capacity = 60, refillPerSecond = 3, maxConcurrent = 12, now = Date.now, trustProxy = false} = {}) {
    const clients = new Map();
    let active = 0;
    return req => {
        if (req.headers['sec-fetch-site'] === 'cross-site') return {status: 403};
        let ip = req.socket.remoteAddress || 'unknown';
        // A forwarded header is trusted only when the operator explicitly enables one proxy hop.
        if (trustProxy) {
            const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim();
            if (net.isIP(forwarded)) ip = forwarded;
        }
        const time = now();
        const client = clients.get(ip) || {tokens: capacity, at: time};
        client.tokens = Math.min(capacity, client.tokens + Math.max(0, time - client.at) / 1000 * refillPerSecond);
        client.at = time;
        if (!clients.has(ip) && clients.size >= 5000) clients.delete(clients.keys().next().value);
        clients.set(ip, client);
        if (client.tokens < 1) return {status: 429, retryAfter: Math.max(1, Math.ceil(1 / (refillPerSecond || 1)))};
        client.tokens--;
        if (active >= maxConcurrent) return {status: 503, retryAfter: 2};
        active++;
        let released = false;
        return {release: () => {if (!released) {released = true; active--;}}};
    };
}
function publicFirebaseConfig(env = process.env) {
    const fields = {
        apiKey: ['FIREBASE_API_KEY', /^AIza[A-Za-z0-9_-]{35}$/],
        authDomain: ['FIREBASE_AUTH_DOMAIN', /^(?!.*\.\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/],
        projectId: ['FIREBASE_PROJECT_ID', /^[a-z][a-z0-9-]{4,62}$/],
        appId: ['FIREBASE_APP_ID', /^1:\d+:web:[a-f0-9]+$/i]
    };
    return Object.fromEntries(Object.entries(fields).map(([key, [name, pattern]]) => {
        const value = String(env[name] || '');
        return [key, value.length <= 253 && pattern.test(value) ? value : ''];
    }));
}
module.exports = {validateQuery, securityHeaders, createApiGuard, publicFirebaseConfig};
