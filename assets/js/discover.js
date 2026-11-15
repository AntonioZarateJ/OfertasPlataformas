const collectionBudget = Number(document.querySelector('main').dataset.budget);
const modeFilter = document.getElementById('discoverPlayMode');
if (modeFilter) {
    document.getElementById('discoverModeTools').hidden = false;
    modeFilter.addEventListener('change', () => {
        const cards = [...document.querySelectorAll('[data-play-modes]')];
        for (const card of cards) card.hidden = Boolean(modeFilter.value) && !card.dataset.playModes.split(' ').includes(modeFilter.value);
        const shown = cards.filter(card => !card.hidden).length;
        document.getElementById('discoverModeStatus').textContent = shown ? `${shown} de ${cards.length} juegos de la colección.` : 'Sin coincidencias en esta colección.';
    });
}

for (const quoteBox of document.querySelectorAll('.discover-quote')) {
    const price = quoteBox.querySelector('[data-quote-price]');
    const status = quoteBox.querySelector('[data-budget-status]');
    price.textContent = 'Consultando la tienda…';
    void readOfficialMxQuote(quoteBox.dataset).catch(() => null).then(quote => {
        if (!quote) {
            price.textContent = 'Consultar en la tienda';
            status.textContent = 'Presupuesto por confirmar';
            return;
        }
        price.textContent = quote.price === 0 ? 'Gratis' : formatMxQuote(quote.price);
        const report = document.querySelector('[data-discover-report]');
        if (report) {
            const url = new URL(report.href);
            url.searchParams.set('price', price.textContent);
            report.href = url.href;
        }
        const fits = quote.price <= collectionBudget;
        quoteBox.dataset.status = fits ? 'within' : 'over';
        status.textContent = fits ? 'Dentro del presupuesto' : 'Supera el presupuesto';
    });
}

const shareButton = document.querySelector('[data-share]');
if (shareButton) {
    shareButton.hidden = false;
    shareButton.textContent = navigator.share ? 'Compartir ficha' : 'Copiar enlace';
    shareButton.addEventListener('click', async () => {
        const url = document.querySelector('link[rel="canonical"]').href;
        const result = document.querySelector('[data-share-result]');
        const field = document.querySelector('[data-share-url]');
        result.textContent = '';
        field.hidden = true;
        if (navigator.share) {
            try {
                await navigator.share({title:document.title, url});
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            result.textContent = 'Enlace copiado.';
        } catch {
            field.value = url;
            field.hidden = false;
            field.select();
            result.textContent = 'Copia el enlace para compartir la ficha.';
        }
    });
}
