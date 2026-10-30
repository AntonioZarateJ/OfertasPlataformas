class BoundedCache extends Map {
    constructor({maxEntries = 200, maxBytes = 24 * 1024 * 1024} = {}) {
        super(); this.maxEntries = maxEntries; this.maxBytes = maxBytes; this.bytes = 0;
    }
    set(key, value) {
        const bytes = value.bytes ?? Buffer.byteLength(JSON.stringify(value.data ?? value));
        this.delete(key);
        if (bytes > this.maxBytes) return this;
        while (this.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) this.delete(this.keys().next().value);
        this.bytes += bytes;
        return super.set(key, {...value, bytes});
    }
    delete(key) {const value = super.get(key); if (value) this.bytes -= value.bytes; return super.delete(key);}
    clear() {super.clear(); this.bytes = 0;}
}
module.exports = {BoundedCache};
