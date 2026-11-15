const fs = require('node:fs/promises');
const path = require('node:path');

const dayMs = 86_400_000;
const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
const localPort = process.env.PORT;
const alternatePort = !onRender && /^\d{4,5}$/.test(localPort || '') && localPort !== '3000';
const defaultPath = path.join(__dirname, '.data', alternatePort ? `price-history-${localPort}.json` : 'price-history.json');
const mexicoDay = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit'});

function recentDrop(entry, now) {
    const drop = entry?.drop;
    return drop && drop.at <= now && now - drop.previousAt < dayMs ? drop : null;
}

function createHistory(file = process.env.PRICE_HISTORY_PATH || defaultPath, {
    durable = !onRender || Boolean(process.env.PRICE_HISTORY_PATH)
} = {}) {
    let data;
    let queue = Promise.resolve();
    let saved = true;
    let lastWriteAt = 0;

    function run(operation) {
        const work = queue.then(async () => {
            if (!data) {
                try {
                    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
                    data = new Map(Object.entries(stored));
                } catch {
                    data = new Map();
                }
            }
            return operation();
        });
        queue = work.catch(() => {});
        return work;
    }

    async function record(scope, quotes, now = Date.now()) {
        if (!quotes.length) return quotes;
        return run(async () => {
            const date = mexicoDay.format(now);
            const [platform, region] = scope.split('|');
            let changed = false;
            const recorded = quotes.map(quote => {
                if (!Number.isFinite(quote.price) || quote.price < 0 || !quote.id || !quote.store || !quote.currency) return {quote};
                const id = JSON.stringify([scope, quote.store, quote.id, quote.currency]);
                const old = data.get(id);
                const entry = Array.isArray(old) ? {points:old} : Array.isArray(old?.points) ? old : {points:[]};
                if (entry.checkedAt > now) return {quote, entry};
                let point = entry.points.find(day => day.date === date);
                if (!point) {
                    point = {date, min:quote.price, max:quote.price, last:quote.price};
                    entry.points.push(point);
                    entry.points = entry.points.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
                    changed = true;
                } else if (point.last !== quote.price) {
                    point.min = Math.min(point.min, quote.price);
                    point.max = Math.max(point.max, quote.price);
                    point.last = quote.price;
                    changed = true;
                }
                if (Number.isFinite(entry.price) && quote.price !== entry.price) {
                    entry.drop = quote.price < entry.price && now - entry.checkedAt < dayMs ?
                        {from:entry.price, previousAt:entry.checkedAt, at:now} : null;
                    changed = true;
                }
                Object.assign(entry, {price:quote.price, checkedAt:now});
                if (quote.kind === 'official') {
                    entry.offer = {platform, region, title:String(quote.title || '').slice(0,240), edition:String(quote.edition || '').slice(0,240),
                        store:quote.store, currency:quote.currency, url:String(quote.url || '').slice(0,800)};
                }
                data.delete(id);
                data.set(id, entry);
                return {quote, entry};
            });
            while (data.size > 3000) data.delete(data.keys().next().value);
            if (changed || !saved || now - lastWriteAt >= 60 * 60 * 1000) {
                try {
                    await fs.mkdir(path.dirname(file), {recursive:true});
                    await fs.writeFile(file + '.tmp', JSON.stringify(Object.fromEntries(data)));
                    await fs.rename(file + '.tmp', file);
                    saved = true;
                    lastWriteAt = now;
                } catch {
                    saved = false;
                }
            }
            return recorded.map(({quote, entry}) => {
                if (!entry?.points.length) return quote;
                const points = entry.points;
                return {...quote, history:{min:Math.min(...points.map(point => point.min)), max:Math.max(...points.map(point => point.max)),
                    days:points.length, since:points[0].date, points, drop:recentDrop(entry, now), persistent:durable && saved}};
            });
        });
    }

    record.recentDrops = (platform, region, now = Date.now()) => run(() => [...data.values()]
        .filter(entry => entry?.offer?.platform === platform && entry.offer.region === region &&
            recentDrop(entry, now) && entry.offer.title && entry.offer.url)
        .sort((a, b) => b.drop.at - a.drop.at)
        .slice(0, 12)
        .map(entry => ({...entry.offer, price:entry.price, previous:entry.drop.from, checkedAt:entry.checkedAt})));

    return record;
}

const recordHistory = createHistory();
module.exports = {createHistory, recordHistory};
