const dayLabel = new Intl.DateTimeFormat('es-MX', {dateStyle: 'full', timeZone: 'UTC'});
const editionQuotes = new Map();

function radarQuote(pick) {
    const key = [pick.platform,pick.product,pick.store].join('|');
    const saved = editionQuotes.get(key);
    if (saved && Date.now() < saved.expires) return saved.quote;
    const quote = readOfficialMxQuote(pick).catch(()=>null);
    editionQuotes.set(key,{quote,expires:Date.now()+120000});
    return quote;
}

function showRadarAmount(container, quote) {
    container.querySelector('strong').textContent = quote ? formatMxQuote(quote.price) : 'Precio por confirmar';
    const badge = container.querySelector('span');
    const percent = Math.round(quote?.discount);
    badge.textContent = quote && quote.regular > quote.price && percent > 0 && percent <= 100 ? `−${percent}%` :
        quote?.price === 0 ? 'Gratis' : quote?.discount === 0 ? (quote.store === 'Google Play' ? 'Precio publicado' : 'Precio regular') : '';
    badge.hidden = !badge.textContent;
    badge.classList.toggle('pick-deal',!!quote && quote.regular > quote.price && percent > 0);
}

function makeEditionOptions(card) {
    const old = card.querySelector('.pick-options');
    old?.remove();
    const {platform,product,store} = card.dataset;
    if (platform === 'android') return;
    const details = document.createElement('details');
    details.className = 'pick-options';
    const summary = document.createElement('summary');
    summary.textContent = 'Ediciones y paquetes';
    const content = document.createElement('div');
    content.className = 'pick-package-list';
    details.append(summary,content);
    card.querySelector('.pick-link').before(details);
    details.addEventListener('toggle', async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = 'true';
        content.textContent = 'Consultando la tienda…';
        const steam = platform === 'pc';
        const params = new URLSearchParams(steam ? {appid:product,region:'MX'} :
            {platform,region:'MX',id:product,store,title:card.querySelector('h2').textContent,source:'official'});
        try {
            const response = await fetch(`/api/${steam ? 'pc-editions' : 'console-comparison'}?${params}`,{signal:AbortSignal.timeout(16000)});
            if (!response.ok) throw new Error('Sin respuesta');
            const data = await response.json();
            const offers = [...(data.editions || []), ...(data.otherEditions || [])].filter(item =>
                item.kind === 'official' && item.store === store && item.currency === 'MXN' &&
                String(item.id) !== product && Number.isFinite(item.price) && item.price >= 0 &&
                typeof item.url === 'string' && item.url.startsWith('https://'));
            const unique = [...new Map(offers.map(item=>[item.id,item])).values()].slice(0,4);
            const rows = unique.map(item=>{
                const link = document.createElement('a');
                link.href = item.url;
                link.textContent = `${item.title} · ${formatMxQuote(item.price)} ↗`;
                return link;
            });
            content.replaceChildren(...rows);
            if (!rows.length) content.textContent = 'Sin paquetes ni ediciones adicionales confirmados en esta consulta.';
        } catch {
            content.textContent = 'Consulta temporalmente indisponible. Vuelve a abrir para reintentar.';
            delete details.dataset.loaded;
        }
    });
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
    makeEditionOptions(card);
}

function showEditionHistory(cards, previousDays, today, picksAt) {
    const empty = document.getElementById('edition-history-empty');
    empty.hidden = previousDays > 0;
    empty.textContent = 'Todavía no hay selecciones anteriores esta semana.';
    const list = document.getElementById('edition-history-list');
    list.replaceChildren();
    for (let offset = 1; offset <= previousDays; offset++) {
        const date = today - offset * radarDayMs;
        const picks = picksAt(date);
        const day = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = dayLabel.format(date);
        const games = document.createElement('ul');
        const quotes = [];
        for (const card of cards) {
            const pick = picks[card.dataset.platform];
            const game = document.createElement('li');
            game.dataset.platform = card.dataset.platform;
            const platform = document.createElement('strong');
            platform.textContent = card.querySelector('.pick-platform strong').textContent;
            const link = document.createElement('a');
            link.href = pick.url;
            const cover = document.createElement('img');
            cover.src = pick.image;
            cover.width = 460;
            cover.height = 215;
            cover.loading = 'lazy';
            cover.decoding = 'async';
            cover.alt = '';
            const title = document.createElement('span');
            title.textContent = pick.title;
            link.append(cover, title);
            const reason = document.createElement('p');
            reason.textContent = pick.reason;
            const price = document.createElement('div');
            price.className = 'pick-price pick-history-price';
            const amount = document.createElement('strong');
            amount.textContent = 'Consultando precio actual…';
            const badge = document.createElement('span');
            badge.hidden = true;
            price.append(amount,badge);
            quotes.push({price,pick:{...pick,platform:game.dataset.platform}});
            game.append(link, platform, reason, price);
            games.append(game);
        }
        let refreshAt = 0;
        day.addEventListener('toggle',()=>{
            if (!day.open || Date.now() < refreshAt) return;
            refreshAt = Date.now() + 120000;
            for (const {price,pick} of quotes) {
                void radarQuote(pick).then(quote=>showRadarAmount(price,quote));
            }
        });
        day.append(summary, games);
        list.append(day);
    }
}

function loadDailyEdition(cards, schedule) {
    const start = Date.parse(schedule.startsOn);
    const picksAt = day => radarPicksAt(schedule, day);
    function updateDay() {
        const today = radarCalendarDay(new Date());
        if (today === displayedDay) return;
        const elapsed = (today - start) / radarDayMs;
        if (elapsed < 0) {
            document.getElementById('edition-history-empty').textContent = 'El historial estará disponible cuando comience el calendario.';
            if (displayedDay === undefined) void loadEditionPrices(cards, today);
            displayedDay = today;
            return;
        }
        const picks = picksAt(today);
        if (picks !== schedule.original || displayedDay !== undefined) cards.forEach(card => showEditionPick(card, picks[card.dataset.platform]));
        displayedDay = today;
        const date = document.getElementById('edition-date');
        date.textContent = `Selección de hoy · ${dayLabel.format(today)}`;
        date.hidden = false;
        const sinceMonday = (today - radarWeekStart(today)) / radarDayMs;
        showEditionHistory(cards, Math.min(sinceMonday, elapsed), today, picksAt);
        void loadEditionPrices(cards, today);
    }
    updateDay();
    window.setInterval(() => { if (!document.hidden) updateDay(); }, 30_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDay(); });
}

async function showRadarPrice(card, day) {
    const quote = await radarQuote(card.dataset);
    if (!quote || day !== displayedDay) return false;

    showRadarAmount(card.querySelector('.pick-price'), quote);
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
editionCards.forEach(makeEditionOptions);
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
