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

async function getSmtpPolicy(request, token) {
  const response = await request.get('/api/admin/settings/smtp', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

test.describe('Admin SMTP settings', () => {
  test('saves current SMTP settings and sends a real test email', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const smtpPolicy = await getSmtpPolicy(request, token);
    const testRecipient = smtpPolicy.senderAddress || smtpPolicy.username;

    test.skip(!smtpPolicy.host || !smtpPolicy.hasPassword || !testRecipient, 'SMTP is not configured in this environment.');

    await seedSession(page, token, user);
    await page.goto(`${baseURL}${entryPath}`);

    await page.locator('.admin-sidebar-nav a[data-nav="email"]').click();
    await expect(page.locator('.admin-page[data-page="email"].active')).toBeVisible();

    await expect(page.locator('#smtpHost')).toHaveValue(smtpPolicy.host);
    await expect(page.locator('#smtpPort')).toHaveValue(String(smtpPolicy.port));
    await expect(page.locator('#smtpUsername')).toHaveValue(smtpPolicy.username || '');
    await expect(page.locator('#smtpSenderAddress')).toHaveValue(smtpPolicy.senderAddress || '');
    await expect(page.locator('#smtpStarttlsEnabled')).toBeChecked({ checked: smtpPolicy.starttlsEnabled !== false });
    await expect(page.locator('#smtpPasswordHint')).not.toHaveText('');

    const saveResponsePromise = page.waitForResponse(response => {
      return response.url().endsWith('/api/admin/settings/smtp')
        && response.request().method() === 'PUT';
    });
    await page.locator('button[onclick="saveSmtpSettings(this)"]').click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();
    expect((await saveResponse.json()).code).toBe(200);

    await expect.poll(async () => {
      const current = await getSmtpPolicy(request, token);
      return JSON.stringify({
        host: current.host,
        port: current.port,
        username: current.username,
        senderAddress: current.senderAddress,
        starttlsEnabled: current.starttlsEnabled,
        hasPassword: current.hasPassword
      });
    }).toBe(JSON.stringify({
      host: smtpPolicy.host,
      port: smtpPolicy.port,
      username: smtpPolicy.username,
      senderAddress: smtpPolicy.senderAddress,
      starttlsEnabled: smtpPolicy.starttlsEnabled,
      hasPassword: true
    }));

    await page.locator('button[onclick="sendSmtpTestEmail(this)"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill(testRecipient);

    const sendResponsePromise = page.waitForResponse(response => {
      return response.url().endsWith('/api/admin/settings/smtp/test')
        && response.request().method() === 'POST';
    });
    await dialog.getByRole('button', { name: /Send|发送/ }).click();
    const sendResponse = await sendResponsePromise;
    expect(sendResponse.ok()).toBeTruthy();
    expect((await sendResponse.json()).code).toBe(200);
  });
});
