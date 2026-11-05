const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {measure} = require('../scripts/prueba-carga.cjs');

test('La prueba remota detiene nuevas rondas al recibir un rechazo', async () => {
    let calls = 0;
    const server = http.createServer((req, res) => {
        calls++;
        res.writeHead(calls === 1 ? 200 : 429, {'Retry-After': '30'});
        res.end('respuesta');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const result = await measure('http://127.0.0.1:' + server.address().port, {concurrency: 1, rounds: 5, pause: 0, route: () => '/', stopOnFailure: true});
        assert.equal(calls, 2);
        assert.equal(result.requests, 2);
        assert.equal(result.stoppedEarly, true);
        assert.equal(result.statuses['429'], 1);
        assert.equal(result.errorPercent, 50);
        assert(result.successP95Ms >= 0);
    } finally {await new Promise(resolve => server.close(resolve));}
});

test('El informe distingue timeouts y no presenta respuestas fallidas como latencia correcta', async () => {
    const server = http.createServer(() => {});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const result = await measure('http://127.0.0.1:' + server.address().port, {concurrency: 1, rounds: 1, timeout: 50, route: () => '/'});
        assert.equal(result.statuses.timeout, 1);
        assert.equal(result.successP95Ms, null);
        assert.equal(result.errorPercent, 100);
    } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});
