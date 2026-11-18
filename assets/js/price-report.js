function priceReportPath({title, platform, edition, store, region, currency, price, link}) {
    const fields = {title, platform, edition, store, region, currency, price, link};
    return '/reportar-precio?' + new URLSearchParams(Object.entries(fields)
        .filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

const priceReportForm = document.getElementById('priceReportForm');
if (priceReportForm) {
    priceReportForm.elements.seenPrice.disabled = false;
    priceReportForm.elements.notes.disabled = false;
    priceReportForm.querySelector('button').hidden = false;
    priceReportForm.addEventListener('submit', event => {
        event.preventDefault();
        const form = new FormData(priceReportForm);
        const context = [...document.querySelectorAll('[data-report-label]')].map(field => `${field.dataset.reportLabel}: ${field.textContent}`);
        const seen = form.get('seenPrice').trim();
        if (!seen) {
            priceReportForm.elements.seenPrice.focus();
            document.getElementById('priceReportStatus').textContent = 'Escribe el precio que ves en la tienda.';
            return;
        }
        const notes = form.get('notes').trim();
        const body = [...context, '', `Precio visto en la tienda: ${seen}`, notes ? `Detalles: ${notes}` : ''].join('\n');
        const draft = 'mailto:' + priceReportForm.dataset.recipient + '?subject=' + encodeURIComponent('RadarPlay · Diferencia de precio') +
            '&body=' + encodeURIComponent(body);
        const status = document.getElementById('priceReportStatus');
        const link = document.createElement('a');
        link.href = draft;
        link.textContent = 'Abrir borrador de correo';
        status.replaceChildren(document.createTextNode('Tu reporte está preparado. '), link);
        link.click();
    });
}
