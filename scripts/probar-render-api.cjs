const fs = require('node:fs/promises');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const {setTimeout: delay} = require('node:timers/promises');
const {measure} = require('./prueba-carga.cjs');
const BASE = 'https://salesplataforms.onrender.com';
const scenarios = [
    {platform: 'pc', route: '/api/deals?' + new URLSearchParams({storeID: '1', pageSize: '60', pageNumber: '0', sortBy: 'DealRating', onSale: '1'})},
    ...['xbox', 'ps', 'switch'].map(platform => ({platform, route: '/api/console-catalog?' + new URLSearchParams({platform, region: 'MX', q: '', source: 'all', sort: 'relevance', deals: '1', cursor: '{}'})}))
];

function inspectCatalog(platform, data) {
    const items = platform === 'pc' ? data : data?.items;
    if (!Array.isArray(items)) return {valid: false, reason: 'El catálogo no tiene el formato esperado'};
    const invalid = items.filter(item => {
        const price = platform === 'pc' ? item.salePrice : item.price;
        return price === null || price === '' || price === undefined || !Number.isFinite(Number(price)) || Number(price) < 0 ||
            platform !== 'pc' && item.currency !== 'MXN';
    }).length;
    const sources = platform === 'pc' ? [{name: 'CheapShark / Steam', status: 'ok', count: items.length}]
        : Array.isArray(data.sources) ? data.sources.map(source => ({name: source.name, status: source.status, count: source.count})) : [];
    const identity = platform === 'pc' || data.platform === platform && data.region === 'MX' && data.currency === 'MXN';
    const unavailable = sources.some(source => source.status === 'unavailable');
    return {valid: identity && invalid === 0 && sources.length > 0, count: items.length, invalidPrices: invalid,
        partial: unavailable, sources, checkedAt: platform === 'pc' ? null : data.checkedAt,
        referenceCurrency: platform === 'pc' ? 'USD, referencia CheapShark; no valida el precio regional de Steam' : 'MXN'};
}

async function probe(scenario) {
    const start = performance.now();
    try {
        const response = await fetch(BASE + scenario.route, {redirect: 'manual', signal: AbortSignal.timeout(20000), headers: {'User-Agent': 'RadarPlay-Controlled-API-Check/1.0'}});
        const body = await response.arrayBuffer();
        let data; try {data = JSON.parse(Buffer.from(body).toString('utf8'));} catch {}
        return {platform: scenario.platform, route: scenario.route, status: response.status, elapsedMs: Math.round(performance.now() - start),
            bytes: body.byteLength, hsts: Boolean(response.headers.get('strict-transport-security')), retryAfter: response.headers.get('retry-after'),
            ...(response.ok ? inspectCatalog(scenario.platform, data) : {valid: false, reason: 'Respuesta HTTP no satisfactoria'})};
    } catch (error) {
        return {platform: scenario.platform, route: scenario.route, status: error.name === 'TimeoutError' ? 'timeout' : 'network', elapsedMs: Math.round(performance.now() - start), valid: false};
    }
}

async function run() {
    console.log('Render APIs: máximo 40 peticiones, hasta 5 simultáneas al mismo catálogo. Sin cuentas, Firebase, reintentos ni barridos.');
    const report = {createdAt: new Date().toISOString(), base: BASE, initial: [], shared: [], limitations: [
        'Caché inicial desconocida; no se fuerza su vaciado ni se usan parámetros para evadirla.',
        'El servidor puede consultar tiendas reales al preparar un catálogo. Las fases siguientes reutilizan su URL.',
        'No certifica capacidad máxima, carga sostenida, consultas diferentes simultáneas ni CPU/memoria de Render.',
        'Un precio con formato válido no demuestra que coincida con el checkout de la tienda.'
    ]};
    for (const scenario of scenarios) {
        const first = await probe(scenario); report.initial.push(first);
        console.log(JSON.stringify({phase: 'initial', ...first}));
        if (first.status !== 200) {report.stopped = 'Se detuvo por error HTTP, red o timeout; no se reintenta.'; break;}
        if (!first.valid || first.partial || first.count === 0 || first.elapsedMs > 8000) {
            console.log('Se omite la carga de ' + scenario.platform + ': fuente parcial, catálogo vacío, inválido o respuesta lenta.');
            await delay(1500); continue;
        }
        for (const concurrency of [1, 3, 5]) {
            await delay(1000);
            const row = {platform: scenario.platform, ...await measure(BASE, {concurrency, rounds: 1, timeout: 12000, route: () => scenario.route, stopOnFailure: true})};
            report.shared.push(row);
            console.log(JSON.stringify({phase: 'shared', ...row}));
            if (row.errorPercent > 0 || row.successP95Ms > 3000) {report.stopped = 'Se detuvo al detectar rechazo o aumento de latencia.'; break;}
        }
        if (report.stopped) break;
    }
    const folder = path.resolve(__dirname, '../test-results'); await fs.mkdir(folder, {recursive: true});
    const file = path.join(folder, 'render-api-' + Date.now() + '.json');
    await fs.writeFile(file, JSON.stringify(report, null, 2)); console.log('Informe: ' + file);
    return report;
}
if (require.main === module) run().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {inspectCatalog};
