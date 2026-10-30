const allowedHosts = new Set([
    'www.cheapshark.com', 'store.steampowered.com', 'open.er-api.com', 'www.gamerpower.com',
    'emerald.xboxservices.com', 'web.np.playstation.com', 'store.playstation.com',
    'www.nintendo.com', 'www.eneba.com', 'u3b6gr4ua3-dsn.algolia.net', 'ihjzq5lw2r-dsn.algolia.net'
]);
function allowedURL(input) {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password || url.port && url.port !== '443') {
        throw new Error('Destino externo no permitido');
    }
    return url;
}
function createPublicFetch(fetchImpl = fetch, {maxBytes = 6 * 1024 * 1024} = {}) {
    return async (input, options = {}) => {
        let url = allowedURL(input);
        const signal = options.signal || AbortSignal.timeout(12000);
        for (let redirects = 0; redirects <= 3; redirects++) {
            const response = await fetchImpl(url.href, {...options, redirect: 'manual', signal});
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                await response.body?.cancel();
                const location = response.headers.get('location');
                if (!location) throw new Error('Redirección incompleta');
                const next = allowedURL(new URL(location, url));
                if (next.origin !== url.origin) throw new Error('Redirección externa no permitida');
                url = next;
                continue;
            }
            if (Number(response.headers.get('content-length')) > maxBytes) {await response.body?.cancel(); throw new Error('Respuesta externa demasiado grande');}
            if (!response.body) return response;
            const reader = response.body.getReader(), chunks = [];
            let size = 0;
            try {
                for (;;) {
                    const {value, done} = await reader.read();
                    if (done) break;
                    size += value.byteLength;
                    if (size > maxBytes) {await reader.cancel(); throw new Error('Respuesta externa demasiado grande');}
                    chunks.push(value);
                }
            } finally {reader.releaseLock();}
            const headers = new Headers(response.headers);
            headers.delete('content-encoding'); headers.delete('content-length');
            return new Response(Buffer.concat(chunks), {status: response.status, headers});
        }
        throw new Error('Demasiadas redirecciones');
    };
}
const publicFetch = (input, options) => createPublicFetch(fetch)(input, options);
module.exports = {createPublicFetch, publicFetch};
