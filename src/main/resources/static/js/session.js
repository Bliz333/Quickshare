/**
 * Browser session and authenticated transport.
 */
const BrowserSession = (() => {
    const REFRESH_HEADER = 'X-Auth-Refresh';
    const nativeFetch = window.fetch.bind(window);

    function normalizeRole(role) {
        return typeof role === 'string' && role.trim()
            ? role.trim().toUpperCase()
            : 'USER';
    }

    function normalizeUser(user) {
        if (!user || typeof user !== 'object') {
            return {};
        }
        const { token: _token, ...profile } = user;
        if (Object.keys(profile).length === 0) {
            return {};
        }
        return {
            ...profile,
            role: normalizeRole(profile.role)
        };
    }

    function readUser() {
        try {
            return normalizeUser(JSON.parse(localStorage.getItem('user') || '{}'));
        } catch (error) {
            return {};
        }
    }

    function isExpiredJwt(token) {
        const parts = String(token || '').split('.');
        if (parts.length !== 3) {
            return false;
        }
        try {
            const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
            const payload = JSON.parse(atob(padded));
            return Number.isFinite(Number(payload.exp)) && Number(payload.exp) * 1000 <= Date.now();
        } catch (error) {
            return false;
        }
    }

    function emitChange(reason) {
        window.dispatchEvent(new CustomEvent('quickshare:sessionchange', {
            detail: { reason, session: current() }
        }));
    }

    function removeLocalSession(reason) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        emitChange(reason);
    }

    function current() {
        const token = localStorage.getItem('token') || '';
        if (token && isExpiredJwt(token)) {
            removeLocalSession('expired');
            notifyServerLogout(token);
            return { token: '', user: {}, authenticated: false, isAdmin: false };
        }

        const user = readUser();
        const authenticated = Boolean(token && user.username);
        return {
            token,
            user,
            authenticated,
            isAdmin: authenticated && normalizeRole(user.role) === 'ADMIN'
        };
    }

    function establish(data) {
        const next = data && typeof data === 'object' ? data : {};
        const token = String(next.token || current().token || '').trim();
        if (!token) {
            throw new Error('Authenticated session requires a token');
        }

        const user = normalizeUser(next);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        emitChange('established');
        return current();
    }

    function captureRefreshedToken(response) {
        if (!response?.headers?.get) {
            return;
        }
        const renewed = response.headers.get(REFRESH_HEADER);
        if (renewed && renewed !== localStorage.getItem('token')) {
            localStorage.setItem('token', renewed);
            emitChange('renewed');
        }
    }

    function installFetchRenewalCapture() {
        if (window.__quickshareFetchRenewalCaptureInstalled) {
            return;
        }
        window.fetch = function monitoredFetch(input, init) {
            return nativeFetch(input, init).then((response) => {
                if (isOwnedRequest(input)) {
                    captureRefreshedToken(response);
                }
                return response;
            });
        };
        window.__quickshareFetchRenewalCaptureInstalled = true;
    }

    function captureRefreshedXhrToken(xhr) {
        if (typeof xhr?.getResponseHeader !== 'function') {
            return;
        }
        const renewed = xhr.getResponseHeader(REFRESH_HEADER);
        if (renewed && renewed !== localStorage.getItem('token')) {
            localStorage.setItem('token', renewed);
            emitChange('renewed');
        }
    }

    function notifyServerLogout(token) {
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            nativeFetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers
            }).catch(() => {});
        } catch (error) {
            // Local cleanup must succeed even when logout transport fails.
        }
    }

    function expire(reason) {
        const token = localStorage.getItem('token') || '';
        if (token || localStorage.getItem('user')) {
            removeLocalSession(reason || 'expired');
        }
        notifyServerLogout(token);
    }

    function clear() {
        const token = localStorage.getItem('token') || '';
        removeLocalSession('cleared');
        notifyServerLogout(token);
    }

    function requestOrigin(input) {
        try {
            const value = typeof input === 'string' || input instanceof URL ? input : input.url;
            return new URL(value, window.location.href).origin;
        } catch (error) {
            return null;
        }
    }

    function isOwnedRequest(input) {
        const origin = requestOrigin(input);
        const apiOrigin = requestOrigin(API_BASE);
        return Boolean(origin && (origin === window.location.origin || origin === apiOrigin));
    }

    function reconcilePayload(result, onUnauthorized) {
        if (Number(result?.code) === 401) {
            onUnauthorized();
        }
    }

    function monitorResponse(response, onUnauthorized) {
        return new Proxy(response, {
            get(target, property) {
                if (property === 'json') {
                    return async function parseMonitoredJson() {
                        const result = await target.json();
                        reconcilePayload(result, onUnauthorized);
                        return result;
                    };
                }
                if (property === 'text') {
                    return async function parseMonitoredText() {
                        const text = await target.text();
                        try {
                            reconcilePayload(text ? JSON.parse(text) : null, onUnauthorized);
                        } catch (error) {
                            // Non-JSON response bodies have no session envelope.
                        }
                        return text;
                    };
                }
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
    }

    async function request(input, init = {}) {
        const headers = new Headers(
            init.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
        );
        const session = current();
        const owned = isOwnedRequest(input);
        if (session.token && owned && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${session.token}`);
        }

        const response = await nativeFetch(input, { ...init, headers });
        if (owned) {
            captureRefreshedToken(response);
        }
        let unauthorizedHandled = false;
        const handleUnauthorized = () => {
            if (!owned || unauthorizedHandled) {
                return;
            }
            unauthorizedHandled = true;
            expire('expired');
        };
        if (response.status === 401) {
            handleUnauthorized();
        }
        return monitorResponse(response, handleUnauthorized);
    }

    function prepareXhr(xhr, url) {
        if (!xhr || typeof xhr.setRequestHeader !== 'function') {
            throw new TypeError('prepareXhr requires an opened XMLHttpRequest');
        }

        const session = current();
        const owned = isOwnedRequest(url);
        if (session.token && owned) {
            xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
        }
        xhr.addEventListener('load', () => {
            if (owned) {
                captureRefreshedXhrToken(xhr);
            }
            let result = null;
            try {
                result = xhr.responseType === '' || xhr.responseType === 'text'
                    ? JSON.parse(xhr.responseText || 'null')
                    : xhr.response;
            } catch (error) {
                result = null;
            }
            if (xhr.status === 401 || Number(result?.code) === 401) {
                expire('expired');
            }
        }, { once: true });
        return xhr;
    }

    async function refresh() {
        if (!current().token) {
            return null;
        }

        const response = await request(`${API_BASE}/profile`);
        const result = await response.json();
        if (response.status === 401 || Number(result?.code) === 401) {
            return null;
        }
        if (!response.ok || Number(result?.code) !== 200 || !result.data) {
            throw new Error(result?.message || 'Failed to load current profile');
        }
        return establish({ ...result.data, token: current().token }).user;
    }

    installFetchRenewalCapture();

    return {
        clear,
        current,
        establish,
        prepareXhr,
        refresh,
        request
    };
})();

window.BrowserSession = BrowserSession;
