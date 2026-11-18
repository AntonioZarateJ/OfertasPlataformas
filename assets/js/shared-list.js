const sharedPlatforms = {pc:'PC', xbox:'Xbox', ps:'PlayStation', switch:'Nintendo Switch', android:'Android'};
const sharedPlatformIcons = {pc:'fa-solid fa-desktop', xbox:'fa-brands fa-xbox', ps:'fa-brands fa-playstation', switch:'fa-solid fa-gamepad', android:'fa-brands fa-android'};
const sharedLimit = 12;
const sharedHashLimit = 20000;

function shareText(value, limit) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit) : '';
}

function normalizeSharedItems(items) {
    if (!Array.isArray(items) || items.length > sharedLimit) return [];
    return items.flatMap(item => {
        if (!item || !Object.hasOwn(sharedPlatforms, item.platform)) return [];
        const title = shareText(item.title, 120);
        const edition = shareText(item.edition, 80);
        return title ? [{platform:item.platform, title, edition}] : [];
    });
}

function encodeSharedItems(items) {
    const bytes = new TextEncoder().encode(JSON.stringify(items));
    return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
}

function decodeSharedItems(hash) {
    if (!hash.startsWith('#lista=') || hash.length > sharedHashLimit) return [];
    const code = hash.slice(7);
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return [];
    try {
        const bytes = Uint8Array.from(atob(code.replaceAll('-','+').replaceAll('_','/')), char => char.charCodeAt(0));
        return normalizeSharedItems(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)));
    } catch {
        return [];
    }
}

const sharedList = document.getElementById('sharedItems');
if (sharedList) {
    const renderSharedList = () => {
        const items = decodeSharedItems(location.hash);
        const rows = items.map(item => {
            const row = document.createElement('li');
            row.dataset.newsPlatform = item.platform;
            const icon = document.createElement('span');
            icon.className = 'news-service-icon';
            icon.setAttribute('aria-hidden','true');
            const platformIcon = document.createElement('i');
            platformIcon.className = sharedPlatformIcons[item.platform];
            icon.append(platformIcon);
            const text = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = item.title;
            const scope = document.createElement('p');
            scope.textContent = [sharedPlatforms[item.platform], item.edition].filter(Boolean).join(' · ');
            const link = document.createElement('a');
            link.className = 'news-cta';
            link.href = '/?' + new URLSearchParams({buscar:item.title, plataforma:item.platform});
            link.textContent = 'Buscar en RadarPlay';
            text.append(title, scope, link);
            row.append(icon, text);
            return row;
        });
        sharedList.replaceChildren(...rows);
        document.getElementById('sharedStatus').textContent = items.length ? 'Lista guardada al momento de compartir. Busca cada juego para consultar precios actuales.' :
            'El enlace está vacío o incompleto. Pide a quien lo compartió que lo copie de nuevo.';
    };
    renderSharedList();
    window.addEventListener('hashchange', renderSharedList);
}

const wishShareButton = document.getElementById('wishShareButton');
const wishShareLink = document.getElementById('wishShareLink');
const wishShareStatus = document.getElementById('wishShareStatus');
let shareableItems = [];
let sharedKey = '';
let shareEpoch = -1;

function updateWishShare(items) {
    const included = normalizeSharedItems(items.slice(0,sharedLimit).map(item => ({
        title:item.title, platform:item.native ? item.platform : 'pc', edition:item.edition
    })));
    const key = JSON.stringify(included);
    if (sharedKey !== key || shareEpoch !== accountEpoch) {
        wishShareLink.hidden = true;
        wishShareLink.value = '';
        shareEpoch = accountEpoch;
    }
    sharedKey = key;
    shareableItems = included;
    wishShareButton.disabled = included.length === 0 || items.length > sharedLimit;
    if (wishShareLink.hidden) {
        wishShareStatus.textContent = items.length > sharedLimit ? 'Deja hasta 12 juegos marcados para compartir la lista.' : '';
    }
}

if (wishShareButton) {
    wishShareButton.addEventListener('click', async () => {
        const link = new URL('/lista-compartida', location.origin);
        link.hash = 'lista=' + encodeSharedItems(shareableItems);
        wishShareLink.value = link.href;
        wishShareLink.hidden = false;
        wishShareLink.focus();
        wishShareLink.select();
        wishShareStatus.textContent = 'Copia el enlace seleccionado y compártelo con quien quieras.';
        try {
            await navigator.clipboard.writeText(link.href);
            if (wishShareLink.value === link.href) wishShareStatus.textContent = 'Enlace copiado.';
        } catch { /* El campo seleccionado sigue disponible. */ }
    });
}
