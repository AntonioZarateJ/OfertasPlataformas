const site = 'https://salesplataforms.onrender.com';
const collectionPath = '/descubre';
const budget = 300;
const platforms = {pc:'PC', xbox:'Xbox', ps:'PlayStation', switch:'Nintendo Switch', android:'Android'};
const playModes = {solo:'Un jugador', coop:'Cooperativo', local:'Multijugador local', online:'En línea'};
const games = {
    gunpoint: {
        title:'Gunpoint', platform:'pc', product:'206190', store:'Steam', system:'PC', edition:'Juego base', genre:'Sigilo y puzles', modes:['solo'],
        image:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/206190/header.jpg',
        url:'https://store.steampowered.com/app/206190/Gunpoint/?cc=mx',
        summary:'Resuelve pequeños atracos recableando puertas, luces y alarmas.',
        reason:'La gracia está en observar primero. Si un guardia te corta el paso, puedes probar un circuito diferente o entrar por otra ventana. Sus niveles funcionan bien cuando tienes poco tiempo para jugar.',
        editionNote:'La ficha enlaza al juego base para PC en Steam México. Si ves un paquete con extras, compara el importe del juego por separado antes de comprar.'
    },
    'rocket-league': {
        title:'Rocket League', platform:'xbox', product:'C125W9BG2K0V', search:'Rocket League', store:'Xbox Store', system:'Xbox One y Xbox Series X|S', edition:'Juego base gratuito', genre:'Deportes y carreras', modes:['coop','local','online'],
        image:'https://store-images.s-microsoft.com/image/apps.42368.65187692735347017.3990a461-2db8-41ef-8bf8-33d50ff2e82a.c3b82bee-c39d-4e94-b239-2ab0170c2551',
        url:'https://www.xbox.com/es-MX/games/store/rocket-league/C125W9BG2K0V',
        summary:'Partidos cortos de fútbol con autos, fáciles de encadenar con amigos.',
        reason:'Comienza con un equipo pequeño y prueba a turnarte entre ataque y defensa. Aprender a colocarte para el siguiente rebote ayuda desde las primeras partidas.',
        editionNote:'Busca la descarga del juego base en Xbox Store. Un lote con créditos o cosméticos tiene un precio propio y no es necesario para empezar.'
    },
    'apex-legends': {
        title:'Apex Legends', platform:'ps', product:'UP0006-PPSA04873_00-APEXLEGENDRSPWN1', search:'Apex Legends', store:'PlayStation Store', system:'PS5', edition:'Juego base gratuito', genre:'Acción en equipo', modes:['online'],
        image:'https://image.api.playstation.com/vulcan/ap/rnd/202610/2617/51e9baa93fd454bc44df38597be72b7b83ab84cc37f82e12.png',
        url:'https://store.playstation.com/es-mx/product/UP0006-PPSA04873_00-APEXLEGENDRSPWN1',
        summary:'Un juego de escuadras donde la posición y las habilidades cambian el combate.',
        reason:'Para una primera partida es útil elegir habilidades que ayuden a todo el equipo. Marcar una ruta o poner cobertura puede salvar una pelea antes de que alguien tenga que disparar.',
        editionNote:'El enlace apunta al juego base para PS5. La tienda también lista paquetes y versiones por separado. Comprueba la consola antes de iniciar la descarga.'
    },
    'stardew-valley': {
        title:'Stardew Valley', platform:'switch', product:'7100001801', search:'Stardew Valley', store:'Nintendo eShop', system:'Nintendo Switch', edition:'Juego base', genre:'Simulación y exploración', modes:['solo','coop','online'],
        image:'https://assets.nintendo.com/image/fetch/q_auto/f_auto/https://atum-img-lp1.cdn.nintendo.net/i/c/b72d94b3aed44670b063dcdcfff348d0_1024',
        url:'https://www.nintendo.com/es-mx/store/products/stardew-valley-switch/',
        summary:'Cultiva, pesca o explora las minas a tu ritmo en sesiones cortas.',
        reason:'Cada día del juego te deja elegir una meta pequeña. Puedes mejorar una parcela y cerrar la sesión, o dedicar más tiempo a descubrir qué hay fuera de la granja.',
        editionNote:'Esta ficha corresponde a Nintendo Switch. Si la tienda muestra una edición para Switch 2, revisa su precio y compatibilidad por separado.'
    },
    'monument-valley-android': {
        title:'Monument Valley', platform:'android', product:'com.ustwo.monumentvalley', search:'Monument Valley', store:'Google Play', system:'Android', edition:'Juego para Android', genre:'Puzles', modes:['solo'],
        image:'https://play-lh.googleusercontent.com/PSOC0jku9VwvqwGYQvYGmh9BcsCkc-raSp94t1CzOHi6v7MtC-CgqY0MJckRXX2uNCJ7S4p1eWs1d9uACuPfjw',
        url:'https://play.google.com/store/apps/details?id=com.ustwo.monumentvalley&hl=es&gl=MX',
        summary:'Mueve escaleras y edificios para recorrer caminos que parecen imposibles.',
        reason:'Si te atoras, gira la estructura y observa dónde se juntan los caminos. Los niveles cortos funcionan bien para jugar en el móvil.',
        editionNote:'El precio mostrado corresponde a la descarga inicial en Google Play México. Revisa los contenidos adicionales en la ficha.'
    }
};

function html(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

function gameLabel(game) {
    return `<p class="discover-platform" data-platform="${game.platform}">${html(platforms[game.platform])}<span>${html(game.genre)}</span></p>`;
}

function modeChips(game) {
    return `<ul class="discover-modes" aria-label="Formas de jugar según la tienda">${game.modes.map(mode=>`<li>${playModes[mode]}</li>`).join('')}</ul>`;
}

function quoteBox(game) {
    return `<div class="discover-quote" data-platform="${game.platform}" data-product="${game.product}" data-store="${html(game.store)}" data-search="${html(game.search || '')}" aria-live="polite">
        <strong data-quote-price>Consultar en la tienda</strong><span data-budget-status></span>
    </div>`;
}

function gameCover(game) {
    return `<img class="discover-cover" src="${html(game.image)}" width="460" height="215" alt="" decoding="async">`;
}

function shareBox() {
    return '<button class="discover-share" type="button" hidden data-share>Compartir ficha</button><p class="discover-share-result" data-share-result role="status"></p><input type="url" data-share-url aria-label="Enlace público de la ficha" readonly hidden>';
}

function page({pathname, title, description, image, body}) {
    const canonical = site + pathname;
    return `<!doctype html>
<html lang="es-MX">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="google-adsense-account" content="ca-pub-3694361139232800">
    <meta name="description" content="${html(description)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${html(title)}">
    <meta property="og:description" content="${html(description)}">
    <meta property="og:url" content="${canonical}">
    ${image ? `<meta property="og:image" content="${html(image)}">` : ''}
    <title>${html(title)} · RadarPlay</title>
    <link rel="icon" href="/assets/brand/radarplay.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/css/legal.css">
    <link rel="stylesheet" href="/assets/css/discover.css">
    <script src="/assets/js/official-mx-quote.js" defer></script>
    <script src="/assets/js/price-report.js" defer></script>
    <script src="/assets/js/discover.js" defer></script>
</head>
<body class="discover">
    <header><a class="brand" href="/"><img src="/assets/brand/radarplay.svg" width="40" height="40" alt="">Radar<span>Play</span></a><nav aria-label="Navegación"><a href="/">Catálogo</a><a href="/radar-mexico">Radar de México</a></nav></header>
    <main data-budget="${budget}">${body}</main>
    <footer><a href="/como-comparamos">Cómo comparamos precios</a><a href="/privacidad">Aviso de privacidad</a><a href="/contacto">Contacto</a></footer>
</body>
</html>`;
}

function renderCollection() {
    const title = `Juegos hasta $${budget} MXN`;
    const description = 'Una selección para PC, Xbox, PlayStation, Nintendo Switch y Android. Consulta si cada juego entra en tu presupuesto con el precio de su tienda oficial en México.';
    const cards = Object.entries(games).map(([slug, game]) => `<article class="discover-card" data-play-modes="${game.modes.join(' ')}">
        ${gameCover(game)}
        <div class="discover-card-body">
            ${gameLabel(game)}
            <h2><a href="${collectionPath}/${slug}">${html(game.title)}</a></h2>
            <p>${html(game.summary)}</p>
            ${modeChips(game)}
            ${quoteBox(game)}
            <small>${html(game.store)} · ${html(game.edition)}</small>
            <a class="discover-action" href="${collectionPath}/${slug}" aria-label="Ver ficha de ${html(game.title)}">Ver ficha</a>
        </div>
    </article>`).join('');
    return page({pathname:collectionPath, title, description, body:`
        <div class="discover-intro"><h1>${title}</h1><p>${description}</p></div>
        <div class="discover-filter" id="discoverModeTools" hidden>
            <div class="discover-mode-buttons" role="group" aria-label="Forma de jugar">
            <button type="button" data-play-filter="" aria-pressed="true">Todas</button>${Object.entries(playModes).map(([value,label])=>`<button type="button" data-play-filter="${value}" aria-pressed="false">${label}</button>`).join('')}
            </div>
            <p id="discoverModeStatus" role="status"></p>
        </div>
        <div class="discover-grid">${cards}</div>
        <section class="discover-guide" aria-labelledby="discover-guide-title">
            <h2 id="discover-guide-title">Cómo elegir una edición</h2>
            <dl>
                <dt>Juego base</dt><dd>Incluye el juego principal. Comprueba que sea para tu consola, especialmente cuando la tienda agrupa generaciones.</dd>
                <dt>Deluxe o Ultimate</dt><dd>Revisa qué suma al juego base. Compara el precio con el de los extras que realmente quieres.</dd>
                <dt>Complemento o paquete</dt><dd>Un complemento puede requerir el juego base. Si es un paquete, revisa qué productos incluye y si alguno ya lo tienes.</dd>
            </dl>
            <a href="/como-comparamos">Cómo se comprueban las cotizaciones</a>
        </section>`});
}

function renderGame(pathname, game) {
    const report = new URLSearchParams({title:game.title, platform:game.system, edition:game.edition, store:game.store,
        region:'México', currency:'MXN', link:game.url});
    return page({pathname, title:`${game.title} en ${game.system}`, description:game.summary, image:game.image, body:`
        <a class="discover-back" href="${collectionPath}">← Volver a la colección</a>
        <article class="discover-detail">
            <div class="discover-detail-head">
                ${gameCover(game)}
                <div>
                    ${gameLabel(game)}
                    <h1>${html(game.title)}</h1>
                    <p>${html(game.summary)}</p>
                    <p class="discover-edition">${html(game.system)} · ${html(game.edition)}</p>
                    ${modeChips(game)}
                    ${quoteBox(game)}
                    <a class="discover-action" href="${html(game.url)}">Ver en ${html(game.store)}</a>
                    ${shareBox()}
                    <a class="discover-report" href="/reportar-precio?${html(report)}" data-discover-report>Reportar precio</a>
                </div>
            </div>
            <section><h2>Por qué lo elegimos</h2><p>${html(game.reason)}</p></section>
            <section><h2>Qué edición buscar</h2><p>${html(game.editionNote)}</p></section>
        </article>`});
}

function renderDiscoverPage(pathname) {
    if (pathname === collectionPath) return renderCollection();
    if (!pathname.startsWith(collectionPath + '/')) return null;
    const slug = pathname.slice(collectionPath.length + 1);
    return Object.hasOwn(games, slug) ? renderGame(pathname, games[slug]) : null;
}

module.exports = {renderDiscoverPage};
