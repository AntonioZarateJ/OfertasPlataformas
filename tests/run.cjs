const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const files = fs.readdirSync(__dirname).filter(name => name.endsWith('.cjs') && name !== 'run.cjs');
const env = {...process.env};
if (!env.BROWSER_CHANNEL && process.platform === 'win32') env.BROWSER_CHANNEL = 'chrome';
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...files.map(name => path.join(__dirname, name))], {stdio: 'inherit', env});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
