const { test, expect } = require('@playwright/test');

async function readJson(response) {
  const body = await response.json();
  expect(body.code, `unexpected response body: ${JSON.stringify(body)}`).toBe(200);
  return body.data;
}

function resolveApiBaseUrl(baseURL) {
  const explicit = (process.env.PLAYWRIGHT_API_BASE_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  return `${String(baseURL || '').replace(/\/$/, '')}/api`;
}

async function loginAsAdmin(request, apiBaseUrl) {
  const username = process.env.E2E_ADMIN_USERNAME || 'admin';
  const password = process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!';

  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { username, password }
  });
  expect(response.ok()).toBeTruthy();

  const user = await readJson(response);
  expect(user.token).toBeTruthy();
  return { token: user.token, user };
}

async function seedTransferSession(context, token, user, deviceId, deviceName) {
  await context.addInitScript(
    ({ storedToken, storedUser, storedDeviceId, storedDeviceName }) => {
      localStorage.setItem('token', storedToken);
      localStorage.setItem('user', JSON.stringify(storedUser));
      localStorage.setItem('quickshare-lang', 'en');
      localStorage.setItem('transfer-device-id', storedDeviceId);
      localStorage.setItem('transfer-device-name', storedDeviceName);
    },
    {
      storedToken: token,
      storedUser: user,
      storedDeviceId: deviceId,
      storedDeviceName: deviceName
    }
  );
}

async function registerDevice(request, apiBaseUrl, token, deviceId, deviceName) {
  const response = await request.post(`${apiBaseUrl}/transfer/sync`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      deviceId,
      deviceName,
      deviceType: 'Chromium'
    }
  });
  expect(response.ok()).toBeTruthy();
  await readJson(response);
}

test.describe('Transfer real browser flow', () => {
  test('same-account devices are discoverable on the real home page', async ({ browser, request, baseURL }) => {
    test.setTimeout(120000);

    const apiBaseUrl = resolveApiBaseUrl(baseURL);
    const { token, user } = await loginAsAdmin(request, apiBaseUrl);
    await registerDevice(request, apiBaseUrl, token, 'device-sender-real', 'Sender Browser');
    await registerDevice(request, apiBaseUrl, token, 'device-receiver-real', 'Receiver Browser');

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();
    await seedTransferSession(senderContext, token, user, 'device-sender-real', 'Sender Browser');
    await seedTransferSession(receiverContext, token, user, 'device-receiver-real', 'Receiver Browser');

    const senderPage = await senderContext.newPage();
    const receiverPage = await receiverContext.newPage();

    try {
      await Promise.all([
        senderPage.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' }),
        receiverPage.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' })
      ]);

      await Promise.all([
        senderPage.waitForFunction(() => typeof window.syncAccountDevices === 'function'),
        receiverPage.waitForFunction(() => typeof window.syncAccountDevices === 'function')
      ]);

      await Promise.all([
        senderPage.evaluate(() => window.syncAccountDevices()),
        receiverPage.evaluate(() => window.syncAccountDevices())
      ]);

      const receiverCard = senderPage.locator('.peer-card.account', { hasText: 'Receiver Browser' });
      const senderCard = receiverPage.locator('.peer-card.account', { hasText: 'Sender Browser' });
      await expect(receiverCard).toBeVisible({ timeout: 30000 });
      await expect(senderCard).toBeVisible({ timeout: 30000 });

      await receiverCard.click();

      await expect(senderPage.locator('#sendChooser')).toBeVisible();
      await expect(senderPage.locator('#sendChooserTarget')).toContainText('Receiver Browser');
      await expect(senderPage.locator('#chooserSendFileBtn')).toBeVisible();
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });
});
