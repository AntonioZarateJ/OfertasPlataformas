const fs = require('node:fs/promises');
const {gzip} = require('node:zlib');
const {promisify} = require('node:util');
const {BoundedCache} = require('./bounded-cache.cjs');
const compress = promisify(gzip);

function acceptsGzip(header = '') {
    const value = String(header).split(',').map(part => part.trim()).find(part => /^gzip(?:\s*;|$)/i.test(part));
    const match = value?.match(/^gzip(?:\s*;\s*q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?$/i);
    return Boolean(match && (match[1] === undefined || Number(match[1]) > 0));
}

function createStaticAssetCache() {
    const cache = new BoundedCache({maxEntries: 100, maxBytes: 8 * 1024 * 1024});
    const pending = new Map();
    return async (file, version, zipped) => {
        const current = cache.get(file);
        if (current?.version === version && (!zipped || current.zipped)) return zipped ? current.zipped : current.raw;
        const key = file + ':' + version + ':' + zipped;
        if (!pending.has(key)) {
            const work = (async () => {
                const raw = current?.version === version ? current.raw : await fs.readFile(file);
                const compressed = zipped ? await compress(raw) : current?.version === version ? current.zipped : undefined;
                const entry = {version, raw, zipped: compressed, bytes: raw.length + (compressed?.length || 0)};
                // A simultaneous identity request must not replace an already compressed copy.
                const latest = cache.get(file);
                if (!(latest?.version === version && latest.zipped && !compressed)) cache.set(file, entry);
                return zipped ? compressed : raw;
            })().finally(() => {if (pending.get(key) === work) pending.delete(key);});
            pending.set(key, work);
        }
        return pending.get(key);
    };
}
module.exports = {acceptsGzip, createStaticAssetCache};
