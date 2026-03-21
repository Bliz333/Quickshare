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

async function seedQuickDropSession(context, token, user, deviceId, deviceName) {
  await context.addInitScript(
    ({ storedToken, storedUser, storedDeviceId, storedDeviceName }) => {
      localStorage.setItem('token', storedToken);
      localStorage.setItem('user', JSON.stringify(storedUser));
      localStorage.setItem('quickshare-lang', 'en');
      localStorage.setItem('quickdrop-device-id', storedDeviceId);
      localStorage.setItem('quickdrop-device-name', storedDeviceName);
    },
    {
      storedToken: token,
      storedUser: user,
      storedDeviceId: deviceId,
      storedDeviceName: deviceName
    }
  );
}

async function registerDevice(request, token, deviceId, deviceName) {
  const response = await request.post('/api/quickdrop/sync', {
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

test.describe('QuickDrop real browser flow', () => {
  test('same-account real two-page transfer lands in unified task list', async ({ browser, request, baseURL }) => {
    test.setTimeout(120000);

    const { token, user } = await loginAsAdmin(request);
    await registerDevice(request, token, 'device-sender-real', 'Sender Browser');
    await registerDevice(request, token, 'device-receiver-real', 'Receiver Browser');

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();
    await seedQuickDropSession(senderContext, token, user, 'device-sender-real', 'Sender Browser');
    await seedQuickDropSession(receiverContext, token, user, 'device-receiver-real', 'Receiver Browser');

    const senderPage = await senderContext.newPage();
    const receiverPage = await receiverContext.newPage();

    let createdTaskId = null;
    try {
      await Promise.all([
        senderPage.goto(`${baseURL}/quickdrop.html`, { waitUntil: 'domcontentloaded' }),
        receiverPage.goto(`${baseURL}/quickdrop.html`, { waitUntil: 'domcontentloaded' })
      ]);

      await Promise.all([
        senderPage.evaluate(() => window.syncQuickDrop()),
        receiverPage.evaluate(() => window.syncQuickDrop())
      ]);

      await expect(senderPage.locator('[data-quickdrop-device="device-receiver-real"]')).toBeVisible();
      await expect(receiverPage.locator('[data-quickdrop-device="device-sender-real"]')).toBeVisible();

      await senderPage.locator('[data-quickdrop-device="device-receiver-real"]').click();

      await senderPage.locator('#quickDropFileInput').setInputFiles({
        name: 'real-direct-e2e.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('real direct transfer through quickdrop')
      });
      await senderPage.locator('#quickDropSendBtn').click();

      await expect(receiverPage.locator('#quickDropIncomingList')).toContainText('real-direct-e2e.txt', {
        timeout: 30000
      });
      await expect(senderPage.locator('#quickDropOutgoingList')).toContainText('real-direct-e2e.txt', {
        timeout: 30000
      });
      await expect(senderPage.locator('#quickDropOutgoingList')).toContainText(/Direct|Relay/, {
        timeout: 30000
      });

      createdTaskId = await senderPage.evaluate(() => {
        return window.quickDropState?.displayOutgoingTransfers?.[0]?.task?.taskId || null;
      });
      expect(createdTaskId).toBeTruthy();
    } finally {
      if (createdTaskId) {
        await request.delete(`/api/quickdrop/tasks/${createdTaskId}?deviceId=device-sender-real`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await senderContext.close();
      await receiverContext.close();
    }
  });
});
