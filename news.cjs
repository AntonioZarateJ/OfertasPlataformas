const {events,subscriptions,verified} = require('./news-data.cjs');
const schedule = require('./assets/js/radar-mexico-rotation.js');
const {radarDayMs, radarCalendarDay, radarWeekStart, radarPicksAt} = require('./assets/js/radar-calendar.js');

const site = 'https://salesplataforms.onrender.com';
const feedPath = '/novedades/rss.xml';
const labels = {pc:'PC', xbox:'Xbox', ps:'PlayStation', switch:'Nintendo Switch', android:'Android'};
const icons = {pc:'fa-solid fa-desktop', xbox:'fa-brands fa-xbox', ps:'fa-brands fa-playstation', switch:'fa-solid fa-gamepad', android:'fa-brands fa-android'};
const dates = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const saleDates = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
const planMoney = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function radarWeeks(now) {
    const today = radarCalendarDay(now);
    const currentMonday = radarWeekStart(today);
    const start = Date.parse(schedule.startsOn);
    const weeks = [];
    for (let offset = 0; offset < 4; offset++) {
        const monday = currentMonday - offset * 7 * radarDayMs;
        const firstDay = Math.max(monday, start);
        if (firstDay > today || firstDay >= monday + 7 * radarDayMs) break;
        const picks = radarPicksAt(schedule, firstDay);
        if (picks) weeks.push({monday, firstDay, picks, key:new Date(monday).toISOString().slice(0, 10)});
    }
    return weeks;
}

function newsPage({title, description, body, script, shared = false}) {
    return `<!doctype html>
<html lang="es-MX">
<head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${escape(description)}">
    ${shared ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="google-adsense-account" content="ca-pub-3694361139232800">'}
    <title>${escape(title)} · RadarPlay</title>
    <link rel="icon" href="/assets/brand/radarplay.svg" type="image/svg+xml">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous">
    <link rel="stylesheet" href="/assets/css/legal.css"><link rel="stylesheet" href="/assets/css/news.css">
    <link rel="alternate" type="application/rss+xml" title="RadarPlay semanal" href="${feedPath}">
    ${shared ? '' : '<script src="/assets/js/radar-calendar.js" defer></script><script src="/assets/js/news-calendar.js" defer></script>'}
    <script src="/assets/js/${script}" defer></script>
</head>
<body class="news-page">
    <header><a class="brand" href="/"><img src="/assets/brand/radarplay.svg" width="40" height="40" alt="">Radar<span>Play</span></a><a href="/">← Volver al catálogo</a></header>
    <main><div class="news-hero"><span class="news-hero-icon" aria-hidden="true"><i class="fa-solid ${shared ? 'fa-list' : 'fa-calendar-days'}"></i></span><div><h1>${escape(title)}</h1><p>${escape(description)}</p></div></div>${body}</main>
    <footer><a href="/radar-mexico">Radar de México</a><a href="/descubre">Colección de juegos</a><a href="/privacidad">Aviso de privacidad</a></footer>
</body>
</html>`;
}

function renderEvent(event) {
    const end = event.end || event.start;
    const date = saleDates.formatRange(Date.parse(event.start), Date.parse(end));
    const chips = event.platforms.map(platform=>`<span class="news-event-chip" data-news-platform="${platform}"><i class="${icons[platform]}" aria-hidden="true"></i> ${labels[platform]}</span>`).join('');
    const category = {release:'Lanzamiento',sale:'Venta',festival:'Festival'}[event.kind];
    return `<article class="news-event" data-start="${event.start}" data-end="${end}" data-kind="${event.kind}" data-platforms="${event.platforms.join(' ')}" data-news-platform="${event.platforms[0]}">
        ${event.image ? `<img src="${escape(event.image)}" loading="lazy" decoding="async" width="288" height="150" alt="">` : ''}
        <div class="news-event-copy"><small>${category} · ${escape(date)}</small><h4>${escape(event.title)}</h4><div class="news-event-chips">${chips}</div>
        ${event.note ? `<p>${escape(event.note)}</p>` : ''}<a href="${escape(event.url)}">Ver anuncio oficial <span aria-hidden="true">↗</span></a></div></article>`;
}
function renderNews(now) {
    const today = new Date(radarCalendarDay(now)).toISOString().slice(0,10);
    const calendar = events.filter(event=>(event.end || event.start) >= today).map(renderEvent).join('');
    const plans = subscriptions.map(service => `<li class="news-membership" data-subscription="${service.platform}" data-news-platform="${service.platform}">
        <header><span class="news-service-icon" aria-hidden="true"><i class="${icons[service.platform]}"></i></span>
        <div><p class="news-platform">${labels[service.platform]}</p><h3>${service.name}</h3></div></header>
        <div class="news-plan-grid">${service.plans.map(([name,note,prices])=>`<article><h4>${name}</h4>
        <p>${note}</p><div class="news-plan-rates">${prices.length ? prices.map(([amount,period])=>`<div><strong>${planMoney.format(amount)}</strong><small>MXN / ${period}</small></div>`).join('') : '<span>Precio en Play Store</span>'}</div></article>`).join('')}</div>
        <a class="news-cta" href="${escape(service.url)}">Ver suscripción oficial <span aria-hidden="true">↗</span></a></li>`).join('');
    const week = radarWeeks(now)[0];
    const featured = week ? Object.entries(week.picks).map(([key,pick]) => `<li data-news-platform="${key}">
        <a href="${escape(pick.url)}"><img src="${escape(pick.image)}" alt="" width="460" height="215" loading="lazy" decoding="async">
        <div><span class="news-platform">${labels[key]}</span><strong>${escape(pick.title)}</strong></div></a>
    </li>`).join('') : '';
    return newsPage({
        title:'Novedades de RadarPlay', description:'Tu semana de juegos en México.', script:'news.js',
        body:`<nav class="news-jumps" aria-label="En esta página">
            <a href="#resumen"><i class="fa-solid fa-star" aria-hidden="true"></i> Radar semanal</a>
            <a href="#calendario"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> Calendario</a>
            <a href="#suscripciones"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Suscripciones</a>
        </nav>
        <section id="resumen" class="news-panel">
            <div class="news-section-heading"><div><h2>Selección de la semana</h2>
            ${week ? `<p>Semana del ${dates.format(week.monday)}</p>` : '<p>La próxima selección aparecerá aquí.</p>'}</div>
            <a class="news-cta" href="/radar-mexico">Ver Radar de México <span aria-hidden="true">→</span></a></div>
            ${featured ? `<ul class="news-featured">${featured}</ul>` : ''}
        </section>
        <section id="calendario" class="news-panel"><h2>Lanzamientos y ventas anunciadas</h2>
            <div class="news-calendar" id="newsCalendar" data-today="${today}" hidden>
                <div class="news-calendar-top"><div class="news-calendar-month"><button type="button" id="newsPreviousMonth" aria-label="Mes anterior">‹</button>
                    <h3 id="newsMonthTitle" aria-live="polite"></h3><button type="button" id="newsNextMonth" aria-label="Mes siguiente">›</button></div>
                    <label>Plataforma <select id="newsCalendarPlatform"><option value="">Todas</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label></div>
                <div class="news-calendar-body"><div><div class="news-calendar-week" aria-hidden="true"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
                    <div id="newsMonthGrid" class="news-month-grid" role="group" aria-label="Días del mes"></div></div>
                    <div class="news-day-agenda"><h3 id="newsDayTitle" aria-live="polite"></h3><div id="newsDayEvents"></div></div></div>
                <p id="newsCalendarRange"></p>
            </div>
            <div id="newsCalendarData">${calendar || '<p>Aún no hay fechas confirmadas.</p>'}</div>
            <p class="news-calendar-caption">Selección de fechas confirmadas. Las tiendas pueden cambiar las fechas y la disponibilidad por región.</p>
            <h3>Juegos para reclamar</h3>
            <p id="newsGiftsStatus" role="status">Consulta las fechas reportadas y confirma la disponibilidad en la tienda.</p>
            <ul class="news-cards" id="newsGifts"></ul><a class="news-cta" href="https://store.epicgames.com/es-MX/free-games">Gratis en Epic Games Store <span aria-hidden="true">↗</span></a>
        </section>
        <section id="suscripciones" class="news-panel"><h2>Catálogos de suscripción</h2><p>Precios en pesos mexicanos, revisados el ${dates.format(Date.parse(verified))}. Los cobros y el catálogo pueden cambiar.</p>
            <div id="newsSubscriptionLabel" hidden><label for="newsSubscriptionFilter">Plataforma</label>
                <select id="newsSubscriptionFilter"><option value="">Todas</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select>
            </div>
            <ul class="news-plans">${plans}</ul>
        </section>`
    });
}

function renderNewsPage(pathname, now = new Date()) {
    if (pathname === '/novedades') return renderNews(now);
    if (pathname !== '/lista-compartida') return null;
    return newsPage({
        title:'Lista compartida', description:'Juegos seleccionados para compartir en RadarPlay.', shared:true, script:'shared-list.js',
        body:'<p id="sharedStatus" role="status">Abre el enlace completo para ver la lista.</p><ul class="news-cards" id="sharedItems"></ul><noscript><p>Activa JavaScript para abrir esta lista.</p></noscript>'
    });
}

function renderNewsFeed(now = new Date()) {
    const items = radarWeeks(now).map(week => {
        const text = Object.entries(week.picks).map(([platform, pick]) => labels[platform] + ' — ' + pick.title + '. ' + pick.reason).join('\n');
        return `<item><title>${escape('Radar de México · Semana del ' + dates.format(week.monday))}</title>
            <link>${site}/radar-mexico</link><guid isPermaLink="false">radarplay.week.${week.key}</guid>
            <pubDate>${new Date(week.firstDay + 6 * 3_600_000).toUTCString()}</pubDate><description>${escape(text)}</description></item>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>RadarPlay semanal</title>
<link>${site}/novedades</link><description>Selección semanal para PC, Xbox, PlayStation, Nintendo Switch y Android en México.</description>
<language>es-MX</language><atom:link href="${site}${feedPath}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}

module.exports = {renderNewsPage, renderNewsFeed, feedPath};
