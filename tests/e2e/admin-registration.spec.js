const { test, expect } = require('@playwright/test');

async function readJson(response) {
  const body = await response.json();
  expect(body.code, `unexpected response body: ${JSON.stringify(body)}`).toBe(200);
  return body.data;
}

async function loginAsAdmin(request) {
  const username = process.env.E2E_ADMIN_USERNAME || 'admin';
  const password = process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!';

  const response = await request.post('/api/auth/login', {
    data: { username, password }
  });
  expect(response.ok()).toBeTruthy();

  const user = await readJson(response);
  expect(user.token).toBeTruthy();
  return { token: user.token, user };
}

async function seedSession(page, token, user) {
  await page.addInitScript(
    ({ storedToken, storedUser }) => {
      localStorage.setItem('token', storedToken);
      localStorage.setItem('user', JSON.stringify(storedUser));
    },
    { storedToken: token, storedUser: user }
  );
}

async function getAdminConsolePath(request, token) {
  const response = await request.get('/api/admin/settings/admin-console', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await readJson(response);
  expect(data.entryPath).toBeTruthy();
  return data.entryPath;
}

async function getRegistrationSettings(request, token) {
  const response = await request.get('/api/admin/settings/registration', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function updateRegistrationSettings(request, token, payload) {
  const response = await request.put('/api/admin/settings/registration', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  await readJson(response);
}

test.describe('Admin registration settings', () => {
  test('saves registration settings, updates provider copy, syncs public settings, and restores original config', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const originalSettings = await getRegistrationSettings(request, token);
    const nextProvider = originalSettings.captchaProvider === 'turnstile' ? 'recaptcha' : 'turnstile';
    const nextEmailVerificationEnabled = !originalSettings.emailVerificationEnabled;
    const nextRecaptchaEnabled = !originalSettings.recaptchaEnabled;
    const nextSiteKey = `e2e-site-key-${Date.now()}`;
    const nextSecretKey = `e2e-secret-key-${Date.now()}`;
    const nextVerifyUrl = nextProvider === 'turnstile'
      ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      : 'https://www.google.com/recaptcha/api/siteverify';

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await expect(page.locator('.admin-page[data-page="overview"].active')).toBeVisible();
      await page.locator('.admin-sidebar-nav a[data-nav="security"]').click();
      await expect(page.locator('.admin-page[data-page="security"].active')).toBeVisible();

      const providerSelect = page.locator('#registrationCaptchaProvider');
      const emailVerificationCheckbox = page.locator('#registrationEmailVerificationEnabled');
      const recaptchaEnabledCheckbox = page.locator('#registrationRecaptchaEnabled');
      const siteKeyInput = page.locator('#registrationRecaptchaSiteKey');
      const secretKeyInput = page.locator('#registrationRecaptchaSecretKey');
      const verifyUrlInput = page.locator('#registrationRecaptchaVerifyUrl');
      const siteKeyLabel = page.locator('#registrationCaptchaSiteKeyLabel');
      const verifyHint = page.locator('#registrationCaptchaVerifyHint');

      const previousLabelText = await siteKeyLabel.textContent();
      await providerSelect.selectOption(nextProvider);
      await expect(siteKeyLabel).not.toHaveText(previousLabelText || '');
      await expect(verifyHint).toContainText(nextVerifyUrl);

      if ((await emailVerificationCheckbox.isChecked()) !== nextEmailVerificationEnabled) {
        await emailVerificationCheckbox.click();
      }
      if ((await recaptchaEnabledCheckbox.isChecked()) !== nextRecaptchaEnabled) {
        await recaptchaEnabledCheckbox.click();
      }
      await siteKeyInput.fill(nextSiteKey);
      await secretKeyInput.fill(nextSecretKey);
      await verifyUrlInput.fill(nextVerifyUrl);

      const saveResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/settings/registration')
          && response.request().method() === 'PUT';
      });
      await page.locator('.admin-page[data-page="security"] .form-actions .action-btn').click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();
      const saveResult = await saveResponse.json();
      expect(saveResult.code).toBe(200);

      await expect.poll(async () => {
        const current = await getRegistrationSettings(request, token);
        return JSON.stringify({
          emailVerificationEnabled: current.emailVerificationEnabled,
          recaptchaEnabled: current.recaptchaEnabled,
          captchaProvider: current.captchaProvider,
          recaptchaSiteKey: current.recaptchaSiteKey,
          recaptchaVerifyUrl: current.recaptchaVerifyUrl
        });
      }).toBe(JSON.stringify({
        emailVerificationEnabled: nextEmailVerificationEnabled,
        recaptchaEnabled: nextRecaptchaEnabled,
        captchaProvider: nextProvider,
        recaptchaSiteKey: nextSiteKey,
        recaptchaVerifyUrl: nextVerifyUrl
      }));

      const publicSettingsResponse = await request.get('/api/public/registration-settings');
      const publicSettings = await readJson(publicSettingsResponse);
      expect(publicSettings.emailVerificationEnabled).toBe(nextEmailVerificationEnabled);
      expect(publicSettings.recaptchaEnabled).toBe(nextRecaptchaEnabled);
      expect(publicSettings.captchaProvider).toBe(nextProvider);
      expect(publicSettings.recaptchaSiteKey).toBe(nextSiteKey);
    } finally {
      await updateRegistrationSettings(request, token, {
        emailVerificationEnabled: originalSettings.emailVerificationEnabled,
        recaptchaEnabled: originalSettings.recaptchaEnabled,
        captchaProvider: originalSettings.captchaProvider,
        recaptchaSiteKey: originalSettings.recaptchaSiteKey || '',
        recaptchaSecretKey: originalSettings.recaptchaSecretKey || '',
        recaptchaVerifyUrl: originalSettings.recaptchaVerifyUrl || ''
      });
    }
  });
});
