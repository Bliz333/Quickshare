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
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${baseURL}/register.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('netdisk brand returns to index and SPA router stays enabled by default', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ username: 'admin', nickname: 'Admin' }));
    });

    await page.goto(`${baseURL}/netdisk.html`, { waitUntil: 'domcontentloaded' });
    const brandLink = page.locator('aside a[href="index.html"]').first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toContainText('QuickShare');
    await expect(brandLink.locator('i.fa-cloud')).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login.html', { waitUntil: 'domcontentloaded' });
    const spaResult = await page.evaluate(() => ({
      disabledFlag: window.__QUICKSHARE_DISABLE_SPA__ === true,
      navigateResult: typeof window.spaNavigate === 'function' ? window.spaNavigate('register.html') : null,
      htmlClass: document.documentElement.className,
    }));

    expect(spaResult.disabledFlag).toBe(false);
    expect(spaResult.navigateResult).toBe(true);
    await page.waitForURL('**/register.html', { waitUntil: 'domcontentloaded' });
    expect(spaResult.htmlClass).toContain('lang-ready');
  });

  test('anonymous netdisk entry redirects to login without rendering drive content or login notice', async ({ page, baseURL }) => {
    await page.addInitScript(() => localStorage.clear());
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('button[title="Cloud Storage"]').click();

    await page.waitForURL('**/login.html?redirect=netdisk.html', { waitUntil: 'domcontentloaded' });
    expect(dialogs).toEqual([]);
    await expect(page.locator('#toastContainer')).not.toContainText('Please login first');
    await expect(page.locator('#toastContainer')).not.toContainText('请先登录');
  });

  test('auth pages preserve protected redirect through login and register switching', async ({ page, baseURL }) => {
    await page.addInitScript(() => localStorage.clear());
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

    await page.goto(`${baseURL}/login.html?redirect=netdisk.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-auth-register-link]')).toHaveAttribute('href', 'register.html?redirect=netdisk.html');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('secret');
    await page.locator('#loginBtn').click();
    await page.waitForURL('**/netdisk.html');
  });


  test('SPA navigation keeps the mascot layer alive and preserves auth redirects', async ({ page, baseURL }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.route('**/api/public/registration-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            googleClientId: 'google-test-client',
            emailVerificationEnabled: false,
            recaptchaEnabled: false
          }
        })
      });
    });
    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mc-root', { state: 'attached' });

    const firstMascotRoot = await page.evaluateHandle(() => document.getElementById('mc-root'));
    await page.waitForTimeout(300);
    const homeMascotBox = await page.locator('#mc-root .mc-orange').boundingBox();
    await page.locator('.share-cta-bar a[href="share.html"]').click();
    await page.waitForURL('**/share.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-mascot-scene', 'share');

    const sameAfterShare = await page.evaluate((root) => root === document.getElementById('mc-root'), firstMascotRoot);
    expect(sameAfterShare).toBe(true);
    const shareMascotBox = await page.locator('#mc-root .mc-orange').boundingBox();
    const shareCardBox = await page.locator('#mainCard').boundingBox();
    expect(Math.abs((shareMascotBox?.x || 0) - (homeMascotBox?.x || 0))).toBeLessThan(32);
    expect(shareCardBox?.width || 0).toBeGreaterThan(450);
    expect(shareCardBox?.width || 0).toBeLessThan(700);

    await page.locator('a[href="login.html"]').first().click();
    await page.waitForURL('**/login.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-mascot-scene', 'login');

    const sameAfterLogin = await page.evaluate((root) => root === document.getElementById('mc-root'), firstMascotRoot);
    expect(sameAfterLogin).toBe(true);

    await page.goto(`${baseURL}/login.html?redirect=netdisk.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    await page.locator('[data-auth-register-link]').click();
    await page.waitForURL('**/register.html?redirect=netdisk.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-auth-login-link]')).toHaveAttribute('href', 'login.html?redirect=netdisk.html');
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    await page.locator('[data-auth-login-link]').click();
    await page.waitForURL('**/login.html?redirect=netdisk.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#googleLoginBtn')).toBeVisible();
    await page.locator('[data-auth-register-link]').click();
    await page.waitForURL('**/register.html?redirect=netdisk.html', { waitUntil: 'domcontentloaded' });
    const registerMascotBox = await page.locator('#mc-root .mc-orange').boundingBox();
    const registerBox = await page.locator('.register-container').boundingBox();
    expect(Math.abs((registerMascotBox?.x || 0) - (homeMascotBox?.x || 0))).toBeLessThan(36);
    expect(registerBox?.y || 9999).toBeLessThan(180);
    expect(registerBox?.width || 0).toBeGreaterThan(430);
  });

  test('register page is centered and login icon is distinct from logout', async ({ page, baseURL }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`${baseURL}/register.html`, { waitUntil: 'domcontentloaded' });

    const layout = await page.locator('.register-container').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        leftGap: rect.left,
        rightGap: window.innerWidth - rect.right,
        iconClass: el.querySelector('.logo-icon i')?.className || '',
      };
    });
    expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThan(8);
    expect(layout.iconClass).toContain('fa-user-pen');

    await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#authButtons a[href="login.html"] i')).toHaveClass(/fa-circle-user/);
    await expect(page.locator('#authButtons a[href="login.html"] i')).not.toHaveClass(/fa-right-from-bracket/);
  });

});
