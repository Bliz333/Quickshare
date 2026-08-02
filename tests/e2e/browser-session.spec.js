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

    await expect(session.request('/profile')).resolves.toEqual({ code: 200 });
    expect(session.current().token).toBe('token-renewed');
    expect(adapter.calls[0]).toMatchObject({
      kind: 'request',
      input: 'https://quickshare.test/api/profile',
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

  test('requires owned backend routes while keeping arbitrary URLs on requestContent', async () => {
    const adapter = createMemoryAdapter();
    const session = createMemorySession(adapter);

    await expect(session.request('https://third-party.test/data'))
      .rejects.toThrow('BrowserSession backend routes must start with /');
    await expect(session.upload('https://third-party.test/upload'))
      .rejects.toThrow('BrowserSession backend routes must start with /');

    await session.requestContent('https://third-party.test/data');
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]).toMatchObject({
      input: 'https://third-party.test/data',
      owned: false,
      token: ''
    });
  });

  test('defers stale local JWT expiry to the server-backed session outcome', async () => {
    const expiredPayload = Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url');
    const expiredToken = `header.${expiredPayload}.signature`;
    const adapter = createMemoryAdapter((kind, call) => {
      expect(kind).toBe('request');
      expect(call.input).toBe('https://quickshare.test/api/profile');
      return jsonResponse({ code: 200, data: { username: 'alice' } });
    });
    const session = createMemorySession(adapter);

    session.signIn({ token: expiredToken, username: 'alice' });

    // Media requests can renew the HttpOnly cookie without updating local storage.
    expect(session.current()).toMatchObject({
      authenticated: true,
      token: expiredToken,
      user: { username: 'alice' }
    });
    expect(adapter.calls).toHaveLength(0);

    const result = await session.request('/profile');
    expect(result).toEqual({ code: 200, data: { username: 'alice' } });
    expect(session.current()).toMatchObject({ authenticated: true, token: expiredToken });
    expect(adapter.calls).toHaveLength(1);
  });

  test('returns business-code 401 while isolating third-party raw content', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input === 'https://third-party.test/data') {
        return jsonResponse({ code: 401 }, { refreshedToken: 'untrusted-token' });
      }
      if (call.input.endsWith('/profile')) {
        return jsonResponse({ code: 401 }, { status: 401 });
      }
      return jsonResponse({ code: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'private-token', username: 'alice' });

    const thirdParty = await session.requestContent('https://third-party.test/data');
    expect(await thirdParty.json()).toEqual({ code: 401 });
    expect(session.current().token).toBe('private-token');
    expect(adapter.calls[0]).toMatchObject({ owned: false, token: '' });

    const owned = await session.request('/private');
    expect(owned).toEqual({ code: 401 });
    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[2]).toMatchObject({
      input: 'https://quickshare.test/api/profile',
      init: { credentials: 'same-origin' },
      token: ''
    });
  });

  test('revalidates the current cookie before applying a stale unauthorized response', async () => {
    let resolveStaleRequest;
    const adapter = createMemoryAdapter((kind, call) => {
      expect(kind).toBe('request');
      if (call.input.endsWith('/profile')) {
        return jsonResponse({ code: 200, data: { username: 'alice', role: 'USER' } });
      }
      if (call.input.endsWith('/auth/logout')) {
        throw new Error('stale unauthorized responses must not log out the current cookie');
      }
      return new Promise((resolve) => {
        resolveStaleRequest = resolve;
      });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'nearly-expired-token', username: 'alice' });

    const pending = session.request('/private');
    resolveStaleRequest(jsonResponse({ code: 401 }, { status: 401 }));
    await expect(pending).resolves.toEqual({ code: 401 });

    expect(session.current()).toMatchObject({
      authenticated: true,
      token: 'nearly-expired-token',
      user: { username: 'alice', role: 'USER' }
    });
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[1]).toMatchObject({
      input: 'https://quickshare.test/api/profile',
      init: { credentials: 'same-origin' },
      token: ''
    });
  });

  test('keeps requestContent raw and does not treat file contents as a session envelope', async () => {
    const rawResponse = jsonResponse({ code: 401 });
    const adapter = createMemoryAdapter(() => rawResponse);
    const session = createMemorySession(adapter);
    session.signIn({ token: 'private-token', username: 'alice' });

    const init = { cache: 'no-store', headers: { 'X-Preview': '1' } };
    const response = await session.requestContent('https://quickshare.test/api/files/7/content', init);
    expect(response).toBe(rawResponse);
    expect(await response.text()).toBe('{"code":401}');
    expect(session.current()).toMatchObject({
      authenticated: true,
      token: 'private-token'
    });
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0].init).toEqual(init);
  });

  test('still expires an owned content request on an HTTP 401', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/profile')) {
        return jsonResponse({ code: 401 }, { status: 401 });
      }
      return jsonResponse({ code: 200 }, { status: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'private-token', username: 'alice' });

    const response = await session.requestContent('https://quickshare.test/api/files/7/content');

    expect(response.status).toBe(401);
    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[1]).toMatchObject({
      input: 'https://quickshare.test/api/profile',
      init: { credentials: 'same-origin' },
      token: ''
    });
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

    const pending = session.request('/private');
    session.signIn({ token: 'token-b', username: 'bob' });
    resolveRequest(jsonResponse(
      { code: 401 },
      { status: 401, refreshedToken: 'token-a-renewed' }
    ));
    await expect(pending).resolves.toEqual({ code: 401 });

    expect(session.current()).toMatchObject({
      authenticated: true,
      token: 'token-b',
      user: { username: 'bob' }
    });
    expect(adapter.calls).toHaveLength(1);
  });

  test('shares one cookie revalidation across concurrent request and upload outcomes', async () => {
    let profileRequests = 0;
    let resolveProfile;
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/profile')) {
        profileRequests += 1;
        return new Promise((resolve) => {
          resolveProfile = resolve;
        });
      }
      return jsonResponse({ code: 401 }, { status: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'shared-token', username: 'alice' });

    const requestPending = session.request('/private');
    const uploadPending = session.upload('/upload');

    await expect.poll(() => profileRequests).toBe(1);
    resolveProfile(jsonResponse({ code: 401 }, { status: 401 }));

    await expect(requestPending).resolves.toEqual({ code: 401 });
    await expect(uploadPending).resolves.toEqual({ code: 401 });
    expect(adapter.calls.filter((call) => call.input.endsWith('/profile'))).toHaveLength(1);
    expect(session.current().authenticated).toBe(false);
  });

  test('keeps stale and current unauthorized contexts isolated', async () => {
    const profileResolvers = [];
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/profile')) {
        return new Promise((resolve) => profileResolvers.push(resolve));
      }
      return jsonResponse({ code: 401 }, { status: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'token-a', username: 'alice' });

    const stalePending = session.request('/private-a');
    await expect.poll(() => profileResolvers.length).toBe(1);
    session.signIn({ token: 'token-b', username: 'bob' });
    const currentPending = session.upload('/private-b');
    await expect.poll(() => profileResolvers.length).toBe(2);

    profileResolvers[0](jsonResponse({ code: 200, data: { username: 'alice' } }));
    profileResolvers[1](jsonResponse({ code: 401 }, { status: 401 }));

    await expect(stalePending).resolves.toEqual({ code: 401 });
    await expect(currentPending).resolves.toEqual({ code: 401 });
    expect(session.current().authenticated).toBe(false);
  });

  test('cleans failed revalidation coordination before the next session context', async () => {
    let profileRequests = 0;
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/profile')) {
        profileRequests += 1;
        if (profileRequests === 1) {
          throw new Error('profile unavailable');
        }
        return jsonResponse({ code: 401 }, { status: 401 });
      }
      return jsonResponse({ code: 401 }, { status: 401 });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'token-a', username: 'alice' });

    await expect(session.request('/private-a')).resolves.toEqual({ code: 401 });
    session.signIn({ token: 'token-b', username: 'bob' });
    await expect(session.upload('/private-b')).resolves.toEqual({ code: 401 });

    expect(profileRequests).toBe(2);
    expect(session.current().authenticated).toBe(false);
  });

  test('keeps a newer profile when an older refresh completes late', async () => {
    let resolveProfile;
    const adapter = createMemoryAdapter((kind, call) => {
      expect(kind).toBe('request');
      expect(call.input).toBe('https://quickshare.test/api/profile');
      return new Promise((resolve) => {
        resolveProfile = resolve;
      });
    });
    const session = createMemorySession(adapter);
    session.signIn({ token: 'shared-token', username: 'alice', role: 'USER' });

    const pending = session.refresh();
    session.signIn({ token: 'shared-token', username: 'bob', role: 'ADMIN' });
    resolveProfile(jsonResponse({
      code: 200,
      data: { username: 'alice', role: 'USER' }
    }));

    await expect(pending).resolves.toMatchObject({ username: 'bob', role: 'ADMIN' });
    expect(session.current()).toMatchObject({
      token: 'shared-token',
      user: { username: 'bob', role: 'ADMIN' },
      isAdmin: true
    });
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

    const result = await session.upload('/upload', {
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

  test('returns a Result envelope for an HTTP error response', async () => {
    const adapter = createMemoryAdapter(() => jsonResponse({
      code: 404,
      message: 'File not found'
    }, { status: 404 }));
    const session = createMemorySession(adapter);

    await expect(session.request('/files/404')).resolves.toEqual({
      code: 404,
      message: 'File not found'
    });
  });

  test('rejects malformed JSON and propagates transport failures through the interface', async () => {
    const malformedAdapter = createMemoryAdapter(() => ({
      headers: { get: () => null },
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html>not a Result</html>'
    }));
    const malformedSession = createMemorySession(malformedAdapter);
    await expect(malformedSession.request('/profile'))
      .rejects.toThrow('Invalid JSON response');

    const failedAdapter = createMemoryAdapter(() => {
      throw new Error('Network request failed');
    });
    const failedSession = createMemorySession(failedAdapter);
    await expect(failedSession.request('/profile'))
      .rejects.toThrow('Network request failed');
  });

  test('expires owned uploads before parsing unauthorized response bodies', async () => {
    const adapter = createMemoryAdapter((kind, call) => {
      if (call.input.endsWith('/profile')) {
        return jsonResponse({ code: 401 }, { status: 401 });
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

    await expect(session.upload('/upload', {
      body: 'payload'
    })).rejects.toThrow('Unauthorized');

    expect(session.current().authenticated).toBe(false);
    expect(adapter.calls[1]).toMatchObject({
      input: 'https://quickshare.test/api/profile',
      init: { credentials: 'same-origin' },
      token: ''
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
    await page.goto('/login.html', { waitUntil: 'load' });
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
      const first = await BrowserSession.request('/session-probe');
      const afterRenewal = BrowserSession.current();
      const second = await BrowserSession.request('/session-probe');
      return { established, first, second, afterRenewal, final: BrowserSession.current() };
    });

    expect(result.established).toMatchObject({
      token: 'token-initial',
      authenticated: true,
      isAdmin: true,
      user: { username: 'alice', role: 'ADMIN' }
    });
    expect(result.first).toEqual({ code: 200, data: { requestCount: 1 } });
    expect(result.second).toEqual({ code: 200, data: { requestCount: 2 } });
    expect(result.afterRenewal.token).toBe('token-renewed');
    expect(result.final.token).toBe('token-renewed');
    expect(authorizationHeaders).toEqual(['Bearer token-initial', 'Bearer token-renewed']);
  });

  test('captures renewal from owned static content without parsing it as a session envelope', async ({ page }) => {
    await page.route('**/session-static.html', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'X-Auth-Refresh': 'token-from-static' },
        body: '<main>static content</main>'
      });
    });

    const result = await page.evaluate(async () => {
      BrowserSession.signIn({ token: 'token-before-static', username: 'alice' });
      const response = await BrowserSession.requestContent('/session-static.html');
      return {
        body: await response.text(),
        session: BrowserSession.current()
      };
    });

    expect(result.body).toBe('<main>static content</main>');
    expect(result.session).toMatchObject({
      authenticated: true,
      token: 'token-from-static',
      user: { username: 'alice' }
    });
  });

  test('isolates session credentials and state from third-party requests', async ({ page, baseURL }) => {
    const authorizationHeaders = [];
    let logoutRequests = 0;
    const thirdPartyUrl = new URL(baseURL);
    thirdPartyUrl.hostname = thirdPartyUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    const thirdPartyOrigin = thirdPartyUrl.origin;
    await page.route('**/api/auth/logout', async (route) => {
      logoutRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200 })
      });
    });
    await page.route(`${thirdPartyOrigin}/session-probe`, async (route) => {
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
    await page.route(`${thirdPartyOrigin}/unauthorized`, async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });
    const result = await page.evaluate(async (thirdPartyOrigin) => {
      BrowserSession.signIn({ token: 'private-token', username: 'alice' });
      const response = await BrowserSession.requestContent(`${thirdPartyOrigin}/session-probe`);
      const unauthorized = await BrowserSession.requestContent(`${thirdPartyOrigin}/unauthorized`);
      let requestError = '';
      let uploadError = '';
      try {
        await BrowserSession.request(`${thirdPartyOrigin}/session-probe`);
      } catch (error) {
        requestError = error.message;
      }
      try {
        await BrowserSession.upload(`${thirdPartyOrigin}/upload`);
      } catch (error) {
        uploadError = error.message;
      }
      return {
        responseStatus: response.status,
        unauthorizedStatus: unauthorized.status,
        requestError,
        uploadError,
        token: BrowserSession.current().token
      };
    }, thirdPartyOrigin);

    expect(result).toEqual({
      responseStatus: 200,
      unauthorizedStatus: 401,
      requestError: 'BrowserSession backend routes must start with /',
      uploadError: 'BrowserSession backend routes must start with /',
      token: 'private-token'
    });
    expect(authorizationHeaders).toEqual(['', '']);
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
      const response = await BrowserSession.request('/cross-origin-fetch');
      const upload = await BrowserSession.upload('/cross-origin-xhr');
      return { fetchCode: response.code, uploadCode: upload.code };
    });

    expect(result).toEqual({ fetchCode: 200, uploadCode: 200 });
    expect(received).toEqual([
      { path: '/api/cross-origin-fetch', authorization: 'Bearer cross-origin-token', cookie: '' },
      { path: '/api/cross-origin-xhr', authorization: 'Bearer cross-origin-token', cookie: '' }
    ]);
  });

  test('leaves the browser fetch implementation untouched', async ({ page }) => {
    expect(await page.evaluate(() => window.fetch === window.__quickshareNativeFetch)).toBe(true);
  });

  test('clears invalid local sessions without logging out a newer cookie session', async ({ page }) => {
    let logoutRequests = 0;
    let profileRequests = 0;
    await page.route('**/api/auth/logout', async (route) => {
      logoutRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200 })
      });
    });
    await page.route('**/api/profile', async (route) => {
      profileRequests += 1;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401, message: 'expired' })
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
      const httpResult = await BrowserSession.request('/http-unauthorized');
      const afterHttp = BrowserSession.current();

      BrowserSession.signIn({ token: 'token-body', username: 'alice' });
      await BrowserSession.request('/body-unauthorized');
      const afterBody = BrowserSession.current();

      await BrowserSession.request('/http-unauthorized');

      return {
        httpCode: httpResult.code,
        afterHttp,
        afterBody,
        storedToken: localStorage.getItem('token'),
        storedUser: localStorage.getItem('user')
      };
    });

    expect(profileRequests).toBe(2);
    expect(logoutRequests).toBe(0);
    expect(result.httpCode).toBe(401);
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
      const upload = await BrowserSession.upload('/session-xhr');
      const controller = new AbortController();
      controller.abort();
      let abortName = '';
      try {
        await BrowserSession.upload('/session-xhr', { signal: controller.signal });
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
