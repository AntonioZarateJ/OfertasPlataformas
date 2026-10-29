const purchaseRegions = { MX: ['México', 'MXN'], US: ['Estados Unidos', 'USD'], ES: ['España', 'EUR'], GB: ['Reino Unido', 'GBP'], BR: ['Brasil', 'BRL'], JP: ['Japón', 'JPY'] };
let currentRegion = 'MX';
try { if (purchaseRegions[localStorage.getItem('purchaseRegion')]) currentRegion = localStorage.getItem('purchaseRegion'); } catch {}
document.getElementById('regionSelect').value = currentRegion;
currentCurrency = purchaseRegions[currentRegion][1];
currencySelect.value = currentCurrency;
document.getElementById('regionSelect').addEventListener('change', e => {
    currentRegion = e.target.value;
    try { localStorage.setItem('purchaseRegion', currentRegion); } catch {}
    regionalPrices.clear();
    responseCache.clear();
    currentCurrency = purchaseRegions[currentRegion][1];
    currencySelect.value = currentCurrency;
    currencySelect.dispatchEvent(new Event('change'));
    closeAnalyticsModal();
    selectSmartChip(activeChip === 'search' ? 'top' : activeChip);
});
const regionalPrices = new Map();
const regionalWaiters = new Map();
let regionalTimer;
function steamRegionalPrice(id) {
    id = String(id);
    if (!/^\d+$/.test(id)) return Promise.resolve(null);
    const key = currentRegion + id;
    const cached = regionalPrices.get(key);
    if (cached && Date.now() - cached.checkedAt < 60000) return Promise.resolve(cached);
    return new Promise(resolve => {
        if (!regionalWaiters.has(key)) regionalWaiters.set(key, { id, region: currentRegion, waiters: [] });
        regionalWaiters.get(key).waiters.push(resolve);
        clearTimeout(regionalTimer);
        regionalTimer = setTimeout(flushRegionalPrices, 40);
    });
}
async function flushRegionalPrices() {
    const all = [...regionalWaiters.values()];
    regionalWaiters.clear();
    for (const selected of Object.keys(purchaseRegions)) {
    const batch = all.filter(item => item.region === selected);
    for (let offset = 0; offset < batch.length; offset += 40) {
        const group = batch.slice(offset, offset + 40);
        let data = {};
        try { data = await requestJSON(`/api/steam-prices?appids=${group.map(item => item.id).join(',')}&region=${group[0].region}`, { ttl: 60000 }); }
        catch { /* Nunca sustituir un fallo por un precio inventado. */ }
        for (const { id, region, waiters } of group) {
            const price = data[id]?.success && data[id]?.data?.price_overview;
            const quote = price?.currency === purchaseRegions[region][1] && Number.isFinite(price.final)
                ? { amount: price.final / 100, currency: price.currency, region, initial: price.initial / 100, discount: price.discount_percent, checkedAt: Date.now() } : null;
            if (quote) regionalPrices.set(region + id, quote);
            waiters.forEach(resolve => resolve(quote));
        }
    }
}
}
async function showSteamRegionalPrice(element, id) {
    element.textContent = `Consultando Steam ${purchaseRegions[currentRegion][0]}…`;
    const region = currentRegion;
    const quote = await steamRegionalPrice(id);
    if (region !== currentRegion) return;
    if (!element.isConnected) return;
    const box = element.parentElement.querySelector('.price-box');
    if (box && quote) {
        box.querySelector('span.uppercase')?.replaceChildren(document.createTextNode('Steam '+purchaseRegions[region][0]));
        box.dataset.regionalAmount = quote.amount;
        box.dataset.regionalCurrency = quote.currency;
        box.querySelector('.normal-val').textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: quote.currency }).format(quote.initial);
        if (currentCurrency === quote.currency) box.querySelector('.sale-val').textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: quote.currency }).format(quote.amount) + ' ' + quote.currency;
    }
    element.textContent = quote
        ? `Steam ${purchaseRegions[currentRegion][0]}: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: quote.currency }).format(quote.amount)} ${quote.currency} · ${quote.discount > 0 ? '-' + quote.discount + '%' : 'Sin descuento'} · consultado ${new Date(quote.checkedAt).toLocaleTimeString('es-MX')}. Juego individual; no incluye lotes.`
        : `Steam ${purchaseRegions[currentRegion][0]}: precio regional no disponible. Confirma en la tienda.`;
}
