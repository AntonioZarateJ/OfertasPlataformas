const giftStores = {
    'store.epicgames.com':'Epic Games Store',
    'store.steampowered.com':'Steam',
    'www.gog.com':'GOG',
    'gog.com':'GOG',
    'www.xbox.com':'Xbox Store',
    'store.playstation.com':'PlayStation Store',
    'www.nintendo.com':'Nintendo',
    'play.google.com':'Google Play'
};
const giftDates = new Intl.DateTimeFormat('es-MX', {dateStyle:'medium', timeZone:'UTC'});
const giftMonth = new Intl.DateTimeFormat('es-MX', {month:'short', timeZone:'UTC'});

function datedNewsGifts(entries, today) {
    const used = new Set();
    return entries.flatMap(item => {
        if (item?.type !== 'Game' || (item.status && item.status !== 'Active') ||
            typeof item.title !== 'string' || !item.title.trim() || typeof item.end_date !== 'string') return [];
        const date = item.end_date.match(/^\d{4}-\d{2}-\d{2}(?=\s|T|$)/)?.[0];
        const day = Date.parse(date);
        if (!date || !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date || day < today) return [];
        let link;
        try { link = new URL(item.open_giveaway_url); } catch { return []; }
        if (link.protocol !== 'https:' || link.username || link.password || link.port || link.pathname === '/' ||
            !Object.hasOwn(giftStores, link.hostname) || used.has(link.href)) return [];
        used.add(link.href);
        return [{title:item.title.slice(0,180), day, link:link.href, store:giftStores[link.hostname]}];
    }).sort((a,b)=>a.day-b.day).slice(0,12);
}

async function loadNewsGifts() {
    const status = document.getElementById('newsGiftsStatus');
    const list = document.getElementById('newsGifts');
    status.textContent = 'Consultando fechas disponibles…';
    try {
        const response = await fetch('/api/giveaways', {signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error('Sin respuesta');
        const entries = await response.json();
        if (!Array.isArray(entries)) throw new Error('Respuesta inválida');
        const gifts = datedNewsGifts(entries, radarCalendarDay(new Date()));
        const rows = gifts.map(gift => {
            const row = document.createElement('li');
            const tile = document.createElement('time');
            tile.dateTime = new Date(gift.day).toISOString().slice(0,10);
            tile.className = 'news-date-tile';
            tile.setAttribute('aria-hidden', 'true');
            const day = document.createElement('strong');
            day.textContent = new Date(gift.day).getUTCDate();
            const month = document.createElement('small');
            month.textContent = giftMonth.format(gift.day);
            tile.append(day,month);
            const copy = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = gift.title;
            const date = document.createElement('p');
            date.textContent = 'Fecha de cierre reportada · ' + giftDates.format(gift.day);
            const link = document.createElement('a');
            link.className = 'news-cta';
            link.href = gift.link;
            link.textContent = 'Comprobar en ' + gift.store;
            copy.append(title,date,link);
            row.append(tile,copy);
            return row;
        });
        list.replaceChildren(...rows);
        status.textContent = gifts.length ? 'Fechas reportadas por GamerPower. Confirma que la oferta siga activa en la tienda.' :
            'Por ahora no hay regalos con fecha vigente y enlace directo a una tienda en el registro consultado.';
    } catch {
        status.textContent = 'El registro de regalos no está disponible en este momento. Puedes abrir la tienda para revisar sus promociones.';
        newsGiftsRequested = false;
    }
}

const newsSubscriptionFilter = document.getElementById('newsSubscriptionFilter');
document.getElementById('newsSubscriptionLabel').hidden = false;
newsSubscriptionFilter.addEventListener('change', () => {
    for (const row of document.querySelectorAll('[data-subscription]')) {
        row.hidden = Boolean(newsSubscriptionFilter.value) && newsSubscriptionFilter.value !== row.dataset.subscription;
    }
});

const newsTabs = [...document.querySelectorAll('.news-jumps a')];
let newsGiftsRequested = false;
function showNewsPanel() {
    const active = newsTabs.find(tab => tab.hash === location.hash) || newsTabs[0];
    for (const tab of newsTabs) {
        if (tab === active) tab.setAttribute('aria-current', 'location');
        else tab.removeAttribute('aria-current');
        document.getElementById(tab.hash.slice(1)).hidden = tab !== active;
    }
    if (active.hash === '#calendario' && !newsGiftsRequested) {
        newsGiftsRequested = true;
        void loadNewsGifts();
    }
}
for (const tab of newsTabs) {
    tab.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        if (tab.hash !== location.hash) history.pushState(null, '', tab.hash);
        showNewsPanel();
    });
}
window.addEventListener('hashchange', showNewsPanel);
window.addEventListener('popstate', showNewsPanel);
showNewsPanel();
