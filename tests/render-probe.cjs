const {test} = require('node:test');
const assert = require('node:assert/strict');
const {inspectCatalog} = require('../scripts/probar-render-api.cjs');

test('La medición real identifica fuentes parciales y no acepta precios o regiones incorrectos', () => {
    const catalog = {platform: 'xbox', region: 'MX', currency: 'MXN', items: [{price: 12, currency: 'MXN'}], sources: [{name: 'Xbox Store', status: 'ok', count: 1}, {name: 'Eneba', status: 'unavailable', count: 0}]};
    assert.equal(inspectCatalog('xbox', catalog).partial, true);
    assert.equal(inspectCatalog('xbox', {...catalog, region: 'US'}).valid, false);
    assert.equal(inspectCatalog('xbox', {...catalog, items: [{price: null, currency: 'MXN'}]}).valid, false);
    assert.equal(inspectCatalog('xbox', {...catalog, items: [{price: 12, currency: 'USD'}]}).valid, false);
    assert.equal(inspectCatalog('pc', [{salePrice: '0.00'}]).valid, true);
    assert.equal(inspectCatalog('pc', {error: 'unavailable'}).valid, false);
});
