/**
 * config.js - 全局配置
 */

// API 基础地址
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api'
    : `${window.location.protocol}//${window.location.host}/api`;

const QUICKSHARE_PAGE_ROUTES = {
    'index.html': '/',
    'login.html': '/login',
    'register.html': '/register',
    'share.html': '/share',
    'netdisk.html': '/drive',
    'drive.html': '/drive',
    'pricing.html': '/pricing',
    'payment-result.html': '/payment-result',
    'pdf-viewer.html': '/pdf-viewer',
    'transfer.html': '/',
    'quickdrop.html': '/',
    'transfer-share.html': '/share',
    'quickdrop-share.html': '/share'
};

const QUICKSHARE_ROUTE_FILES = {
    '/': 'index.html',
    '/index': 'index.html',
    '/home': 'index.html',
    '/login': 'login.html',
    '/register': 'register.html',
    '/share': 'share.html',
    '/drive': 'netdisk.html',
    '/netdisk': 'netdisk.html',
    '/pricing': 'pricing.html',
    '/payment-result': 'payment-result.html',
    '/pdf-viewer': 'pdf-viewer.html'
};

function canonicalPageFile(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '/') {
        return 'index.html';
    }

    let path = raw;
    try {
        path = new URL(raw, window.location.origin).pathname;
    } catch (error) {
        path = raw.split('?')[0].split('#')[0];
    }

    if (QUICKSHARE_ROUTE_FILES[path]) {
        return QUICKSHARE_ROUTE_FILES[path];
    }

    const segment = (path.split('/').pop() || '').toLowerCase();
    if (!segment) {
        return 'index.html';
    }

    if (QUICKSHARE_PAGE_ROUTES[segment]) {
        if (segment === 'drive.html') {
            return 'netdisk.html';
        }
        return segment;
    }

    const file = segment.endsWith('.html') ? segment : `${segment}.html`;
    return file === 'drive.html' ? 'netdisk.html' : file;
}

function cleanPagePath(value) {
    return QUICKSHARE_PAGE_ROUTES[canonicalPageFile(value)] || '/';
}

function cleanPageUrl(value, search = '', hash = '') {
    let parsedSearch = '';
    let parsedHash = '';
    try {
        const parsed = new URL(String(value || ''), window.location.origin);
        parsedSearch = parsed.search;
        parsedHash = parsed.hash;
    } catch (error) {
        const raw = String(value || '');
        const queryIndex = raw.indexOf('?');
        const hashIndex = raw.indexOf('#');
        if (queryIndex >= 0) {
            const end = hashIndex >= 0 ? hashIndex : raw.length;
            parsedSearch = raw.slice(queryIndex, end);
        }
        if (hashIndex >= 0) {
            parsedHash = raw.slice(hashIndex);
        }
    }
    const querySource = search || parsedSearch;
    const hashSource = hash || parsedHash;
    const query = querySource && !String(querySource).startsWith('?') ? `?${querySource}` : String(querySource || '');
    const fragment = hashSource && !String(hashSource).startsWith('#') ? `#${hashSource}` : String(hashSource || '');
    return `${cleanPagePath(value)}${query}${fragment}`;
}

function absolutePageUrl(value, search = '', hash = '') {
    return new URL(cleanPageUrl(value, search, hash), window.location.origin).href;
}

function rewriteInternalLinks(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') {
        return;
    }

    root.querySelectorAll('a[href]').forEach((link) => {
        if (link.dataset.noCleanUrl === 'true') {
            return;
        }
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }

        try {
            const parsed = new URL(href, window.location.href);
            if (parsed.origin !== window.location.origin) {
                return;
            }
            const file = canonicalPageFile(parsed.pathname);
            if (!QUICKSHARE_PAGE_ROUTES[file]) {
                return;
            }
            link.setAttribute('href', cleanPageUrl(file, parsed.search, parsed.hash));
        } catch (error) {
            // Ignore malformed hrefs; browser navigation remains the fallback.
        }
    });
}

// 导出配置（如果需要模块化）
window.AppConfig = {
    API_BASE
};

window.QuickShareRoutes = {
    canonicalPageFile,
    cleanPagePath,
    cleanPageUrl,
    absolutePageUrl,
    rewriteInternalLinks
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => rewriteInternalLinks(document));
} else {
    rewriteInternalLinks(document);
}
