const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {publicFirebaseConfig, securityHeaders} = require('../security.cjs');
const key = '6L' + 'a'.repeat(38);

function context() {
    const warnings = [];
    const sandbox = vm.createContext({window: {addEventListener() {}}, location: {hostname: 'radarplay.example'}, console: {warn: text => warnings.push(text)}});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/accounts.js'), 'utf8'), sandbox);
    return {sandbox, warnings};
}

test('App Check usa Enterprise con renovación, antes de acceder a Auth y Firestore', async () => {
    const {sandbox} = context();
    const app = {};
    let options, url;
    const initialized = {};
    const result = await sandbox.configureAccountAppCheck(app, key, 'https://www.gstatic.com/firebasejs/12.4.0/', async value => {
        url = value;
        return {ReCaptchaEnterpriseProvider: class {constructor(value) {this.siteKey = value;}}, initializeAppCheck(firebase, config) {assert.equal(firebase, app); options = config; return initialized;}};
    });
    assert.equal(result, initialized);
    assert.equal(options.provider.siteKey, key);
    assert.equal(options.isTokenAutoRefreshEnabled, true);
    assert.equal(url, 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js');
});

test('Las cuentas inicializan App Check antes de usar Auth y Firestore', async () => {
    const {sandbox} = context();
    const events = [];
    sandbox.requestJSON = async () => ({apiKey: 'public', projectId: 'project', authDomain: 'project.firebaseapp.com', appCheckSiteKey: key});
    await sandbox.initAccounts(async url => {
        if (url.endsWith('/firebase-app.js')) return {initializeApp(config) {assert.equal(config.appCheckSiteKey, undefined); events.push('app'); return {};}};
        if (url.endsWith('/firebase-auth.js')) return {getAuth() {events.push('auth'); return {};}, onAuthStateChanged() {}};
        if (url.endsWith('/firebase-firestore.js')) return {getFirestore() {events.push('store'); return {};}};
        if (url.endsWith('/firebase-app-check.js')) return {ReCaptchaEnterpriseProvider: class {}, initializeAppCheck() {events.push('check'); return {};}};
        throw Error('Módulo inesperado');
    });
    assert.deepEqual(events, ['app', 'check', 'auth', 'store']);
});

test('Sin clave o en local no carga reCAPTCHA ni habilita automáticamente debug', async () => {
    const {sandbox} = context();
    let calls = 0;
    const load = async () => {calls++; throw Error('No debería cargarse');};
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', '::1']) assert.equal(await sandbox.configureAccountAppCheck({}, key, '', load, hostname), null);
    for (const value of ['', undefined, 'invalid', '<script>']) assert.equal(await sandbox.configureAccountAppCheck({}, value, '', load, 'radarplay.example'), null);
    assert.equal(calls, 0);
    assert.equal(sandbox.window.FIREBASE_APPCHECK_DEBUG_TOKEN, undefined);
});

test('Un fallo de carga conserva el modo observación sin registrar credenciales', async () => {
    const {sandbox, warnings} = context();
    assert.equal(await sandbox.configureAccountAppCheck({}, key, '', async () => {throw Error('secret');}), null);
    assert.equal(warnings.length, 1);
    assert(!warnings[0].includes('secret'));
    assert(!warnings[0].includes(key));
});

test('Depuración requiere permiso explícito en loopback y se fija antes de cargar el SDK', async () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', '::1']) {
        const {sandbox} = context();
        sandbox.localStorage = {getItem: () => '1'};
        let calls = 0;
        const initialized = {};
        const result = await sandbox.configureAccountAppCheck({}, key, '', async () => {
            calls++;
            assert.equal(sandbox.window.FIREBASE_APPCHECK_DEBUG_TOKEN, true);
            return {ReCaptchaEnterpriseProvider: class {}, initializeAppCheck: () => initialized};
        }, hostname);
        assert.equal(result, initialized);
        assert.equal(calls, 1);
    }
});

test('La opción local no activa debug en Render, dominios parecidos ni redes LAN', async () => {
    for (const hostname of ['salesplataforms.onrender.com', 'localhost.evil.example', '192.168.1.2']) {
        const {sandbox} = context();
        sandbox.localStorage = {getItem() {throw Error('No debe consultar la opción local');}};
        let calls = 0;
        await sandbox.configureAccountAppCheck({}, key, '', async () => {
            calls++;
            assert.equal(sandbox.window.FIREBASE_APPCHECK_DEBUG_TOKEN, undefined);
            return {ReCaptchaEnterpriseProvider: class {}, initializeAppCheck: () => ({})};
        }, hostname);
        assert.equal(calls, 1);
    }
});

test('La configuración solo publica la clave de sitio válida y CSP admite reCAPTCHA sin scripts inline', () => {
    assert.equal(publicFirebaseConfig({FIREBASE_APPCHECK_SITE_KEY: key, FIREBASE_APPCHECK_DEBUG_TOKEN: 'secret'}).appCheckSiteKey, key);
    assert(!JSON.stringify(publicFirebaseConfig({FIREBASE_APPCHECK_DEBUG_TOKEN: 'secret'})).includes('secret'));
    assert.equal(publicFirebaseConfig({FIREBASE_APPCHECK_SITE_KEY: key + '\r\n'}).appCheckSiteKey, '');
    const headers = {};
    securityHeaders({setHeader: (name, value) => {headers[name] = value;}});
    const csp = headers['Content-Security-Policy'];
    for (const directive of ['script-src', 'connect-src', 'frame-src']) assert(csp.split('; ').find(part => part.startsWith(directive + ' ')).includes('https://www.google.com/recaptcha/'));
    assert(!csp.split('; ').find(part => part.startsWith('script-src ')).includes('unsafe-inline'));
    assert(!csp.includes('unsafe-eval'));
});
