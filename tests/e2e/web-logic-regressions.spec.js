const { test, expect } = require('@playwright/test');

test.describe('Web logic regressions', () => {
  test('login success redirects to index and social buttons render when Google client id exists', async ({ page, baseURL }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(String(error));
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            token: 'jwt-token',
            username: 'admin',
            nickname: 'Admin'
          }
        })
      });
    });

    await page.route('**/api/public/registration-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            googleClientId: 'google-test-client',
            emailVerificationEnabled: true
          }
        })
      });
    });

    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.google = { accounts: { id: { initialize: function(){}, prompt: function(){} } } };'
      });
    });

    await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('secret');
    await page.locator('#loginBtn').click();
    await page.waitForURL('**/index.html');

    await page.goto(`${baseURL}/register.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('netdisk brand returns to index and SPA router is disabled by default', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/netdisk.html`, { waitUntil: 'domcontentloaded' });
    const brandLink = page.locator('aside a[href="index.html"]').first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toContainText('QuickShare');
    await expect(brandLink.locator('i.fa-cloud')).toBeVisible();

    await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' });
    const spaResult = await page.evaluate(() => ({
      disableFlag: window.__QUICKSHARE_DISABLE_SPA__ !== false,
      navigateResult: typeof window.spaNavigate === 'function' ? window.spaNavigate('register.html') : null,
      htmlClass: document.documentElement.className,
    }));

    expect(spaResult.disableFlag).toBe(true);
    expect(spaResult.navigateResult).toBe(false);
    expect(spaResult.htmlClass).toContain('lang-ready');
  });
});
