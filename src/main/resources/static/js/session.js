/**
 * Browser session and authenticated transport.
 */
(function initializeBrowserSession(root, buildModule) {
    const sessionModule = buildModule();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sessionModule;
    }

    if (!root) {
        return;
    }

    const adapter = sessionModule.createHttpAdapter({
        fetchImpl: root.fetch.bind(root),
        HeadersCtor: root.Headers,
        RequestCtor: root.Request,
        XMLHttpRequestCtor: root.XMLHttpRequest
    });

    root.BrowserSession = sessionModule.createBrowserSession({
        adapter,
        apiBase: typeof API_BASE === 'string' ? API_BASE : '/api',
        applicationOrigin: root.location.origin,
        decodeBase64: root.atob.bind(root),
        emitChange(reason, session) {
            root.dispatchEvent(new CustomEvent('quickshare:sessionchange', {
                detail: { reason, session }
            }));
        },
        now: () => Date.now(),
        pageUrl: () => root.location.href,
        storage: root.localStorage
    });
})(typeof window !== 'undefined' ? window : null, function buildBrowserSessionModule() {
    const REFRESH_HEADER = 'X-Auth-Refresh';

    function createBrowserSession(options) {
        const {
            adapter,
            apiBase,
            applicationOrigin,
            decodeBase64,
            emitChange = () => {},
            now = () => Date.now(),
            pageUrl,
            storage
        } = options || {};

        if (!adapter || typeof adapter.request !== 'function' || typeof adapter.upload !== 'function') {
            throw new TypeError('BrowserSession requires request and upload adapters');
        }
        if (!storage || typeof storage.getItem !== 'function'
            || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
            throw new TypeError('BrowserSession requires a storage adapter');
        }

        const emptySession = () => ({
            token: '',
            user: {},
            authenticated: false,
            isAdmin: false
        });

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
                return normalizeUser(JSON.parse(storage.getItem('user') || '{}'));
            } catch (error) {
                return {};
            }
        }

        function isExpiredJwt(token) {
            const parts = String(token || '').split('.');
            if (parts.length !== 3 || typeof decodeBase64 !== 'function') {
                return false;
            }
            try {
                const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
                const payload = JSON.parse(decodeBase64(padded));
                return Number.isFinite(Number(payload.exp)) && Number(payload.exp) * 1000 <= now();
            } catch (error) {
                return false;
            }
        }

        function publishChange(reason) {
            emitChange(reason, current());
        }

        function removeLocalSession(reason) {
            storage.removeItem('token');
            storage.removeItem('user');
            publishChange(reason);
        }

        function current() {
            const token = storage.getItem('token') || '';
            if (token && isExpiredJwt(token)) {
                expire('expired');
                return emptySession();
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

        function signIn(data) {
            const next = data && typeof data === 'object' ? data : {};
            const token = String(next.token || current().token || '').trim();
            if (!token) {
                throw new Error('Authenticated session requires a token');
            }

            const user = normalizeUser(next);
            storage.setItem('token', token);
            storage.setItem('user', JSON.stringify(user));
            publishChange('established');
            return current();
        }

        function captureRefreshedToken(response) {
            if (!response?.headers?.get) {
                return;
            }
            const renewed = response.headers.get(REFRESH_HEADER);
            if (renewed && renewed !== storage.getItem('token')) {
                storage.setItem('token', renewed);
                publishChange('renewed');
            }
        }

        function requestOrigin(input) {
            try {
                const value = typeof input === 'string' || input instanceof URL ? input : input.url;
                return new URL(value, pageUrl()).origin;
            } catch (error) {
                return null;
            }
        }

        function isOwnedRequest(input) {
            const origin = requestOrigin(input);
            const apiOrigin = requestOrigin(apiBase);
            return Boolean(origin && (origin === applicationOrigin || origin === apiOrigin));
        }

        function notifyServerLogout(token) {
            try {
                adapter.request({
                    input: `${apiBase}/auth/logout`,
                    init: {
                        method: 'POST',
                        credentials: 'same-origin',
                        keepalive: true
                    },
                    owned: true,
                    token
                }).catch(() => {});
            } catch (error) {
                // Local cleanup must succeed even when logout transport fails.
            }
        }

        function expire(reason) {
            const token = storage.getItem('token') || '';
            if (token || storage.getItem('user')) {
                removeLocalSession(reason || 'expired');
            }
            notifyServerLogout(token);
        }

        function signOut() {
            const token = storage.getItem('token') || '';
            removeLocalSession('cleared');
            notifyServerLogout(token);
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
            const session = current();
            const owned = isOwnedRequest(input);
            const response = await adapter.request({
                input,
                init,
                owned,
                token: owned ? session.token : ''
            });

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

        async function upload(input, init = {}) {
            const session = current();
            const owned = isOwnedRequest(input);
            const response = await adapter.upload({
                input,
                init,
                owned,
                token: owned ? session.token : ''
            });

            if (owned) {
                captureRefreshedToken(response);
            }

            const text = await response.text();
            let result = null;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (error) {
                throw new Error('Invalid upload response');
            }

            if (owned && (response.status === 401 || Number(result?.code) === 401)) {
                expire('expired');
            }
            if (!response.ok) {
                throw new Error(result?.message || response.statusText || 'Upload failed');
            }
            return result;
        }

        async function refresh() {
            if (!current().token) {
                return null;
            }

            const response = await request(`${apiBase}/profile`);
            const result = await response.json();
            if (response.status === 401 || Number(result?.code) === 401) {
                return null;
            }
            if (!response.ok || Number(result?.code) !== 200 || !result.data) {
                throw new Error(result?.message || 'Failed to load current profile');
            }
            return signIn({ ...result.data, token: current().token }).user;
        }

        return Object.freeze({
            current,
            refresh,
            request,
            signIn,
            signOut,
            upload
        });
    }

    function createHttpAdapter({ fetchImpl, HeadersCtor, RequestCtor, XMLHttpRequestCtor }) {
        if (typeof fetchImpl !== 'function' || typeof HeadersCtor !== 'function'
            || typeof XMLHttpRequestCtor !== 'function') {
            throw new TypeError('HTTP adapter requires fetch, Headers, and XMLHttpRequest');
        }

        function headersFor(input, initHeaders) {
            const requestHeaders = RequestCtor && input instanceof RequestCtor ? input.headers : undefined;
            return new HeadersCtor(initHeaders || requestHeaders);
        }

        function authenticatedHeaders(input, initHeaders, token, owned) {
            const headers = headersFor(input, initHeaders);
            if (token && owned && !headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            return headers;
        }

        function request({ input, init = {}, token, owned }) {
            const headers = authenticatedHeaders(input, init.headers, token, owned);
            return fetchImpl(input, { ...init, headers });
        }

        function upload({ input, init = {}, token, owned }) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequestCtor();
                const headers = authenticatedHeaders(input, init.headers, token, owned);
                let settled = false;

                const cleanup = () => {
                    if (init.signal) {
                        init.signal.removeEventListener('abort', abort);
                    }
                };
                const rejectOnce = (error) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(error);
                };
                const resolveOnce = (value) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(value);
                };
                const abort = () => xhr.abort();

                xhr.open(init.method || 'POST', input);
                headers.forEach((value, name) => xhr.setRequestHeader(name, value));

                if (typeof init.onProgress === 'function') {
                    xhr.upload.onprogress = (event) => init.onProgress({
                        lengthComputable: event.lengthComputable,
                        loaded: event.loaded,
                        total: event.total
                    });
                }

                xhr.onload = () => resolveOnce({
                    headers: {
                        get(name) {
                            return xhr.getResponseHeader(name);
                        }
                    },
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    text: async () => xhr.responseText || ''
                });
                xhr.onerror = () => rejectOnce(new Error('Network request failed'));
                xhr.onabort = () => {
                    const error = new Error('AbortError');
                    error.name = 'AbortError';
                    rejectOnce(error);
                };

                if (init.signal) {
                    if (init.signal.aborted) {
                        const error = new Error('AbortError');
                        error.name = 'AbortError';
                        rejectOnce(error);
                        return;
                    }
                    init.signal.addEventListener('abort', abort, { once: true });
                }

                try {
                    xhr.send(init.body);
                } catch (error) {
                    rejectOnce(error);
                }
            });
        }

        return Object.freeze({ request, upload });
    }

    return { createBrowserSession, createHttpAdapter };
});
