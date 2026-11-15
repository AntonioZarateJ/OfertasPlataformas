const mexicoPrice = new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'});
const mexicoDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric', day: 'numeric'});
const dayLabel = new Intl.DateTimeFormat('es-MX', {dateStyle: 'full', timeZone: 'UTC'});
const dayMs = 86_400_000;

function mexicoCalendarDate(now) {
    const fields = Object.fromEntries(mexicoDate.formatToParts(now).map(({type, value}) => [type, Number(value)]));
    return Date.UTC(fields.year, fields.month - 1, fields.day);
}

function readOriginalPick(card) {
    return {
        title: card.querySelector('h2').textContent,
        reason: card.querySelector('.pick-reason').textContent,
        url: card.querySelector('.pick-link').href
    };
}

function showEditionPick(card, pick) {
    card.dataset.product = pick.product;
    if (pick.search) card.dataset.search = pick.search;
    card.querySelector('.pick-cover').src = pick.image;
    card.querySelector('h2').textContent = pick.title;
    card.querySelector('.pick-reason').textContent = pick.reason;
    card.querySelector('.pick-edition').textContent = pick.edition;
    card.querySelector('.pick-platform span').textContent = [pick.system, card.dataset.store].filter(Boolean).join(' · ');
    const link = card.querySelector('.pick-link');
    link.href = pick.url;
    link.firstChild.textContent = `Ver en ${card.dataset.store} `;
}

function showEditionHistory(cards, previousDays, today, picksAt) {
    if (previousDays === 0) return;
    const list = document.getElementById('edition-history-list');
    for (let offset = 1; offset <= previousDays; offset++) {
        const date = today - offset * dayMs;
        const picks = picksAt(date);
        const day = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = dayLabel.format(date);
        const games = document.createElement('ul');
        for (const card of cards) {
            const pick = picks[card.dataset.platform];
            const game = document.createElement('li');
            const platform = document.createElement('strong');
            platform.textContent = card.querySelector('.pick-platform strong').textContent;
            const link = document.createElement('a');
            link.href = pick.url;
            link.textContent = pick.title;
            const reason = document.createElement('p');
            reason.textContent = pick.reason;
            game.append(platform, link, reason);
            games.append(game);
        }
        day.append(summary, games);
        list.append(day);
    }
    list.closest('section').hidden = false;
}

async function loadDailyEdition(cards) {
    const response = await fetch('/assets/radar-mexico-rotation.json', {signal: AbortSignal.timeout(4000)});
    if (!response.ok) return;
    const {startsOn, rotation, scheduled = {}} = await response.json();
    const original = Object.fromEntries(cards.map(card => [card.dataset.platform, readOriginalPick(card)]));
    const week = [original, ...rotation];
    const start = Date.parse(startsOn);
    const today = mexicoCalendarDate(new Date());
    const elapsed = (today - start) / dayMs;
    if (elapsed < 0) return;

    function picksAt(date) {
        const dateKey = new Date(date).toISOString().slice(0, 10);
        return scheduled[dateKey] ?? week[((date - start) / dayMs) % week.length];
    }
    const picks = picksAt(today);
    if (picks !== original) cards.forEach(card => showEditionPick(card, picks[card.dataset.platform]));
    const date = document.getElementById('edition-date');
    date.textContent = `Selección de hoy · ${dayLabel.format(today)}`;
    date.hidden = false;
    showEditionHistory(cards, Math.min(6, elapsed), today, picksAt);
}

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
    } else if (quote.price === 0) {
        label.textContent = 'Gratis';
        label.hidden = false;
    } else if (quote.discount === 0) {
        label.textContent = 'Precio regular';
        label.hidden = false;
    }
    return true;
}

async function loadEditionPrices(cards) {
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

const editionCards = [...document.querySelectorAll('.edition-pick')];
void loadDailyEdition(editionCards).catch(() => {}).then(() => loadEditionPrices(editionCards));
