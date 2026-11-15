const mexicoPrice = new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'});

async function readRadarQuote(card) {
    const {platform, product, store, search} = card.dataset;
    const params = new URLSearchParams({region: 'MX'});
    let endpoint;
    if (platform === 'pc') {
        endpoint = '/api/steam-prices';
        params.set('appids', product);
    } else {
        endpoint = '/api/console-catalog';
        params.set('platform', platform);
        params.set('q', search);
        params.set('source', 'official');
    }

    const response = await fetch(`${endpoint}?${params}`, {signal: AbortSignal.timeout(12000)});
    if (!response.ok) return null;
    const data = await response.json();

    if (platform === 'pc') {
        const result = data?.[product];
        const quote = result?.data?.price_overview;
        if (!result?.success || quote?.currency !== 'MXN' || !Number.isSafeInteger(quote.final) || quote.final < 0) return null;
        return {price: quote.final / 100, regular: quote.initial / 100, discount: quote.discount_percent};
    }

    if (data?.platform !== platform || data.region !== 'MX' || !Array.isArray(data.items)) return null;
    return data.items.find(item => String(item.id) === product && item.kind === 'official' && item.store === store &&
        item.currency === 'MXN' && Number.isFinite(item.price) && item.price >= 0) ?? null;
}

async function showRadarPrice(card) {
    const quote = await readRadarQuote(card);
    if (!quote) return false;

    card.querySelector('.pick-price strong').textContent = `${mexicoPrice.format(quote.price)} MXN`;
    const label = card.querySelector('.pick-price span');
    const percent = Math.round(quote.discount);
    if (Number.isFinite(quote.regular) && quote.regular > quote.price && percent > 0 && percent <= 100) {
        label.textContent = `−${percent}%`;
        label.hidden = false;
    } else if (quote.discount === 0) {
        label.textContent = 'Precio regular';
        label.hidden = false;
    }
    return true;
}

async function loadEditionPrices() {
    const cards = [...document.querySelectorAll('.edition-pick')];
    const status = document.getElementById('edition-price-status');
    status.textContent = 'Consultando las tiendas oficiales de México…';
    const results = await Promise.allSettled(cards.map(showRadarPrice));
    const checks = results.filter(result => result.status === 'fulfilled' && result.value).length;
    if (checks === cards.length) {
        status.textContent = 'Precios consultados en tiendas oficiales de México. Confirma el total en la tienda antes de comprar.';
    } else if (checks > 0) {
        status.textContent = 'Mostramos los precios que pudimos comprobar en México. Para los demás, consulta el enlace a la tienda.';
    } else {
        status.textContent = 'Las tiendas no devolvieron precios para esta selección. Puedes consultarlos desde cada tarjeta.';
    }
}

void loadEditionPrices();
