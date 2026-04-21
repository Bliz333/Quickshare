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
  test('same-account real two-page transfer reaches homepage receive flow', async ({ browser, request, baseURL }) => {
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

    let createdTaskId = null;
    let finalSnapshot = null;
    try {
      await Promise.all([
        senderPage.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' }),
        receiverPage.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' })
      ]);

      await expect(senderPage.locator('#peerDevices')).toContainText('Receiver Browser', { timeout: 30000 });
      await expect(receiverPage.locator('#peerDevices')).toContainText('Sender Browser', { timeout: 30000 });

      await senderPage.locator('#peerDevices .peer-card', { hasText: 'Receiver Browser' }).click();

      await senderPage.locator('#homeFileInput').setInputFiles({
        name: 'real-direct-e2e.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('real direct transfer through transfer')
      });

      await expect(receiverPage.locator('#receiveModal')).toBeVisible({ timeout: 30000 });
      await expect(receiverPage.locator('#receiveFileName')).toContainText('real-direct-e2e.txt', {
        timeout: 30000
      });
      await expect(receiverPage.locator('#receiveDownloadBtn')).toBeVisible({ timeout: 30000 });
      await expect(receiverPage.locator('#receiveSaveBtn')).toBeVisible({ timeout: 30000 });

      const downloadPromise = receiverPage.waitForEvent('download');
      await receiverPage.locator('#receiveDownloadBtn').click();
      const download = await downloadPromise;
      expect(await download.suggestedFilename()).toContain('real-direct-e2e.txt');

      const saveResponsePromise = receiverPage.waitForResponse((response) => {
        return response.url().includes('/api/transfer/public-shares/')
          && response.url().includes('/save')
          && response.request().method() === 'POST';
      });
      await receiverPage.locator('#receiveSaveBtn').click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();

      await expect(senderPage.locator('#peerDevices')).toContainText('Receiver Browser', {
        timeout: 30000
      });

      finalSnapshot = await senderPage.evaluate(() => {
        return {
          receiveModalVisible: Boolean(document.getElementById('receiveModal')?.classList.contains('visible')),
          receiverNameText: document.getElementById('receiveFileName')?.textContent || null,
          senderPeerCount: document.querySelectorAll('#peerDevices .peer-card').length,
        };
      });
      expect(finalSnapshot?.senderPeerCount).toBeGreaterThan(0);
      console.log('[transfer-real] final_snapshot=' + JSON.stringify(finalSnapshot));
    } finally {
      if (createdTaskId) {
        await request.delete(`${apiBaseUrl}/transfer/tasks/${createdTaskId}?deviceId=device-sender-real`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await senderContext.close();
      await receiverContext.close();
    }
  });
});
