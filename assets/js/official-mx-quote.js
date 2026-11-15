const officialMxPrice = new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'});

function formatMxQuote(price) {
    return `${officialMxPrice.format(price)} MXN`;
}

async function readOfficialMxQuote({platform, product, store, search}) {
    const params = new URLSearchParams({region: 'MX'});
    const isSteam = platform === 'pc';
    const endpoint = isSteam ? '/api/steam-prices' : '/api/console-catalog';
    if (isSteam) {
        params.set('appids', product);
    } else {
        params.set('platform', platform);
        params.set('q', search);
        params.set('source', 'official');
    }

    const response = await fetch(`${endpoint}?${params}`, {signal: AbortSignal.timeout(12000)});
    if (!response.ok) return null;
    const data = await response.json();
    if (isSteam) {
        const result = data?.[product];
        const quote = result?.data?.price_overview;
        if (!result?.success || quote?.currency !== 'MXN' || !Number.isSafeInteger(quote.final) || quote.final < 0) return null;
        return {price: quote.final / 100, regular: quote.initial / 100, discount: quote.discount_percent};
    }

    if (data?.platform !== platform || data.region !== 'MX' || !Array.isArray(data.items)) return null;
    return data.items.find(item => String(item.id) === product && item.kind === 'official' && item.store === store &&
        item.currency === 'MXN' && Number.isFinite(item.price) && item.price >= 0) ?? null;
}
