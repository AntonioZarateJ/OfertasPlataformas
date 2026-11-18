function observedPriceHistory(quote, region) {
    const history = quote?.history;
    if (!history?.points?.length) return '';
    const points = history.points.slice(-30);
    const ceiling = Math.max(1, ...points.map(point => point.max));
    const money = price => escapeHTML(nativeMoney(price, quote.currency));
    const bars = points.map((point,index) => `<span ${index === points.length - 1 ? 'class="history-bar-current"' : ''} style="--price-height:${Math.max(2, (point.min / ceiling * 100)).toFixed(2)}%"></span>`).join('');
    const table = points.map(point => `<tr><th scope="row">${escapeHTML(point.date)}</th><td>${money(point.min)}</td><td>${money(point.max)}</td></tr>`).join('');
    const latest = points[points.length - 1];
    const drop = history.drop ? `<p class="observed-drop">Bajada observada de ${money(history.drop.from)} a ${money(quote.price)} en las últimas 24 horas.</p>` : '';
    return `<details class="price-insight"><summary>Historial de ${escapeHTML(quote.title)} · ${escapeHTML(quote.store)}</summary>
        <p>${escapeHTML(region)} · ${escapeHTML(quote.currency)} · ${escapeHTML(quote.edition || 'Producto consultado')}</p>
        ${drop}<p>${points.length} días observados. Cada barra muestra el mínimo que vimos ese día.</p>
        <div class="price-history-bars" aria-hidden="true">${bars}</div>
        ${points.length > 1 ? `<label class="history-day-control">Explorar días <input type="range" min="0" max="${points.length - 1}" value="${points.length - 1}" aria-valuetext="${escapeHTML(latest.date)}" data-history-picker></label>` : ''}
        <output class="history-day-price" aria-live="polite">${escapeHTML(latest.date)} · Mínimo ${money(latest.min)} · Máximo ${money(latest.max)}</output>
        <details class="price-history-table"><summary>Ver precios por día</summary><table><thead><tr><th>Fecha</th><th>Mínimo</th><th>Máximo</th></tr></thead><tbody>${table}</tbody></table></details>
        ${history.persistent === false ? '<small>Registro temporal de este servidor.</small>' : ''}
    </details>`;
}

function bundlePriceComparison(currency, region, bundle) {
    const value = bundle && Number.isFinite(bundle.price) ? bundle.price : '';
    const context = [bundle?.store, region, currency].filter(Boolean).join(' · ');
    return `<details class="price-insight">
        <summary>Comparar un paquete con compras separadas</summary>
        <p>${escapeHTML(context)}. Confirma en la tienda qué incluye el paquete y captura sus precios individuales en la misma moneda y región.</p>
        <div class="bundle-price-inputs" data-bundle-currency="${escapeHTML(currency)}">
            <label>${escapeHTML(bundle?.title || 'Precio del paquete')}<input data-bundle-total type="number" min="0" step="any" inputmode="decimal" value="${value}"></label>
            <div class="bundle-components">${bundlePartField(1)}${bundlePartField(2)}</div>
            <button data-bundle-add type="button">Añadir otro precio</button>
            <p class="bundle-result" role="status">Captura todos los importes para ver la diferencia.</p>
        </div>
    </details>`;
}

function bundlePartField(index) {
    return `<label>Producto ${index}<input data-bundle-part type="number" min="0" step="any" inputmode="decimal"></label>`;
}

function updateBundleComparison(container) {
    const fields = [...container.querySelectorAll('input')];
    const outcome = container.querySelector('.bundle-result');
    if (fields.some(field => field.value === '' || !field.validity.valid || !validWishlistAmount(field.value))) {
        outcome.textContent = 'Captura todos los importes para ver la diferencia.';
        return;
    }
    const currency = container.dataset.bundleCurrency;
    const scale = 10 ** new Intl.NumberFormat('es-MX', {style:'currency', currency}).resolvedOptions().maximumFractionDigits;
    const [bundle, ...parts] = fields.map(field => Math.round(field.valueAsNumber * scale));
    const total = parts.reduce((sum, price) => sum + price, 0);
    const difference = total - bundle;
    const result = difference === 0 ? 'Ambas opciones cuestan lo mismo.' :
        difference > 0 ? `El paquete cuesta ${nativeMoney(difference / scale, currency)} menos.` :
            `Por separado cuesta ${nativeMoney(-difference / scale, currency)} menos.`;
    outcome.textContent = `Por separado: ${nativeMoney(total / scale, currency)}. ${result}`;
}

document.addEventListener('input', event => {
    if (event.target.matches('[data-history-picker]')) {
        const chart = event.target.closest('.price-insight');
        const index = event.target.valueAsNumber;
        const row = chart.querySelectorAll('tbody tr')[index];
        if (!row) return;
        chart.querySelectorAll('.price-history-bars span').forEach((bar, position) => {
            bar.classList.toggle('history-bar-current', position === index);
        });
        const [date, min, max] = [...row.cells].map(cell => cell.textContent);
        chart.querySelector('.history-day-price').textContent = `${date} · Mínimo ${min} · Máximo ${max}`;
        event.target.setAttribute('aria-valuetext', date);
    }
    const container = event.target.closest('[data-bundle-currency]');
    if (container) updateBundleComparison(container);
});
document.addEventListener('click', event => {
    const button = event.target.closest('[data-bundle-add]');
    if (!button) return;
    const container = button.closest('[data-bundle-currency]');
    const list = container.querySelector('.bundle-components');
    list.insertAdjacentHTML('beforeend', bundlePartField(list.children.length + 1));
    button.disabled = list.children.length >= 12;
    list.lastElementChild.querySelector('input').focus();
    updateBundleComparison(container);
});

const recentDropsPanel = document.getElementById('recentDrops');
let recentDropsRequest = 0;
async function refreshRecentDrops() {
    const generation = ++recentDropsRequest;
    if (!recentDropsPanel.open) return;
    const platform = activeEcosystem;
    const region = currentRegion;
    const scope = `${ECOSYSTEM_META[platform].name} · ${purchaseRegions[region][0]}`;
    const status = document.getElementById('recentDropsStatus');
    const items = document.getElementById('recentDropsItems');
    status.textContent = `Consultando el registro de ${scope}…`;
    items.replaceChildren();
    try {
        const data = await requestJSON('/api/recent-drops?' + new URLSearchParams({platform, region}));
        if (generation !== recentDropsRequest) return;
        if (data.platform !== platform || data.region !== region || !Array.isArray(data.items)) throw new Error('Registro incompleto');
        for (const item of data.items) {
            const url = safeURL(item.url);
            if (!url || item.currency !== purchaseRegions[region][1] || !validWishlistAmount(item.price) ||
                !validWishlistAmount(item.previous) || item.price >= item.previous) continue;
            const row = document.createElement('li');
            const link = document.createElement('a');
            link.href = url;
            link.textContent = item.title;
            const price = document.createElement('span');
            price.textContent = `${item.store} · ${nativeMoney(item.previous, item.currency)} → ${nativeMoney(item.price, item.currency)}`;
            row.append(link, price);
            items.append(row);
        }
        status.textContent = items.children.length ? `${scope} · Bajadas observadas en las últimas 24 horas. Confirma el precio en la tienda.` :
            `${scope} · Aún no hay bajadas observadas en las últimas 24 horas.`;
    } catch {
        if (generation === recentDropsRequest) status.textContent = 'No se pudo consultar el registro. Vuelve a abrir esta sección para reintentar.';
    }
}
recentDropsPanel.addEventListener('toggle', refreshRecentDrops);
