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

async function getAdminConsoleAccess(request, token) {
  const response = await request.get('/api/admin/settings/admin-console', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function getCorsPolicy(request, token) {
  const response = await request.get('/api/admin/settings/cors', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function restoreAdminConsoleAccess(request, token, access) {
  await request.put('/api/admin/settings/admin-console', {
    headers: { Authorization: `Bearer ${token}` },
    data: { entrySlug: access.entrySlug }
  });
}

async function restoreCorsPolicy(request, token, policy) {
  await request.put('/api/admin/settings/cors', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      allowedOrigins: policy.allowedOrigins || [],
      allowedMethods: policy.allowedMethods || [],
      allowedHeaders: policy.allowedHeaders || [],
      allowCredentials: policy.allowCredentials,
      maxAgeSeconds: policy.maxAgeSeconds
    }
  });
}

test.describe('Admin system settings', () => {
  test('saves CORS policy, switches admin entry path, and restores original values', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const originalAccess = await getAdminConsoleAccess(request, token);
    const originalCorsPolicy = await getCorsPolicy(request, token);

    const stamp = Date.now();
    const nextSlug = `e2e-admin-${stamp}`;
    const nextCorsPolicy = {
      allowedOrigins: [
        'http://localhost:3000',
        `https://e2e-${stamp}.example.com`
      ],
      allowedMethods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-E2E-Trace'],
      allowCredentials: !originalCorsPolicy.allowCredentials,
      maxAgeSeconds: originalCorsPolicy.maxAgeSeconds === 900 ? 600 : 900
    };

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${originalAccess.entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="system"]').click();
      await expect(page.locator('.admin-page[data-page="system"].active')).toBeVisible();

      const adminConsoleSlug = page.locator('#adminConsoleSlug');
      const adminConsolePathPreview = page.locator('#adminConsolePathPreviewValue');
      const corsAllowedOrigins = page.locator('#corsAllowedOrigins');
      const corsAllowedMethods = page.locator('#corsAllowedMethods');
      const corsAllowedHeaders = page.locator('#corsAllowedHeaders');
      const corsAllowCredentials = page.locator('#corsAllowCredentials');
      const corsMaxAgeSeconds = page.locator('#corsMaxAgeSeconds');
      const actionButtons = page.locator('.admin-page[data-page="system"] .action-btn');

      await corsAllowedOrigins.fill(nextCorsPolicy.allowedOrigins.join('\n'));
      await corsAllowedMethods.fill(nextCorsPolicy.allowedMethods.join(','));
      await corsAllowedHeaders.fill(nextCorsPolicy.allowedHeaders.join(','));
      await corsAllowCredentials.setChecked(nextCorsPolicy.allowCredentials);
      await corsMaxAgeSeconds.fill(String(nextCorsPolicy.maxAgeSeconds));

      const saveCorsPromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/settings/cors')
          && response.request().method() === 'PUT';
      });
      await actionButtons.nth(1).click();
      const saveCorsResponse = await saveCorsPromise;
      expect(saveCorsResponse.ok()).toBeTruthy();
      expect((await saveCorsResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const current = await getCorsPolicy(request, token);
        return JSON.stringify({
          allowedOrigins: current.allowedOrigins || [],
          allowedMethods: current.allowedMethods || [],
          allowedHeaders: current.allowedHeaders || [],
          allowCredentials: current.allowCredentials,
          maxAgeSeconds: current.maxAgeSeconds
        });
      }).toBe(JSON.stringify(nextCorsPolicy));

      await adminConsoleSlug.fill(nextSlug);
      await expect(adminConsolePathPreview).toContainText(`/console/${nextSlug}`);

      const saveAccessPromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/settings/admin-console')
          && response.request().method() === 'PUT';
      });
      const navigatePromise = page.waitForURL(new RegExp(`/console/${nextSlug}(#system)?$`));
      await actionButtons.first().click();
      const saveAccessResponse = await saveAccessPromise;
      expect(saveAccessResponse.ok()).toBeTruthy();
      expect((await saveAccessResponse.json()).code).toBe(200);
      await navigatePromise;

      await expect(page).toHaveURL(new RegExp(`/console/${nextSlug}(#system)?$`));
      await expect(page.locator('.admin-page[data-page="system"].active')).toBeVisible();

      await expect.poll(async () => {
        const current = await getAdminConsoleAccess(request, token);
        return JSON.stringify({
          entrySlug: current.entrySlug,
          entryPath: current.entryPath
        });
      }).toBe(JSON.stringify({
        entrySlug: nextSlug,
        entryPath: `/console/${nextSlug}`
      }));
    } finally {
      await restoreCorsPolicy(request, token, originalCorsPolicy);
      await restoreAdminConsoleAccess(request, token, originalAccess);
    }
  });
});
