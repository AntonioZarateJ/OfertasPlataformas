const schedule = require('./assets/js/radar-mexico-rotation.js');
const {radarDayMs, radarCalendarDay, radarWeekStart, radarPicksAt} = require('./assets/js/radar-calendar.js');

const site = 'https://salesplataforms.onrender.com';
const feedPath = '/novedades/rss.xml';
const labels = {pc:'PC', xbox:'Xbox', ps:'PlayStation', switch:'Nintendo Switch', android:'Android'};
const icons = {pc:'fa-solid fa-desktop', xbox:'fa-brands fa-xbox', ps:'fa-brands fa-playstation', switch:'fa-solid fa-gamepad', android:'fa-brands fa-android'};
const dates = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const months = new Intl.DateTimeFormat('es-MX', {month:'short', timeZone:'UTC'});
const saleDates = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
const steamCalendar = 'https://partner.steamgames.com/doc/marketing/discounts/seasonalsales';
const sales = [
    ['Ofertas de invierno de Steam', '2026-12-17', '2027-01-04'],
    ['Ofertas de primavera de Steam', '2027-03-18', '2027-03-25'],
    ['Ofertas de verano de Steam', '2027-06-24', '2027-07-08']
];
const subscriptions = [
    {platform:'pc', name:'PC Game Pass', content:'Elige PC Game Pass y filtra por PC para consultar el catálogo del plan.',
        url:'https://www.xbox.com/es-MX/xbox-game-pass/games/'},
    {platform:'xbox', name:'Xbox Game Pass', content:'Selecciona el plan y revisa las pestañas de juegos agregados y próximos a salir.',
        url:'https://www.xbox.com/es-MX/xbox-game-pass/games/'},
    {platform:'ps', name:'PlayStation Plus', content:'Consulta catálogo, clásicos, juegos mensuales y pruebas. Verifica el plan y si la ficha corresponde a PS4 o PS5.',
        url:'https://www.playstation.com/es-mx/ps-plus/games/'},
    {platform:'switch', name:'Nintendo Switch Online', content:'Consulta las bibliotecas de Nintendo Classics y distingue el plan base del Paquete de expansión.',
        url:'https://www.nintendo.com/es-mx/online/nintendo-switch-online/classic-games/'},
    {platform:'android', name:'Google Play Pass', content:'Revisa en Google Play los juegos y aplicaciones disponibles con tu suscripción en México.',
        url:'https://play.google.com/store/pass?hl=es&gl=MX'}
];

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
    ${shared ? '' : '<script src="/assets/js/radar-calendar.js" defer></script>'}
    <script src="/assets/js/${script}" defer></script>
</head>
<body class="news-page">
    <header><a class="brand" href="/"><img src="/assets/brand/radarplay.svg" width="40" height="40" alt="">Radar<span>Play</span></a><a href="/">← Volver al catálogo</a></header>
    <main><div class="news-hero"><span class="news-hero-icon" aria-hidden="true"><i class="fa-solid ${shared ? 'fa-list' : 'fa-calendar-days'}"></i></span><div><h1>${escape(title)}</h1><p>${escape(description)}</p></div></div>${body}</main>
    <footer><a href="/radar-mexico">Radar de México</a><a href="/descubre">Colección de juegos</a><a href="/privacidad">Aviso de privacidad</a></footer>
</body>
</html>`;
}

function renderNews(now) {
    const today = radarCalendarDay(now);
    const upcoming = sales.filter(([, , end]) => Date.parse(end) >= today);
    const calendar = upcoming.map(([title, start, end]) => `<li><time class="news-date-tile" datetime="${start}" aria-label="${dates.format(Date.parse(start))}"><strong>${Number(start.slice(-2))}</strong><small>${months.format(Date.parse(start))}</small></time>
        <div><strong>${title}</strong><p>${saleDates.formatRange(Date.parse(start), Date.parse(end))}</p>
        <a href="${steamCalendar}">Fechas oficiales de Steam</a></div></li>`).join('');
    const plans = subscriptions.map(plan => `<li data-subscription="${plan.platform}" data-news-platform="${plan.platform}">
        <span class="news-service-icon" aria-hidden="true"><i class="${icons[plan.platform]}"></i></span>
        <div><p class="news-platform">${labels[plan.platform]}</p><h3>${plan.name}</h3>
        <p>${plan.content}</p><a class="news-cta" href="${plan.url}">Abrir catálogo oficial <span aria-hidden="true">↗</span></a></div></li>`).join('');
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
            <div class="news-feed"><div><h3>Resumen por RSS</h3><p>Recibe la selección semanal en tu lector.</p></div>
                <a class="news-cta" href="${feedPath}"><i class="fa-solid fa-rss" aria-hidden="true"></i> Abrir RSS</a></div>
        </section>
        <section id="calendario" class="news-panel"><h2>Calendario de ofertas y regalos</h2>
            <h3>Ventas anunciadas</h3>
            ${calendar ? `<ul class="news-timeline">${calendar}</ul>` : '<p>Aún no hay fechas confirmadas en este calendario.</p>'}
            <nav class="news-store-links" aria-label="Ofertas vigentes en consola"><a class="news-cta" href="https://www.xbox.com/es-MX/promotions/sales/sales-and-specials">Ofertas de Xbox</a>
            <a class="news-cta" href="https://store.playstation.com/es-mx/pages/deals">Ofertas de PlayStation</a><a class="news-cta" href="https://www.nintendo.com/es-mx/store/sales-and-deals/">Ofertas de Nintendo</a></nav>
            <h3>Juegos para reclamar</h3>
            <p id="newsGiftsStatus" role="status">Consulta las fechas reportadas y confirma la disponibilidad en la tienda.</p>
            <ul class="news-cards" id="newsGifts"></ul><a class="news-cta" href="https://store.epicgames.com/es-MX/free-games">Gratis en Epic Games Store <span aria-hidden="true">↗</span></a>
        </section>
        <section id="suscripciones" class="news-panel"><h2>Catálogos de suscripción</h2><p>Consulta los planes y juegos disponibles en México.</p>
            <div id="newsSubscriptionLabel" hidden><label for="newsSubscriptionFilter">Plataforma</label>
                <select id="newsSubscriptionFilter"><option value="">Todas</option>${Object.entries(labels).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select>
            </div>
            <ul class="news-cards">${plans}</ul>
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
