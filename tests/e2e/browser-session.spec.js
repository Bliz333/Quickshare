const { test, expect } = require('@playwright/test');
const {
  createBrowserSession
} = require('../../src/main/resources/static/js/session.js');

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function jsonResponse(body, { status = 200, refreshedToken = '' } = {}) {
  const text = JSON.stringify(body);
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'x-auth-refresh' ? refreshedToken : null;
      }
    },
    json: async () => JSON.parse(text),
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Request failed',
    text: async () => text
  };
}

function createMemoryAdapter(handler) {
  const calls = [];
  const invoke = async (kind, call) => {
    calls.push({ kind, ...call });
    return handler ? handler(kind, call) : jsonResponse({ code: 200 });
  };
  return {
    calls,
    request(call) {
      return invoke('request', call);
    },
    upload(call) {
      return invoke('upload', call);
    }
  };
}

function createMemorySession(adapter, storage = createMemoryStorage()) {
  return createBrowserSession({
    adapter,
    apiBase: 'https://quickshare.test/api',
    applicationOrigin: 'https://quickshare.test',
    decodeBase64: (value) => Buffer.from(value, 'base64').toString('utf8'),
    pageUrl: () => 'https://quickshare.test/login',
    storage
  });
}

test.describe('BrowserSession with in-memory adapter', () => {
  test('owns normalized state, bearer context, and token renewal', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      expect(kind).toBe('request');
      return jsonResponse({ code: 200 }, { refreshedToken: 'token-renewed' });
    });
    const session = createMemorySession(adapter);

    expect(session.signIn({ token: 'token-initial', username: 'alice', role: 'admin' })).toMatchObject({
      token: 'token-initial',
      authenticated: true,
      isAdmin: true,
      user: { username: 'alice', role: 'ADMIN' }
    });

    await session.request('https://quickshare.test/api/profile');
    expect(session.current().token).toBe('token-renewed');
    expect(adapter.calls[0]).toMatchObject({
      kind: 'request',
      owned: true,
      token: 'token-initial'
    });

    session.signOut();
    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[1]).toMatchObject({
      input: 'https://quickshare.test/api/auth/logout',
      token: 'token-renewed'
    });
  });

  test('keeps third-party outcomes isolated and expires owned unauthorized sessions', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input === 'https://third-party.test/data') {
        return jsonResponse({ code: 401 }, { refreshedToken: 'untrusted-token' });
      }
      if (call.input.endsWith('/auth/logout')) {
        return jsonResponse({ code: 200 });
      }
      return jsonResponse({ code: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'private-token', username: 'alice' });

    const thirdParty = await session.request('https://third-party.test/data');
    await thirdParty.json();
    expect(session.current().token).toBe('private-token');
    expect(adapter.calls[0]).toMatchObject({ owned: false, token: '' });

    const owned = await session.request('https://quickshare.test/api/private');
    await owned.json();
    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[2]).toMatchObject({
      input: 'https://quickshare.test/api/auth/logout',
      token: 'private-token'
    });
  });

  test('does not treat raw same-origin file contents as a session envelope', async () => {
    const adapter = createMemoryAdapter(() => jsonResponse({ code: 401 }));
    const session = createMemorySession(adapter);
    session.signIn({ token: 'private-token', username: 'alice' });

    const response = await session.request('https://quickshare.test/api/files/7/content', {
      sessionEnvelope: false
    });
    expect(await response.text()).toBe('{"code":401}');
    expect(session.current()).toMatchObject({
      authenticated: true,
      token: 'private-token'
    });
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0].init).toEqual({});
  });

  test('ignores stale renewal and unauthorized outcomes after the session changes', async () => {
    let resolveRequest;
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/auth/logout')) {
        return jsonResponse({ code: 200 });
      }
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'token-a', username: 'alice' });

    const pending = session.request('https://quickshare.test/api/private');
    session.signIn({ token: 'token-b', username: 'bob' });
    resolveRequest(jsonResponse(
      { code: 401 },
      { status: 401, refreshedToken: 'token-a-renewed' }
    ));
    const response = await pending;
    await response.json();

    expect(session.current()).toMatchObject({
      authenticated: true,
      token: 'token-b',
      user: { username: 'bob' }
    });
    expect(adapter.calls).toHaveLength(1);
  });

  test('parses uploads and keeps transport details behind the interface', async () => {
    const progress = [];
    const adapter = createMemoryAdapter((kind, call) => {
      expect(kind).toBe('upload');
      call.init.onProgress({ lengthComputable: true, loaded: 5, total: 10 });
      return jsonResponse({ code: 200, data: { id: 7 } }, { refreshedToken: 'upload-renewed' });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'upload-token', username: 'alice' });

    const result = await session.upload('https://quickshare.test/api/upload', {
      body: 'payload',
      onProgress: (event) => progress.push(event.loaded)
    });

    expect(result).toEqual({ code: 200, data: { id: 7 } });
    expect(progress).toEqual([5]);
    expect(session.current().token).toBe('upload-renewed');
    expect(adapter.calls[0]).toMatchObject({
      kind: 'upload',
      owned: true,
      token: 'upload-token'
    });
  });

  test('expires owned uploads before parsing unauthorized response bodies', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/auth/logout')) {
        return jsonResponse({ code: 200 });
      }
      expect(kind).toBe('upload');
      return {
        headers: { get: () => null },
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '<html>Unauthorized</html>'
      };
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'upload-token', username: 'alice' });

    await expect(session.upload('https://quickshare.test/api/upload', {
      body: 'payload'
    })).rejects.toThrow('Unauthorized');

    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[1]).toMatchObject({
      input: 'https://quickshare.test/api/auth/logout',
      token: 'upload-token'
    });
  });
});

test.describe('BrowserSession interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__quickshareNativeFetch = window.fetch;
    });
    await page.route('**/api/public/registration-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: {} })
      });
    });
    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  });

  test('establishes one normalized session and uses renewed tokens on later requests', async ({ page }) => {
    const authorizationHeaders = [];
    let requestCount = 0;
    await page.route('**/api/session-probe', async (route) => {
      requestCount += 1;
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: requestCount === 1 ? { 'X-Auth-Refresh': 'token-renewed' } : {},
        body: JSON.stringify({ code: 200, data: { requestCount } })
      });
    });

    const result = await page.evaluate(async () => {
      const established = BrowserSession.signIn({
        token: 'token-initial',
        username: 'alice',
        role: 'admin'
      });
      const first = await BrowserSession.request(`${API_BASE}/session-probe`);
      await first.json();
      const afterRenewal = BrowserSession.current();
      const second = await BrowserSession.request(`${API_BASE}/session-probe`);
      await second.json();
      return { established, afterRenewal, final: BrowserSession.current() };
    });

    expect(result.established).toMatchObject({
      token: 'token-initial',
      authenticated: true,
      isAdmin: true,
      user: { username: 'alice', role: 'ADMIN' }
    });
    expect(result.afterRenewal.token).toBe('token-renewed');
    expect(result.final.token).toBe('token-renewed');
    expect(authorizationHeaders).toEqual(['Bearer token-initial', 'Bearer token-renewed']);
  });

  test('isolates session credentials and state from third-party requests', async ({ page }) => {
    const authorizationHeaders = [];
    let logoutRequests = 0;
    await page.route('**/api/auth/logout', async (route) => {
      logoutRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200 })
      });
    });
    await page.route('https://third-party.test/session-probe', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Auth-Refresh',
          'X-Auth-Refresh': 'untrusted-token'
        },
        body: JSON.stringify({ code: 200 })
      });
    });
    await page.route('https://third-party.test/unauthorized', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });
    await page.route('https://third-party.test/upload-http-unauthorized', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });
    await page.route('https://third-party.test/upload-json-unauthorized', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });

    const result = await page.evaluate(async () => {
      BrowserSession.signIn({ token: 'private-token', username: 'alice' });
      const response = await BrowserSession.request('https://third-party.test/session-probe');
      const unauthorized = await BrowserSession.request('https://third-party.test/unauthorized');
      await unauthorized.json();
      let uploadHttpError = '';
      try {
        await BrowserSession.upload('https://third-party.test/upload-http-unauthorized');
      } catch (error) {
        uploadHttpError = error.message;
      }
      const uploadJson = await BrowserSession.upload('https://third-party.test/upload-json-unauthorized');
      return {
        status: response.status,
        unauthorizedStatus: unauthorized.status,
        uploadHttpError,
        uploadJsonCode: uploadJson.code,
        token: BrowserSession.current().token
      };
    });

    expect(result).toEqual({
      status: 200,
      unauthorizedStatus: 401,
      uploadHttpError: 'Unauthorized',
      uploadJsonCode: 401,
      token: 'private-token'
    });
    expect(authorizationHeaders).toEqual(['', '', '', '']);
    expect(logoutRequests).toBe(0);
  });

  test('keeps cross-origin bearer requests non-credentialed by default', async ({ page, context }) => {
    await context.addCookies([{
      name: 'quickshare_session',
      value: 'cookie-secret',
      url: 'http://localhost:8080'
    }]);

    const received = [];
    await page.route('http://localhost:3000/login.html', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Cross-origin BrowserSession test</title>'
      });
    });
    await page.route('http://localhost:8080/api/cross-origin-*', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3000',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization'
          }
        });
        return;
      }
      received.push({
        path: new URL(request.url()).pathname,
        authorization: request.headers().authorization || '',
        cookie: request.headers().cookie || ''
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
        body: JSON.stringify({ code: 200 })
      });
    });

    await page.goto('http://localhost:3000/login.html', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: 'src/main/resources/static/js/config.js' });
    await page.addScriptTag({ path: 'src/main/resources/static/js/session.js' });
    const result = await page.evaluate(async () => {
      BrowserSession.signIn({ token: 'cross-origin-token', username: 'alice' });
      const response = await BrowserSession.request(`${API_BASE}/cross-origin-fetch`);
      const upload = await BrowserSession.upload(`${API_BASE}/cross-origin-xhr`);
      return { fetchStatus: response.status, uploadCode: upload.code };
    });

    expect(result).toEqual({ fetchStatus: 200, uploadCode: 200 });
    expect(received).toEqual([
      { path: '/api/cross-origin-fetch', authorization: 'Bearer cross-origin-token', cookie: '' },
      { path: '/api/cross-origin-xhr', authorization: 'Bearer cross-origin-token', cookie: '' }
    ]);
  });

  test('leaves the browser fetch implementation untouched', async ({ page }) => {
    expect(await page.evaluate(() => window.fetch === window.__quickshareNativeFetch)).toBe(true);
  });

  test('converges local and cookie sessions for HTTP and JSON unauthorized responses', async ({ page }) => {
    let logoutRequests = 0;
    await page.route('**/api/auth/logout', async (route) => {
      logoutRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200 })
      });
    });
    await page.route('**/api/http-unauthorized', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: 'expired' })
      });
    });
    await page.route('**/api/body-unauthorized', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: 'expired' })
      });
    });

    const result = await page.evaluate(async () => {
      BrowserSession.signIn({ token: 'token-http', username: 'alice' });
      const httpResponse = await BrowserSession.request(`${API_BASE}/http-unauthorized`);
      const afterHttp = BrowserSession.current();
      await httpResponse.json();

      BrowserSession.signIn({ token: 'token-body', username: 'alice' });
      const bodyResponse = await BrowserSession.request(`${API_BASE}/body-unauthorized`);
      await bodyResponse.text();
      const afterBody = BrowserSession.current();

      const cookieOnlyResponse = await BrowserSession.request(`${API_BASE}/http-unauthorized`);
      await cookieOnlyResponse.json();

      return {
        httpStatus: httpResponse.status,
        afterHttp,
        afterBody,
        storedToken: localStorage.getItem('token'),
        storedUser: localStorage.getItem('user')
      };
    });

    await expect.poll(() => logoutRequests).toBe(3);
    expect(result.httpStatus).toBe(401);
    expect(result.afterHttp.authenticated).toBe(false);
    expect(result.afterBody.authenticated).toBe(false);
    expect(result.storedToken).toBeNull();
    expect(result.storedUser).toBeNull();
  });

  test('uploads with the latest token and captures renewal', async ({ page }) => {
    const authorizationHeaders = [];
    await page.route('**/api/session-xhr', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Auth-Refresh': 'xhr-token-renewed' },
        body: JSON.stringify({ code: 200 })
      });
    });

    const result = await page.evaluate(async () => {
      BrowserSession.signIn({ token: 'xhr-token-initial', username: 'alice' });
      const upload = await BrowserSession.upload(`${API_BASE}/session-xhr`);
      const controller = new AbortController();
      controller.abort();
      let abortName = '';
      try {
        await BrowserSession.upload(`${API_BASE}/session-xhr`, { signal: controller.signal });
      } catch (error) {
        abortName = error.name;
      }
      return { abortName, upload, session: BrowserSession.current() };
    });

    expect(authorizationHeaders).toEqual(['Bearer xhr-token-initial']);
    expect(result.abortName).toBe('AbortError');
    expect(result.upload.code).toBe(200);
    expect(result.session.token).toBe('xhr-token-renewed');
    expect(result.session.authenticated).toBe(true);
  });
});
