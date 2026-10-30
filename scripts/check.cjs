const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git', '.data', 'test-results', 'playwright-report']);
let checked = 0;
function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        if (ignored.has(entry.name)) continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile() && /\.(js|cjs)$/.test(entry.name)) {
            const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
            if (result.status !== 0) throw new Error(result.stderr || 'Error de sintaxis: ' + file);
            checked++;
        }
    }
}
visit(root);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/\son(?:click|change|submit|input)\s*=/.test(html)) throw new Error('Hay manejadores inline incompatibles con CSP.');
console.log(`Sintaxis correcta en ${checked} archivos JavaScript; sin manejadores inline en HTML.`);
