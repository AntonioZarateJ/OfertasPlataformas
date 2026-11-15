const {email} = require('./legal-config.cjs');

const fields = [
    ['title', 'Juego', 240],
    ['platform', 'Plataforma', 60],
    ['edition', 'Edición', 240],
    ['store', 'Tienda', 120],
    ['region', 'Región', 60],
    ['currency', 'Moneda', 3],
    ['price', 'Precio mostrado por RadarPlay', 80],
    ['link', 'Enlace de la tienda', 800]
];

function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

function renderPriceReport(url) {
    if (url.pathname !== '/reportar-precio') return null;

    const context = fields.map(([name, label, limit]) => {
        const value = (url.searchParams.get(name) || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
        return `<dt>${label}</dt><dd data-report-label="${label}">${escape(value || 'Sin confirmar')}</dd>`;
    }).join('');
    const contact = /^[\w.+-]+@[\w.-]+\.[a-z]+$/i.test(email || '') ? email : '';
    const form = contact ? `<form id="priceReportForm" method="post" data-recipient="${escape(contact)}">
        <label for="seenPrice">¿Qué precio aparece en la tienda?</label>
        <input id="seenPrice" name="seenPrice" maxlength="100" placeholder="Importe y moneda, o no disponible" required disabled>
        <label for="reportNotes">Detalles adicionales <small>(opcional)</small></label>
        <textarea id="reportNotes" name="notes" maxlength="1000" rows="4" placeholder="Por ejemplo, la oferta cambió al seleccionar mi región." disabled></textarea>
        <button class="action" type="submit" hidden>Preparar correo</button>
        <p role="status" id="priceReportStatus"></p>
        <noscript><p>Para enviar un reporte, utiliza la página de <a href="/contacto">Contacto</a>.</p></noscript>
    </form>` : '<p>Consulta la página de <a href="/contacto">Contacto</a> para reportar esta diferencia.</p>';
    return `<!doctype html>
<html lang="es-MX">
<head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex"><title>Reportar un precio · RadarPlay</title>
    <link rel="icon" href="/assets/brand/radarplay.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/css/legal.css"><link rel="stylesheet" href="/assets/css/price-report.css">
    <script src="/assets/js/price-report.js" defer></script>
</head>
<body>
    <header><a class="brand" href="/"><img src="/assets/brand/radarplay.svg" width="40" height="40" alt="">Radar<span>Play</span></a><a href="/">← Volver al catálogo</a></header>
    <main><h1>Reportar un precio</h1><p>Indica lo que ves en la tienda. RadarPlay prepara un borrador para que puedas revisarlo antes de enviarlo.</p>
        <section class="price-report-context" aria-labelledby="reportContext"><h2 id="reportContext">Datos de la oferta</h2><dl>${context}</dl></section>
        ${form}
    </main>
    <footer><a href="/contacto">Contacto</a><a href="/privacidad">Aviso de privacidad</a></footer>
</body>
</html>`;
}

module.exports = {renderPriceReport};
