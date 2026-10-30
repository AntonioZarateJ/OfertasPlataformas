let accountSDK;
let accountMode = 'login';
let accountWriteQueue = Promise.resolve();
let accountEpoch = 0;
window.currentAccount = null;
const PROFILE_AVATARS = ['orbit', 'nova', 'pixel', 'comet', 'quest', 'arcade'];
let selectedProfileAvatar = 'orbit';
function profileAvatarKey(user) {
    try {
        const url = new URL(user?.photoURL || '', location.origin);
        return PROFILE_AVATARS.find(key => url.pathname === '/assets/avatars/' + key + '.svg') || 'orbit';
    } catch { return 'orbit'; }
}
function renderProfileAvatars() {
    const container = document.getElementById('profileAvatarOptions');
    container.replaceChildren();
    for (const key of PROFILE_AVATARS) {
        const button = document.createElement('button');
        button.type = 'button'; button.setAttribute('aria-label', 'Avatar ' + key);
        button.setAttribute('aria-pressed', String(key === selectedProfileAvatar));
        const img = document.createElement('img'); img.src = 'assets/avatars/' + key + '.svg'; img.alt = ''; img.width = 44; img.height = 44;
        button.append(img);
        button.addEventListener('click', () => {
            selectedProfileAvatar = key;
            document.getElementById('profileAvatar').src = img.src;
            renderProfileAvatars();
        });
        container.append(button);
    }
}
function profileFeedback(message) { document.getElementById('profileMessage').textContent = message; }
async function refreshAccountVerification() {
    const user = window.currentAccount;
    if (!user || !accountSDK) return;
    try {
        await accountSDK.auth.reload(user);
        if (window.currentAccount?.uid !== user.uid) return;
        await user.getIdToken(true);
        renderAccountVerification(user);
    } catch { if (window.currentAccount?.uid === user.uid) profileFeedback('No pudimos actualizar el estado del correo. Inténtalo de nuevo.'); }
}
function renderAccountVerification(user) {
    document.getElementById('accountVerification').textContent = user.emailVerified ? '✓ Correo verificado' : 'Correo pendiente de verificar';
    document.getElementById('accountVerification').classList.toggle('verified', user.emailVerified);
    document.getElementById('verifyAccountButton').classList.toggle('hidden-el', user.emailVerified);
    document.getElementById('refreshVerificationButton').classList.toggle('hidden-el', user.emailVerified);
}
async function saveAccountProfile(event) {
    event.preventDefault();
    const user = window.currentAccount;
    if (!user || !accountSDK) return;
    const displayName = document.getElementById('profileName').value.trim();
    if (!displayName || displayName.length > 60) { profileFeedback('Escribe un nombre de entre 1 y 60 caracteres.'); return; }
    const button = document.getElementById('profileSaveButton'); button.disabled = true;
    profileFeedback('Guardando tu perfil…');
    try {
        const key = PROFILE_AVATARS.includes(selectedProfileAvatar) ? selectedProfileAvatar : 'orbit';
        await accountSDK.auth.updateProfile(user, { displayName, photoURL: new URL('assets/avatars/' + key + '.svg', location.href).href });
        if (window.currentAccount?.uid !== user.uid) return;
        renderAccount(); profileFeedback('Tu perfil está actualizado.');
    } catch { if (window.currentAccount?.uid === user.uid) profileFeedback('No pudimos guardar el perfil. Inténtalo de nuevo.'); }
    finally { button.disabled = false; }
}
async function resetAccountPassword() {
    const user = window.currentAccount;
    if (!user?.email || !accountSDK) return;
    const button = document.getElementById('accountPasswordButton'); button.disabled = true;
    try {
        await accountSDK.auth.sendPasswordResetEmail(accountSDK.session, user.email);
        if (window.currentAccount?.uid === user.uid) profileFeedback('Te enviamos un enlace para cambiar la contraseña. Revisa también spam.');
    } catch { if (window.currentAccount?.uid === user.uid) profileFeedback('No pudimos enviar el enlace. Espera un momento e inténtalo de nuevo.'); }
    finally { button.disabled = false; }
}
function setAuthMode(mode) {
    accountMode = mode;
    document.getElementById('authTitle').textContent = mode === 'register' ? 'Tu próxima gran oferta' : mode === 'reset' ? 'Recupera tu acceso' : 'Bienvenido de nuevo';
    document.getElementById('authNameLabel').classList.toggle('hidden-el', mode !== 'register');
    document.getElementById('authPasswordLabel').classList.toggle('hidden-el', mode === 'reset');
    document.getElementById('authPassword').required = mode !== 'reset';
    document.getElementById('authPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    document.getElementById('authSubmit').textContent = mode === 'register' ? 'Crear mi cuenta →' : mode === 'reset' ? 'Enviar enlace de recuperación' : 'Entrar a mi cuenta →';
    document.getElementById('authMessage').textContent = '';
    document.getElementById('loginTab').classList.toggle('selected', mode === 'login');
    document.getElementById('registerTab').classList.toggle('selected', mode === 'register');
}
function toggleAccountPassword() { const input = document.getElementById('authPassword'); input.type = input.type === 'password' ? 'text' : 'password'; }
function renderAccount() {
    const user = window.currentAccount;
    document.getElementById('authForm').classList.toggle('hidden-el', !!user);
    document.getElementById('authTabs').classList.toggle('hidden-el', !!user);
    document.getElementById('accountPanel').classList.toggle('hidden-el', !user);
    document.querySelector('.auth-card').classList.toggle('has-profile', !!user);
    document.querySelector('.auth-subtitle').textContent = user ? 'Tu espacio de jugador. Personaliza tu perfil y prepara tu próxima aventura.' : 'Guarda tus favoritos y encuentra el momento de comprar.';
    document.querySelector('.auth-footnote').textContent = user ? 'Tus favoritos y metas se guardan en tu cuenta. Los avisos por correo están en preparación.' : 'Tus favoritos de invitado se guardan en este navegador.';
    profileFeedback('');
    if (user) {
        document.getElementById('authTitle').textContent = user.displayName || 'Mi cuenta';
        document.getElementById('accountEmail').textContent = user.email;
        renderAccountVerification(user);
        document.getElementById('profileName').value = user.displayName || '';
        selectedProfileAvatar = profileAvatarKey(user);
        document.getElementById('profileAvatar').src = 'assets/avatars/' + selectedProfileAvatar + '.svg';
        renderProfileAvatars();
        const list = Object.values(userWishlist);
        document.getElementById('profileSavedCount').textContent = list.length;
        document.getElementById('profileGoalsCount').textContent = list.filter(item => item.targetPriceUsd || item.targetPrice).length;
    } else setAuthMode('login');
    refreshCloudProfileHeader();
}
async function initAccounts() {
    const config = await requestJSON('/api/auth-config', { ttl: 0 });
    if (!config.apiKey || !config.projectId || !config.authDomain) return null;
    const base = 'https://www.gstatic.com/firebasejs/12.4.0/';
    const [app, auth, store] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
    const firebase = app.initializeApp(config);
    const session = auth.getAuth(firebase);
    session.languageCode = 'es';
    const db = store.getFirestore(firebase);
    accountSDK = { auth, store, session, db };
    auth.onAuthStateChanged(session, async user => {
        const epoch = ++accountEpoch;
        window.currentAccount = user;
        window.accountStorageKey = user ? 'steampulse_user_' + user.uid : WISHLIST_STORAGE_KEY;
        try { userWishlist = normalizeWishlist(JSON.parse(localStorage.getItem(window.accountStorageKey) || '{}')); } catch { userWishlist = Object.create(null); }
        renderAccount();
        if (user) {
            try {
                const saved = await store.getDoc(store.doc(db, 'users', user.uid, 'data', 'wishlist'));
                if (epoch !== accountEpoch) return;
                if (saved.exists()) userWishlist = normalizeWishlist(saved.data().items);
            } catch { showToast('No se pudo cargar tu wishlist en la nube.'); }
        }
        if (epoch !== accountEpoch) return;
        persistWishlistState({ sync: false });
        refreshWishlistHeartButtonsOnGrid();
        renderWishlistDrawerItems();
        if (activeChip === 'wishlist') renderWishlistChipMode();
    });
    return accountSDK;
}
const accountReady = new Promise(resolve => window.addEventListener('DOMContentLoaded', () => resolve(initAccounts().catch(() => null)), { once: true }));
async function submitAccount(event) {
    event.preventDefault();
    const button = document.getElementById('authSubmit');
    button.disabled = true;
    const message = document.getElementById('authMessage');
    message.textContent = 'Un momento…';
    try {
        const sdk = await accountReady;
        if (!sdk) { message.textContent = 'El acceso de cuentas estará disponible pronto. Puedes seguir usando tus favoritos en este dispositivo.'; return; }
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        if (accountMode === 'reset') {
            await sdk.auth.sendPasswordResetEmail(sdk.session, email);
            message.textContent = 'Si existe una cuenta con este correo, recibirás las instrucciones.';
        } else if (accountMode === 'register') {
            const credential = await sdk.auth.createUserWithEmailAndPassword(sdk.session, email, password);
            await sdk.auth.updateProfile(credential.user, { displayName: document.getElementById('authName').value.trim() });
            await sdk.auth.sendEmailVerification(credential.user);
            renderAccount();
        } else { await sdk.auth.signInWithEmailAndPassword(sdk.session, email, password); }
    } catch (error) {
        message.textContent = error.code === 'auth/weak-password' ? 'Elige una contraseña más segura.' : error.code === 'auth/too-many-requests' ? 'Demasiados intentos. Inténtalo más tarde.' : 'No se pudo completar el acceso. Revisa tus datos e inténtalo de nuevo.';
    } finally { document.getElementById('authPassword').value = ''; button.disabled = false; }
}
async function logoutAccount() { if (accountSDK) await accountSDK.auth.signOut(accountSDK.session); }
async function sendAccountVerification() {
    try {
        await refreshAccountVerification();
        if (accountSDK && window.currentAccount && !window.currentAccount.emailVerified) {
            const button = document.getElementById('verifyAccountButton'); button.disabled = true;
            try { await accountSDK.auth.sendEmailVerification(window.currentAccount); profileFeedback('Revisa tu correo para verificar tu cuenta.'); }
            finally { button.disabled = false; }
        }
    }
    catch { showToast('No se pudo enviar el correo. Inténtalo más tarde.'); }
}
window.accountSync = () => {
    const user = window.currentAccount;
    if (!user || !accountSDK) return Promise.resolve(true);
    const items = structuredClone(userWishlist);
    const { store, db } = accountSDK;
    accountWriteQueue = accountWriteQueue.catch(() => {}).then(() => store.setDoc(store.doc(db, 'users', user.uid, 'data', 'wishlist'), { items, updatedAt: store.serverTimestamp() })).then(() => true).catch(() => { showToast('No se pudo sincronizar. Tus favoritos siguen guardados en este dispositivo.'); return false; });
    return accountWriteQueue;
};
window.addEventListener('focus', () => {
    if (!document.getElementById('cloudConfigModal').classList.contains('hidden-el')) void refreshAccountVerification();
});
