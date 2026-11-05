const {fork} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const {performance, monitorEventLoopDelay} = require('node:perf_hooks');
const {setTimeout: delay} = require('node:timers/promises');

// Solo destinos propios: la carga alta siempre utiliza un servidor aislado con tiendas simuladas.
const RENDER = 'https://salesplataforms.onrender.com';
const ROOT = path.resolve(__dirname, '..');
const profiles = {
    paginas: {stages: [1, 5, 10, 25, 50, 100], rounds: 3},
    catalogoCompartido: {stages: [1, 5, 10, 20, 40], rounds: 1},
    catalogoEnCache: {stages: [10, 25, 50], rounds: 1},
    busquedasDistintas: {stages: [1, 5, 10, 20], rounds: 1}
};

function percentile(values, fraction) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] * 100) / 100;
}

async function measure(base, {concurrency, rounds, route, pause = 80, timeout = 12000, stopOnFailure = false}) {
    const samples = [], statuses = {}, failures = [];
    let bytes = 0, stop = false;
    const start = performance.now();
    await Promise.all(Array.from({length: concurrency}, async (_, user) => {
        for (let round = 0; round < rounds && !stop; round++) {
            const tick = performance.now();
            let status;
            try {
                const response = await fetch(new URL(route(user, round), base), {redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: {'User-Agent': 'RadarPlay-Controlled-Load-Test/1.0'}});
                status = String(response.status);
                const size = (await response.arrayBuffer()).byteLength;
                bytes += size;
            } catch (error) {status = error.name === 'TimeoutError' ? 'timeout' : 'network';}
            const ms = performance.now() - tick;
            statuses[status] = (statuses[status] || 0) + 1;
            samples.push({status, ms});
            if (!/^2\d\d$/.test(status)) {
                failures.push({status, user, round});
                if (stopOnFailure) stop = true;
            }
            if (round + 1 < rounds && !stop) await delay(pause);
        }
    }));
    const duration = performance.now() - start;
    const ok = samples.filter(sample => /^2\d\d$/.test(sample.status));
    return {concurrency, requests: samples.length, statuses, errorPercent: Math.round(failures.length / Math.max(1, samples.length) * 10000) / 100,
        p50Ms: percentile(samples.map(sample => sample.ms), 0.5), p95Ms: percentile(samples.map(sample => sample.ms), 0.95),
        successP95Ms: percentile(ok.map(sample => sample.ms), 0.95), elapsedMs: Math.round(duration),
        requestsPerSecond: Math.round(samples.length / duration * 100000) / 100, bytes, stoppedEarly: stop};
}

async function worker() {
    const {createServer} = require('../server.cjs');
    const lag = monitorEventLoopDelay({resolution: 10}); lag.enable();
    const baselineRss = process.memoryUsage().rss;
    let peakRss = baselineRss, upstreamCalls = 0;
    const sampler = setInterval(() => {peakRss = Math.max(peakRss, process.memoryUsage().rss);}, 20);
    sampler.unref();
    const cpuStart = process.cpuUsage();
    const server = createServer({fetchImpl: async (input, options) => {
        // No se utiliza fetch real. Mantiene la cola, caché y controles del servidor de producción.
        const url = new URL(input);
        if (url.hostname !== 'www.cheapshark.com' || url.pathname !== '/api/1.0/deals') throw Error('Fuente no simulada');
        upstreamCalls++;
        await delay(250, undefined, {signal: options.signal});
        return Response.json(Array.from({length: 60}, (_, i) => ({gameID: String(i + 1), title: 'Juego simulado ' + i,
            salePrice: '10.00', normalPrice: '20.00', savings: '50', storeID: '1', thumb: ''})));
    }});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const cleanup = () => {clearInterval(sampler); lag.disable(); server.closeAllConnections(); server.close(() => process.exit(0));};
    process.on('disconnect', cleanup);
    process.on('message', message => {
        if (message === 'stats') {
            const cpu = process.cpuUsage(cpuStart);
            process.send({type: 'stats', data: {upstreamCalls, baselineRssMiB: +(baselineRss / 1048576).toFixed(2), peakRssMiB: +(Math.max(peakRss, process.memoryUsage().rss) / 1048576).toFixed(2), eventLoopP95Ms: +(lag.percentile(95) / 1e6).toFixed(2), cpuMs: +((cpu.user + cpu.system) / 1000).toFixed(2)}});
        }
        if (message === 'stop') cleanup();
    });
    process.send({type: 'ready', base: 'http://127.0.0.1:' + server.address().port});
}

function childMessage(child, type, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {cleanup(); reject(Error('No respondió el servidor de prueba'));}, timeout);
        const onMessage = message => {if (message.type === type) {cleanup(); resolve(message);}};
        const onExit = () => {cleanup(); reject(Error('El servidor de prueba terminó antes de responder'));};
        const onError = error => {cleanup(); reject(error);};
        function cleanup() {clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); child.off('error', onError);}
        child.on('message', onMessage); child.once('exit', onExit); child.once('error', onError);
    });
}

async function localStage(profile, concurrency) {
    // No heredar configuración de producción, confianza en proxies ni credenciales del proceso padre.
    const env = {SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP, TRUST_PROXY: '0'};
    const child = fork(__filename, ['--worker'], {env, stdio: ['ignore', 'ignore', 'inherit', 'ipc']});
    try {
        const {base} = await childMessage(child, 'ready');
        if (profile === 'catalogoEnCache') {
            const warm = await fetch(base + '/api/deals?storeID=1&pageNumber=0&pageSize=60&title=compartido');
            if (!warm.ok) throw Error('No se pudo preparar la caché local');
            await warm.arrayBuffer();
        }
        const resources = ['/', '/assets/css/styles.css', '/assets/js/catalog.js', '/privacidad', '/assets/css/tailwind.css'];
        const result = await measure(base, {concurrency, rounds: profiles[profile].rounds,
            route: (user, round) => profile === 'paginas' ? resources[(user + round) % resources.length]
                : '/api/deals?storeID=1&pageNumber=0&pageSize=60&title=' + (['catalogoCompartido', 'catalogoEnCache'].includes(profile) ? 'compartido' : 'busqueda-' + user)});
        const stats = childMessage(child, 'stats'); child.send('stats');
        return {profile, ...result, server: (await stats).data};
    } finally {
        // Se termina exclusivamente el proceso hijo creado por esta etapa, no el servidor del usuario.
        if (child.exitCode === null) {
            await new Promise(resolve => {
                const timer = setTimeout(() => {child.kill();}, 2000);
                child.once('exit', () => {clearTimeout(timer); resolve();});
                if (child.connected) child.send('stop'); else child.kill();
            });
        }
    }
}

function printRow(row) {
    console.log(`${row.profile}: ${row.concurrency} simultáneas | ${row.requests} solicitudes | p95 correctas ${row.successP95Ms ?? '-'} ms | errores ${row.errorPercent}% | ${JSON.stringify(row.statuses)}`);
}

async function run(mode = 'local') {
    const report = {createdAt: new Date().toISOString(), mode, rows: [], limitations: mode === 'local'
        ? ['Solicitudes HTTP, no personas ni navegadores completos.', 'Tiendas simuladas con 250 ms de latencia, sin tráfico a proveedores ni Firebase.', 'Controles reales de producción sin desactivar: todos los clientes comparten una IP.', 'No mide hardware de Render, sincronización Firebase, rendimiento visual ni capacidad máxima sostenible.']
        : ['Comprobación breve de Render, no prueba máxima ni de carga sostenida.', 'Solo página inicial; no se prueban APIs, Firebase ni tiendas.']};
    if (mode === 'render') {
        console.log('Render: máximo 19 peticiones contando el arranque, 3 simultáneas; se detiene si hay errores. Sin consultas a tiendas ni Firebase.');
        // Separar el arranque en frío de las muestras de tráfico normal.
        report.coldStart = await measure(RENDER, {concurrency: 1, rounds: 1, timeout: 65000, route: () => '/', stopOnFailure: true});
        if (report.coldStart.errorPercent === 0) {
            for (const concurrency of [1, 2, 3]) {
                const row = {profile: 'render-pagina', ...await measure(RENDER, {concurrency, rounds: 3, pause: 2000, route: () => '/', stopOnFailure: true})};
                report.rows.push(row); printRow(row);
                if (row.errorPercent > 0 || row.successP95Ms > 5000) break;
                await delay(1000);
            }
        }
    } else {
        console.log('Prueba local aislada. Tiendas ficticias; no llama a Firebase ni a servicios externos.');
        for (const [profile, settings] of Object.entries(profiles)) {
            for (const concurrency of settings.stages) {
                const row = await localStage(profile, concurrency); report.rows.push(row); printRow(row);
                // No continuar subiendo cuando aparecen rechazos o una espera excesiva.
                if (row.errorPercent > 0 || row.successP95Ms > 8000) break;
            }
        }
    }
    await fs.mkdir(path.join(ROOT, 'test-results'), {recursive: true});
    const file = path.join(ROOT, 'test-results', `carga-${mode}-${Date.now()}.json`);
    await fs.writeFile(file, JSON.stringify(report, null, 2));
    console.log('Informe guardado: ' + file);
    return report;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const task = args.length === 0 ? run() : args.length === 1 && args[0] === '--render' ? run('render')
        : args.length === 1 && args[0] === '--worker' && process.send ? worker() : Promise.reject(Error('Uso: node scripts/prueba-carga.cjs [--render]'));
    task.catch(error => {console.error(error.message); process.exitCode = 1;});
}
module.exports = {measure, percentile, run};
