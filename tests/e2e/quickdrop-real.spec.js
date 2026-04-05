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
  test('same-account real two-page transfer lands in unified task list', async ({ browser, request, baseURL }) => {
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
        senderPage.goto(`${baseURL}/transfer.html`, { waitUntil: 'domcontentloaded' }),
        receiverPage.goto(`${baseURL}/transfer.html`, { waitUntil: 'domcontentloaded' })
      ]);

      await Promise.all([
        senderPage.evaluate(() => window.syncTransfer()),
        receiverPage.evaluate(() => window.syncTransfer())
      ]);

      await expect(senderPage.locator('[data-transfer-device="device-receiver-real"]')).toBeVisible();
      await expect(receiverPage.locator('[data-transfer-device="device-sender-real"]')).toBeVisible();

      await senderPage.locator('[data-transfer-device="device-receiver-real"]').click();

      await senderPage.locator('#transferFileInput').setInputFiles({
        name: 'real-direct-e2e.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('real direct transfer through transfer')
      });
      await senderPage.locator('#transferSendBtn').click();

      await expect(receiverPage.locator('#transferIncomingList')).toContainText('real-direct-e2e.txt', {
        timeout: 30000
      });
      await expect(senderPage.locator('#transferOutgoingList')).toContainText('real-direct-e2e.txt', {
        timeout: 30000
      });
      await expect(senderPage.locator('#transferOutgoingList')).toContainText(/Direct|Relay/, {
        timeout: 30000
      });

      finalSnapshot = await senderPage.evaluate(() => {
        const item = window.transferState?.displayOutgoingTransfers?.[0] || null;
        const task = item?.task || null;
        const signalLoaded = Boolean(window.TransferSignalManager);
        const signal = window.TransferSignalManager?.getState?.() || {};
        return {
          taskId: task?.taskId || task?.id || item?.taskId || null,
          transferMode: task?.transferMode || item?.transferMode || null,
          currentTransferMode: task?.currentTransferMode || null,
          stage: task?.stage || item?.status || null,
          attemptStatus: task?.attemptStatus || null,
          endReason: task?.endReason || null,
          failureReason: task?.failureReason || null,
          attempts: (task?.attempts || []).map(attempt => ({
            transferMode: attempt.transferMode,
            stage: attempt.stage,
            attemptStatus: attempt.attemptStatus,
            endReason: attempt.endReason,
            failureReason: attempt.failureReason,
            updateTime: attempt.updateTime
          })),
          signalLoaded,
          signalConnected: Boolean(signal.connected),
          signalDirectState: signal.directState || null,
          signalPeerDeviceId: signal.latestPeerDeviceId || null,
          directDiagnostics: signal.directDiagnostics || null
        };
      });
      createdTaskId = finalSnapshot?.taskId || null;
      expect(createdTaskId).toBeTruthy();
      console.log('[transfer-real] final_snapshot=' + JSON.stringify(finalSnapshot));
      const expectedMode = process.env.EXPECT_QUICKDROP_FINAL_MODE || '';
      if (expectedMode) {
        expect(finalSnapshot?.transferMode).toBe(expectedMode);
      }
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
