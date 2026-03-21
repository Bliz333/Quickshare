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

async function getEmailTemplates(request, token) {
  const response = await request.get('/api/admin/settings/email-templates', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function restoreEmailTemplate(request, token, templateType, locales) {
  await request.put(`/api/admin/settings/email-templates/${templateType}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { locales }
  });
}

test.describe('Admin email template settings', () => {
  test('saves a template edit, reloads form values, and restores original content', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const originalTemplates = await getEmailTemplates(request, token);
    const targetTemplate = originalTemplates[0];

    expect(targetTemplate).toBeTruthy();

    const localeKeys = Object.keys(targetTemplate.locales || {});
    expect(localeKeys.length).toBeGreaterThan(0);

    const targetLocale = localeKeys.includes('en') ? 'en' : localeKeys[0];
    const originalLocale = targetTemplate.locales[targetLocale];
    const stamp = Date.now();
    const nextSubject = `${originalLocale.subject} [E2E ${stamp}]`;
    const nextBody = `${originalLocale.body}\n\nE2E ${stamp}`;
    const prefix = `emailTpl_${targetTemplate.templateType}_${targetLocale}`;

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="email"]').click();
      await expect(page.locator('.admin-page[data-page="email"].active')).toBeVisible();

      const subjectInput = page.locator(`[id="${prefix}_subject"]`);
      const bodyInput = page.locator(`[id="${prefix}_body"]`);
      const saveButton = page.locator(`button[onclick="saveEmailTemplate('${targetTemplate.templateType}', this)"]`);

      await expect(subjectInput).toBeVisible();
      await expect(bodyInput).toBeVisible();

      await subjectInput.fill(nextSubject);
      await bodyInput.fill(nextBody);

      const saveResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/settings/email-templates/${targetTemplate.templateType}`)
          && response.request().method() === 'PUT';
      });
      await saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();
      expect((await saveResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const currentTemplates = await getEmailTemplates(request, token);
        const currentTemplate = currentTemplates.find(template => template.templateType === targetTemplate.templateType);
        return JSON.stringify({
          subject: currentTemplate.locales[targetLocale].subject,
          body: currentTemplate.locales[targetLocale].body
        });
      }).toBe(JSON.stringify({
        subject: nextSubject,
        body: nextBody
      }));

      await expect(page.locator(`[id="${prefix}_subject"]`)).toHaveValue(nextSubject);
      await expect(page.locator(`[id="${prefix}_body"]`)).toHaveValue(nextBody);
    } finally {
      await restoreEmailTemplate(request, token, targetTemplate.templateType, targetTemplate.locales);
    }
  });
});
