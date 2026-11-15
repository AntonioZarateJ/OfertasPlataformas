const mexicoDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric', day: 'numeric'});
const dayLabel = new Intl.DateTimeFormat('es-MX', {dateStyle: 'full', timeZone: 'UTC'});
const dayMs = 86_400_000;

function mexicoCalendarDate(now) {
    const fields = Object.fromEntries(mexicoDate.formatToParts(now).map(({type, value}) => [type, Number(value)]));
    return Date.UTC(fields.year, fields.month - 1, fields.day);
}

function readOriginalPick(card) {
    const source = card.querySelector('.pick-platform span').textContent;
    return {
        product: card.dataset.product,
        search: card.dataset.search,
        system: source === card.dataset.store ? '' : source.split(' · ')[0],
        title: card.querySelector('h2').textContent,
        reason: card.querySelector('.pick-reason').textContent,
        edition: card.querySelector('.pick-edition').textContent,
        image: card.querySelector('.pick-cover').src,
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
    card.querySelector('.pick-price strong').textContent = 'Consulta el precio en la tienda';
    card.querySelector('.pick-price span').hidden = true;
}

function showEditionHistory(cards, previousDays, today, picksAt) {
    const empty = document.getElementById('edition-history-empty');
    empty.hidden = previousDays > 0;
    empty.textContent = 'Todavía no hay selecciones anteriores esta semana.';
    const list = document.getElementById('edition-history-list');
    list.replaceChildren();
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
}

function loadDailyEdition(cards, {startsOn, rotation, scheduled = {}}) {
    const original = Object.fromEntries(cards.map(card => [card.dataset.platform, readOriginalPick(card)]));
    const week = [original, ...rotation];
    const start = Date.parse(startsOn);
    const firstMonday = start + ((8 - new Date(start).getUTCDay()) % 7) * dayMs;
    function picksAt(date) {
        const dateKey = new Date(date).toISOString().slice(0, 10);
        const weeksSinceStart = Math.max(0, Math.floor((date - firstMonday) / (7 * dayMs)));
        return scheduled[dateKey] ?? week[((date - start) / dayMs + weeksSinceStart) % week.length];
    }
    function updateDay() {
        const today = mexicoCalendarDate(new Date());
        if (today === displayedDay) return;
        const elapsed = (today - start) / dayMs;
        if (elapsed < 0) {
            document.getElementById('edition-history-empty').textContent = 'El historial estará disponible cuando comience el calendario.';
            if (displayedDay === undefined) void loadEditionPrices(cards, today);
            displayedDay = today;
            return;
        }
        const picks = picksAt(today);
        if (picks !== original || displayedDay !== undefined) cards.forEach(card => showEditionPick(card, picks[card.dataset.platform]));
        displayedDay = today;
        const date = document.getElementById('edition-date');
        date.textContent = `Selección de hoy · ${dayLabel.format(today)}`;
        date.hidden = false;
        const sinceMonday = (new Date(today).getUTCDay() + 6) % 7;
        showEditionHistory(cards, Math.min(sinceMonday, elapsed), today, picksAt);
        void loadEditionPrices(cards, today);
    }
    updateDay();
    window.setInterval(() => { if (!document.hidden) updateDay(); }, 30_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDay(); });
}

async function showRadarPrice(card, day) {
    const quote = await readOfficialMxQuote(card.dataset);
    if (!quote || day !== displayedDay) return false;

    card.querySelector('.pick-price strong').textContent = formatMxQuote(quote.price);
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

async function loadEditionPrices(cards, day) {
    const status = document.getElementById('edition-price-status');
    status.textContent = 'Consultando las tiendas oficiales de México…';
    const results = await Promise.allSettled(cards.map(card => showRadarPrice(card, day)));
    if (day !== displayedDay) return;
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
let displayedDay;
const motionButton = document.getElementById('edition-motion');
motionButton.hidden = false;
motionButton.addEventListener('click', () => {
    const paused = document.querySelector('.edition-picks').classList.toggle('is-paused');
    motionButton.textContent = paused ? 'Reanudar animación de los bordes' : 'Pausar animación de los bordes';
});
if (typeof radarMexicoRotation === 'undefined') {
    document.getElementById('edition-history-empty').textContent = 'El historial no está disponible en este momento. Vuelve a abrir el Radar para reintentar.';
    void loadEditionPrices(editionCards, displayedDay);
} else {
    loadDailyEdition(editionCards, radarMexicoRotation);
}
