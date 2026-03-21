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

async function getPaymentProviders(request, token) {
  const response = await request.get('/api/admin/payment-providers', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function deletePaymentProviderIfExists(request, token, providerId) {
  if (!providerId) {
    return;
  }

  await request.delete(`/api/admin/payment-providers/${providerId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function cleanupE2EProviders(request, token) {
  const providers = await getPaymentProviders(request, token);
  for (const provider of providers) {
    if (String(provider.name || '').startsWith('E2E Provider')) {
      await deletePaymentProviderIfExists(request, token, provider.id);
    }
  }
}

function providerRow(page, name) {
  return page.locator('#providersTableBody tr').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

test.describe('Admin payment provider settings', () => {
  test('creates, edits, and deletes a payment provider through the admin UI', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    await cleanupE2EProviders(request, token);
    const originalProviders = await getPaymentProviders(request, token);
    const stamp = Date.now();
    const createdName = `E2E Provider ${stamp}`;
    const updatedName = `E2E Provider Updated ${stamp}`;

    let createdProviderId = null;

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="payment"]').click();
      await expect(page.locator('.admin-page[data-page="payment"].active')).toBeVisible();

      await page.locator('#providerName').fill(createdName);
      await page.locator('#providerApiUrl').fill(`https://pay-${stamp}.example.com/`);
      await page.locator('#providerPid').fill(`pid-${stamp}`);
      await page.locator('#providerKey').fill(`key-${stamp}`);
      await page.locator('#providerPayTypes').fill('alipay,wxpay');
      await page.locator('#providerSortOrder').fill('33');
      await page.locator('#providerEnabled').setChecked(true);

      const createResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/payment-providers')
          && response.request().method() === 'POST';
      });
      await page.locator('#providerSaveBtn').click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      const createdProvider = await readJson(createResponse);
      createdProviderId = createdProvider.id;
      expect(createdProviderId).toBeTruthy();

      await expect.poll(async () => {
        const providers = await getPaymentProviders(request, token);
        const current = providers.find(provider => provider.id === createdProviderId);
        return JSON.stringify({
          name: current?.name,
          apiUrl: current?.apiUrl,
          pid: current?.pid,
          payTypes: current?.payTypes,
          enabled: current?.enabled,
          sortOrder: current?.sortOrder,
          hasKey: current?.hasKey
        });
      }).toBe(JSON.stringify({
        name: createdName,
        apiUrl: `https://pay-${stamp}.example.com`,
        pid: `pid-${stamp}`,
        payTypes: 'alipay,wxpay',
        enabled: 1,
        sortOrder: 33,
        hasKey: true
      }));

      await expect(page.locator('#providersCountBadge')).toHaveText(String(originalProviders.length + 1));
      const createdRow = providerRow(page, createdName);
      await expect(createdRow).toBeVisible();

      const editResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/payment-providers/${createdProviderId}`)
          && response.request().method() === 'PUT';
      });
      await createdRow.locator('button.action-btn').first().click();
      await expect(page.locator('#providerCancelBtn')).not.toHaveClass(/hidden/);
      await expect(page.locator('#providerKeyHint')).not.toHaveText('');
      await page.locator('#providerName').fill(updatedName);
      await page.locator('#providerApiUrl').fill(`https://stable-${stamp}.example.com`);
      await page.locator('#providerPid').fill(`pid-updated-${stamp}`);
      await page.locator('#providerKey').fill('');
      await page.locator('#providerPayTypes').fill('wxpay');
      await page.locator('#providerSortOrder').fill('7');
      await page.locator('#providerEnabled').setChecked(false);
      await page.locator('#providerSaveBtn').click();
      const editResponse = await editResponsePromise;
      expect(editResponse.ok()).toBeTruthy();
      await readJson(editResponse);

      await expect.poll(async () => {
        const providers = await getPaymentProviders(request, token);
        const current = providers.find(provider => provider.id === createdProviderId);
        return JSON.stringify({
          name: current?.name,
          apiUrl: current?.apiUrl,
          pid: current?.pid,
          payTypes: current?.payTypes,
          enabled: current?.enabled,
          sortOrder: current?.sortOrder,
          hasKey: current?.hasKey
        });
      }).toBe(JSON.stringify({
        name: updatedName,
        apiUrl: `https://stable-${stamp}.example.com`,
        pid: `pid-updated-${stamp}`,
        payTypes: 'wxpay',
        enabled: 0,
        sortOrder: 7,
        hasKey: true
      }));

      const updatedRow = providerRow(page, updatedName);
      await expect(updatedRow).toBeVisible();
      await expect(page.locator('#providerCancelBtn')).toHaveClass(/hidden/);

      const deleteResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/payment-providers/${createdProviderId}`)
          && response.request().method() === 'DELETE';
      });
      await updatedRow.locator('button.action-btn.danger').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /Confirm|确认/ }).click();
      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBeTruthy();
      expect((await deleteResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const providers = await getPaymentProviders(request, token);
        return providers.some(provider => provider.id === createdProviderId);
      }).toBe(false);

      await expect(updatedRow).toHaveCount(0);
      await expect(page.locator('#providersCountBadge')).toHaveText(String(originalProviders.length));
      createdProviderId = null;
    } finally {
      await deletePaymentProviderIfExists(request, token, createdProviderId);
      await cleanupE2EProviders(request, token);
    }
  });
});
