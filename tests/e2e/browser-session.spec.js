const { test, expect } = require('@playwright/test');

test.describe('BrowserSession interface', () => {
  test.beforeEach(async ({ page }) => {
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
      const established = BrowserSession.establish({
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
    await page.route('https://third-party.test/xhr-http-unauthorized', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });
    await page.route('https://third-party.test/xhr-json-unauthorized', async (route) => {
      authorizationHeaders.push(route.request().headers().authorization || '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ code: 401 })
      });
    });

    const result = await page.evaluate(async () => {
      const requestXhr = (url) => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        BrowserSession.prepareXhr(xhr, url);
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => reject(new Error('XHR failed'));
        xhr.send();
      });
      BrowserSession.establish({ token: 'private-token', username: 'alice' });
      const response = await BrowserSession.request('https://third-party.test/session-probe');
      const unauthorized = await BrowserSession.request('https://third-party.test/unauthorized');
      await unauthorized.json();
      const xhrHttpStatus = await requestXhr('https://third-party.test/xhr-http-unauthorized');
      const xhrJsonStatus = await requestXhr('https://third-party.test/xhr-json-unauthorized');
      return {
        status: response.status,
        unauthorizedStatus: unauthorized.status,
        xhrHttpStatus,
        xhrJsonStatus,
        token: BrowserSession.current().token
      };
    });

    expect(result).toEqual({
      status: 200,
      unauthorizedStatus: 401,
      xhrHttpStatus: 401,
      xhrJsonStatus: 200,
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
      BrowserSession.establish({ token: 'cross-origin-token', username: 'alice' });
      const response = await BrowserSession.request(`${API_BASE}/cross-origin-fetch`);
      const xhrStatus = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${API_BASE}/cross-origin-xhr`;
        xhr.open('POST', url);
        BrowserSession.prepareXhr(xhr, url);
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => reject(new Error('XHR failed'));
        xhr.send();
      });
      return { fetchStatus: response.status, xhrStatus };
    });

    expect(result).toEqual({ fetchStatus: 200, xhrStatus: 200 });
    expect(received).toEqual([
      { path: '/api/cross-origin-fetch', authorization: 'Bearer cross-origin-token', cookie: '' },
      { path: '/api/cross-origin-xhr', authorization: 'Bearer cross-origin-token', cookie: '' }
    ]);
  });

  test('captures renewal from remaining native fetch callers', async ({ page }) => {
    await page.route('**/api/native-renewal', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Auth-Refresh': 'native-token-renewed' },
        body: JSON.stringify({ code: 200 })
      });
    });

    const session = await page.evaluate(async () => {
      BrowserSession.establish({ token: 'native-token-initial', username: 'alice' });
      const response = await fetch(`${API_BASE}/native-renewal`);
      await response.json();
      return BrowserSession.current();
    });

    expect(session.token).toBe('native-token-renewed');
    expect(session.authenticated).toBe(true);
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
      BrowserSession.establish({ token: 'token-http', username: 'alice' });
      const httpResponse = await BrowserSession.request(`${API_BASE}/http-unauthorized`);
      const afterHttp = BrowserSession.current();
      await httpResponse.json();

      BrowserSession.establish({ token: 'token-body', username: 'alice' });
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

  test('prepares XHR with the latest token and captures renewal', async ({ page }) => {
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

    const session = await page.evaluate(async () => {
      BrowserSession.establish({ token: 'xhr-token-initial', username: 'alice' });
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${API_BASE}/session-xhr`;
        xhr.open('POST', url);
        BrowserSession.prepareXhr(xhr, url);
        xhr.onload = resolve;
        xhr.onerror = () => reject(new Error('XHR failed'));
        xhr.send();
      });
      return BrowserSession.current();
    });

    expect(authorizationHeaders).toEqual(['Bearer xhr-token-initial']);
    expect(session.token).toBe('xhr-token-renewed');
    expect(session.authenticated).toBe(true);
  });
});
