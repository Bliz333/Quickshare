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
        emitChange(reason, session) {
            root.dispatchEvent(new CustomEvent('quickshare:sessionchange', {
                detail: { reason, session }
            }));
        },
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
            emitChange = () => {},
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

        let sessionVersion = 0;

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

        function publishChange(reason) {
            emitChange(reason, current());
        }

        function removeLocalSession(reason) {
            sessionVersion += 1;
            storage.removeItem('token');
            storage.removeItem('user');
            publishChange(reason);
        }

        function current() {
            const token = storage.getItem('token') || '';
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
            sessionVersion += 1;
            storage.setItem('token', token);
            storage.setItem('user', JSON.stringify(user));
            publishChange('established');
            return current();
        }

        function captureRefreshedToken(response, expectedToken, expectedVersion) {
            if (sessionVersion !== expectedVersion || (storage.getItem('token') || '') !== expectedToken) {
                return null;
            }
            if (!response?.headers?.get) {
                return expectedToken;
            }
            const renewed = response.headers.get(REFRESH_HEADER);
            if (renewed && renewed !== expectedToken) {
                storage.setItem('token', renewed);
                publishChange('renewed');
                return renewed;
            }
            return expectedToken;
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

        function signOut() {
            const token = storage.getItem('token') || '';
            removeLocalSession('cleared');
            notifyServerLogout(token);
        }

        async function revalidateCookieSession(expectedToken, expectedVersion) {
            if (sessionVersion !== expectedVersion
                || (storage.getItem('token') || '') !== expectedToken) {
                return true;
            }

            try {
                const response = await adapter.request({
                    input: `${apiBase}/profile`,
                    init: { credentials: 'same-origin' },
                    owned: true,
                    token: ''
                });
                const result = await response.json();

                if (sessionVersion !== expectedVersion
                    || (storage.getItem('token') || '') !== expectedToken) {
                    return true;
                }

                if (response.ok && Number(result?.code) === 200 && result.data?.username) {
                    const renewed = response.headers?.get?.(REFRESH_HEADER) || expectedToken;
                    signIn({ ...result.data, token: renewed });
                    return true;
                }
            } catch (error) {
                // A failed cookie probe is equivalent to an unauthorized session.
            }

            if (sessionVersion !== expectedVersion
                || (storage.getItem('token') || '') !== expectedToken) {
                return true;
            }
            if (expectedToken || storage.getItem('user')) {
                removeLocalSession('expired');
            }
            return false;
        }

        function createUnauthorizedHandler(owned, expectedToken, expectedVersion) {
            let pending = null;
            return async function handleUnauthorized() {
                if (!owned || expectedToken === null || sessionVersion !== expectedVersion) {
                    return false;
                }
                if (!expectedToken && !storage.getItem('user')) {
                    return false;
                }
                if (!pending) {
                    pending = revalidateCookieSession(expectedToken, expectedVersion);
                }
                return pending;
            };
        }

        async function reconcilePayload(result, onUnauthorized) {
            if (Number(result?.code) === 401) {
                await onUnauthorized();
            }
        }

        function monitorResponse(response, onUnauthorized, sessionEnvelope) {
            return new Proxy(response, {
                get(target, property) {
                    if (property === 'json') {
                        return async function parseMonitoredJson() {
                            const result = await target.json();
                            if (sessionEnvelope) {
                                await reconcilePayload(result, onUnauthorized);
                            }
                            return result;
                        };
                    }
                    if (property === 'text') {
                        return async function parseMonitoredText() {
                            const text = await target.text();
                            if (sessionEnvelope) {
                                try {
                                    await reconcilePayload(text ? JSON.parse(text) : null, onUnauthorized);
                                } catch (error) {
                                    // Non-JSON response bodies have no session envelope.
                                }
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
            const { sessionEnvelope = true, ...transportInit } = init;
            const session = current();
            const requestVersion = sessionVersion;
            const owned = isOwnedRequest(input);
            const response = await adapter.request({
                input,
                init: transportInit,
                owned,
                token: owned ? session.token : ''
            });

            let responseSessionToken = session.token;
            if (owned) {
                responseSessionToken = captureRefreshedToken(response, session.token, requestVersion);
            }
            const handleUnauthorized = createUnauthorizedHandler(
                owned,
                responseSessionToken,
                requestVersion
            );
            if (response.status === 401) {
                await handleUnauthorized();
            }
            return monitorResponse(response, handleUnauthorized, sessionEnvelope);
        }

        async function upload(input, init = {}) {
            const session = current();
            const requestVersion = sessionVersion;
            const owned = isOwnedRequest(input);
            const response = await adapter.upload({
                input,
                init,
                owned,
                token: owned ? session.token : ''
            });

            let responseSessionToken = session.token;
            if (owned) {
                responseSessionToken = captureRefreshedToken(response, session.token, requestVersion);
            }
            const handleUnauthorized = createUnauthorizedHandler(
                owned,
                responseSessionToken,
                requestVersion
            );

            if (response.status === 401) {
                await handleUnauthorized();
            }

            const text = await response.text();
            let result = null;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (error) {
                if (!response.ok) {
                    throw new Error(response.statusText || 'Upload failed');
                }
                throw new Error('Invalid upload response');
            }

            if (Number(result?.code) === 401) {
                await handleUnauthorized();
            }
            if (!response.ok) {
                throw new Error(result?.message || response.statusText || 'Upload failed');
            }
            return result;
        }

        async function refresh() {
            const session = current();
            if (!session.token) {
                return null;
            }
            const requestVersion = sessionVersion;

            const response = await request(`${apiBase}/profile`);
            const result = await response.json();
            if (response.status === 401 || Number(result?.code) === 401) {
                return null;
            }
            if (!response.ok || Number(result?.code) !== 200 || !result.data) {
                throw new Error(result?.message || 'Failed to load current profile');
            }
            if (sessionVersion !== requestVersion) {
                const latest = current();
                return latest.authenticated ? latest.user : null;
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
