const { test, expect } = require('@playwright/test');

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

async function createFolder(request, token, name, parentId = 0) {
  const response = await request.post('/api/folders', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, parentId }
  });
  return readJson(response);
}

async function deleteFolderIfExists(request, token, folderId) {
  if (!folderId) return;
  await request.delete(`/api/folders/${folderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function listRow(page, name) {
  return page.locator('#listContent > div').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

test.describe('Netdisk folder navigation', () => {
  test('navigates into a subfolder and browser back returns to root', async ({ page, request, baseURL }) => {
    const { token } = await loginAsAdmin(request);
    const folderName = uniqueName('e2e-nav');
    let folderId;

    try {
      const folder = await createFolder(request, token, folderName);
      folderId = folder.id;

      // Set auth cookie / token so the page sees us as logged in
      const loginResponse = await request.post('/api/auth/login', {
        data: {
          username: process.env.E2E_ADMIN_USERNAME || 'admin',
          password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!'
        }
      });
      const loginBody = await loginResponse.json();
      const token2 = loginBody.data.token;
      await page.goto(`${baseURL}/netdisk.html`);
      await page.evaluate((tok) => localStorage.setItem('token', tok), token2);

      // Navigate to netdisk root
      await page.goto(`${baseURL}/netdisk.html`);
      await page.waitForSelector('#listContent', { timeout: 10000 });

      // Root breadcrumb should be empty (no subfolder)
      const breadcrumb = page.locator('#breadcrumbPath');
      await expect(breadcrumb).not.toContainText(folderName);

      // URL should not have ?folder= at root
      expect(page.url()).not.toMatch(/[?&]folder=/);

      // Click into the new folder
      const row = listRow(page, folderName);
      await expect(row).toBeVisible({ timeout: 10000 });
      await row.dblclick();

      // URL should now include ?folder={id}
      await page.waitForURL(`**/?folder=${folderId}*`, { timeout: 8000 });
      expect(page.url()).toContain(`folder=${folderId}`);

      // Breadcrumb should show folder name
      await expect(breadcrumb).toContainText(folderName, { timeout: 5000 });

      // Browser back → should return to root
      await page.goBack();
      await page.waitForURL(/netdisk\.html(?!.*[?&]folder=)/, { timeout: 8000 });
      expect(page.url()).not.toMatch(/[?&]folder=/);

      // Breadcrumb should be empty again
      await expect(breadcrumb).not.toContainText(folderName);
    } finally {
      await deleteFolderIfExists(request, token, folderId);
    }
  });

  test('cold-start with ?folder= URL opens directly into subfolder', async ({ page, request, baseURL }) => {
    const { token } = await loginAsAdmin(request);
    const folderName = uniqueName('e2e-coldstart');
    let folderId;

    try {
      const folder = await createFolder(request, token, folderName);
      folderId = folder.id;

      const loginResponse = await request.post('/api/auth/login', {
        data: {
          username: process.env.E2E_ADMIN_USERNAME || 'admin',
          password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!'
        }
      });
      const loginBody = await loginResponse.json();
      const token2 = loginBody.data.token;
      await page.goto(`${baseURL}/netdisk.html`);
      await page.evaluate((tok) => localStorage.setItem('token', tok), token2);

      // Navigate directly to the subfolder URL
      await page.goto(`${baseURL}/netdisk.html?folder=${folderId}`);
      await page.waitForSelector('#listContent', { timeout: 10000 });

      // Breadcrumb should show folder name (cold-start routing)
      const breadcrumb = page.locator('#breadcrumbPath');
      await expect(breadcrumb).toContainText(folderName, { timeout: 8000 });

      // URL should still contain the folder param
      expect(page.url()).toContain(`folder=${folderId}`);
    } finally {
      await deleteFolderIfExists(request, token, folderId);
    }
  });
});
