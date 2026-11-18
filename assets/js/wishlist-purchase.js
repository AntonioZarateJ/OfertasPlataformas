const wishPurchase = document.getElementById('wishPurchasePanel');
const wishPurchaseCurrency = document.getElementById('wishPurchaseCurrency');
const wishCompareFields = [document.getElementById('wishCompareFirst'), document.getElementById('wishCompareSecond')];
let wishPurchaseOwner = -1;

for (const currency of Object.keys(CURRENCY_CONFIG)) wishPurchaseCurrency.add(new Option(currency, currency));

function showWishPurchase(show) {
    document.getElementById('wishListView').setAttribute('aria-pressed', String(!show));
    document.getElementById('wishPurchaseView').setAttribute('aria-pressed', String(show));
    document.getElementById('wishDiscovery').hidden = show;
    document.getElementById('wishlistItemsContainer').hidden = show;
    wishPurchase.hidden = !show;
    if (show) renderWishlistPurchase();
    else renderWishlistDrawerItems();
}

function toggleWishlistPurchase(gameID) {
    const item = userWishlist[gameID];
    if (!item || item.owned) return;
    item.planned = !item.planned;
    persistWishlistState();
    renderWishlistDrawerItems();
    if (wishPurchase.hidden) {
        const card = [...document.querySelectorAll('#wishlistItemsContainer [data-wish-key]')].find(node => node.dataset.wishKey === gameID);
        card?.querySelector('.wish-plan-button')?.focus({preventScroll:true});
    } else {
        wishPurchaseCurrency.focus({preventScroll:true});
    }
}

function wishPurchasePlatform(item) {
    return item.native ? ECOSYSTEM_META[item.platform].name : 'PC';
}

function wishPurchaseContext(item) {
    if (!item.native) return storesMap[item.storeID]?.name || 'Referencia de CheapShark';
    return `${item.store} · ${purchaseRegions[item.region][0]}`;
}

function wishPurchaseQuote(item, currency) {
    const source = item.native ? item.currency : 'USD';
    const price = wishlistCurrentPrice(item);
    const decimals = CURRENCY_CONFIG[currency].decimals;
    const multiplier = source === currency ? 1 : item.native ? undefined : exchangeRates[currency];
    const units = Math.round(price * multiplier * 10 ** decimals);
    return {
        original: nativeMoney(price, source),
        units: Number.isSafeInteger(units) && units >= 0 ? units : null,
        estimated: !item.native
    };
}

function formatWishPurchase(units, currency) {
    return nativeMoney(units / 10 ** CURRENCY_CONFIG[currency].decimals, currency);
}

function renderWishPair() {
    const result = document.getElementById('wishCompareResult');
    const [first, second] = wishCompareFields.map(field => userWishlist[field.value]);
    if (!first || !second || first === second) {
        result.textContent = first && second ? 'Elige dos juegos distintos.' : 'Elige dos favoritos para ver su precio, plataforma y edición.';
        return;
    }
    const currency = wishPurchaseCurrency.value;
    const quotes = [first, second].map(item => wishPurchaseQuote(item, currency));
    const [a, b] = quotes;
    const comparable = a.units !== null && b.units !== null;
    const maximum = comparable ? Math.max(1, a.units, b.units) : 1;
    const lowest = comparable && a.units !== b.units ? Math.min(a.units,b.units) : null;
    const display = (item, quote) => `<article data-purchase-platform="${item.native ? item.platform : 'pc'}">
        ${comparable && quote.units === lowest ? '<span class="wish-pair-lowest">Menor precio</span>' : ''}
        <h4>${escapeHTML(item.title)}</h4>
        <p>${escapeHTML(wishPurchasePlatform(item))} · ${escapeHTML(item.edition || 'Edición sin confirmar')}</p>
        <p>${escapeHTML(wishPurchaseContext(item))}</p>
        <strong>${escapeHTML(quote.units === null ? quote.original : formatWishPurchase(quote.units, currency))}</strong>
        ${comparable ? `<meter min="0" max="${maximum}" value="${quote.units}" aria-hidden="true"></meter>` : ''}
        ${quote.estimated ? `<small>Referencia de PC · ${escapeHTML(quote.original)}</small>` : ''}
    </article>`;
    let summary = 'Los precios están en monedas diferentes. Elige una moneda compatible para ver la diferencia.';
    if (comparable) {
        const difference = Math.abs(a.units - b.units);
        const label = quotes.some(quote => quote.estimated) ? 'Diferencia estimada' : 'Diferencia de precio';
        summary = `${label}: ${formatWishPurchase(difference, currency)}.`;
    }
    result.innerHTML = `<div class="wish-pair-grid">${display(first, a)}${display(second, b)}</div><p>${escapeHTML(summary)}</p>`;
}

function renderWishlistPurchase(favorites = Object.values(userWishlist)) {
    const available = favorites.filter(item => !item.owned);
    const items = available.filter(item => item.planned);
    const count = document.getElementById('wishPurchaseCount');
    count.textContent = items.length;
    count.hidden = items.length === 0;
    if (wishPurchase.hidden) return;
    if (wishPurchaseOwner !== accountEpoch) {
        wishPurchaseOwner = accountEpoch;
        wishPurchaseCurrency.value = currentCurrency;
        wishCompareFields.forEach(field => field.replaceChildren());
    }

    const currency = wishPurchaseCurrency.value;
    let total = 0;
    let included = 0;
    let estimates = false;
    const rows = items.map(item => {
        const quote = wishPurchaseQuote(item, currency);
        if (quote.units !== null) {
            total += quote.units;
            included++;
            estimates ||= quote.estimated;
        }
        const row = document.createElement('li');
        row.dataset.purchasePlatform = item.native ? item.platform : 'pc';
        const price = quote.units === null ? quote.original : formatWishPurchase(quote.units, currency);
        const note = quote.units === null ? 'Fuera del total' : quote.estimated ? `Referencia de PC · ${escapeHTML(quote.original)}` : '';
        row.innerHTML = `<div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(wishPurchasePlatform(item))} · ${escapeHTML(wishPurchaseContext(item))}</small></div>
            <div><b>${escapeHTML(price)}</b><small>${note}</small></div>
            <button type="button" aria-label="Quitar ${escapeHTML(item.title)} de la lista de compra"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
        row.querySelector('button').onclick = () => toggleWishlistPurchase(item.gameID);
        return row;
    });
    document.getElementById('wishPurchaseItems').replaceChildren(...rows);
    updateWishShare(items);
    const totalFits = Number.isSafeInteger(total);
    const coverage = document.getElementById('wishPurchaseCoverage');
    coverage.hidden = !items.length || included === items.length || !totalFits;
    coverage.max = Math.max(1,items.length);
    coverage.value = included;
    document.getElementById('wishPurchaseTotal').textContent = included && totalFits ? formatWishPurchase(total, currency) : '—';
    const status = document.getElementById('wishPurchaseStatus');
    if (!items.length) status.textContent = 'Desde Favoritos, pulsa Añadir a compra en los juegos que tengas en mente.';
    else if (!totalFits) status.textContent = 'El importe está fuera de rango. Revisa los precios de la lista.';
    else status.textContent = `${included === items.length ? 'Total' : `Subtotal de ${included} de ${items.length} juegos`}${estimates ? ' estimado, con referencias de PC en USD' : ' según los últimos precios guardados'}. Confirma el importe en la tienda.`;

    available.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    for (const field of wishCompareFields) {
        const selected = field.value;
        field.replaceChildren(new Option('Seleccionar', ''), ...available.map(item =>
            new Option(`${item.title} · ${wishPurchasePlatform(item)}`, item.gameID)));
        if (available.some(item => item.gameID === selected)) field.value = selected;
    }
    renderWishPair();
}

document.getElementById('wishListView').addEventListener('click', () => showWishPurchase(false));
document.getElementById('wishPurchaseView').addEventListener('click', () => showWishPurchase(true));
wishPurchaseCurrency.addEventListener('change', () => renderWishlistPurchase());
wishCompareFields.forEach(field => field.addEventListener('change', renderWishPair));
