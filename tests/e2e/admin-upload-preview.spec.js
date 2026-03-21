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

async function getUploadPolicy(request, token) {
  const response = await request.get('/api/admin/settings/file-upload', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function getPreviewPolicy(request, token) {
  const response = await request.get('/api/admin/settings/file-preview', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function restoreUploadPolicy(request, token, policy) {
  await request.put('/api/admin/settings/file-upload', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      guestUploadEnabled: policy.guestUploadEnabled,
      maxFileSizeBytes: policy.maxFileSizeBytes,
      allowedExtensions: policy.allowedExtensions || []
    }
  });
}

async function restorePreviewPolicy(request, token, policy) {
  await request.put('/api/admin/settings/file-preview', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      enabled: policy.enabled,
      imageEnabled: policy.imageEnabled,
      videoEnabled: policy.videoEnabled,
      audioEnabled: policy.audioEnabled,
      pdfEnabled: policy.pdfEnabled,
      textEnabled: policy.textEnabled,
      officeEnabled: policy.officeEnabled,
      allowedExtensions: policy.allowedExtensions || []
    }
  });
}

function toMegabytes(bytes) {
  return bytes / (1024 * 1024);
}

test.describe('Admin upload and preview settings', () => {
  test('saves upload and preview policy changes and restores original values', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const originalUploadPolicy = await getUploadPolicy(request, token);
    const originalPreviewPolicy = await getPreviewPolicy(request, token);

    const hardMaxBytes = originalUploadPolicy.hardMaxFileSizeBytes || -1;
    const currentMaxBytes = originalUploadPolicy.maxFileSizeBytes > 0 ? originalUploadPolicy.maxFileSizeBytes : 0;
    const candidateMaxBytes = currentMaxBytes === 8 * 1024 * 1024 ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
    const nextMaxBytes = hardMaxBytes > 0 ? Math.min(candidateMaxBytes, hardMaxBytes) : candidateMaxBytes;
    const nextMaxMb = Math.max(1, toMegabytes(nextMaxBytes));

    const nextUploadExtensions = ['pdf', 'png'];
    const nextPreviewExtensions = ['pdf', 'txt'];

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="upload-preview"]').click();
      await expect(page.locator('.admin-page[data-page="upload-preview"].active')).toBeVisible();

      const guestUploadCheckbox = page.locator('#guestUploadEnabled');
      const uploadLimitCheckbox = page.locator('#uploadSizeLimitEnabled');
      const uploadMaxInput = page.locator('#uploadMaxFileSizeMb');
      const uploadExtensions = page.locator('#uploadAllowedExtensions');
      const previewEnabled = page.locator('#previewEnabled');
      const previewTextEnabled = page.locator('#previewTextEnabled');
      const previewExtensions = page.locator('#previewAllowedExtensions');

      await expect(guestUploadCheckbox).toBeVisible();
      await expect(previewEnabled).toBeVisible();

      await guestUploadCheckbox.setChecked(!originalUploadPolicy.guestUploadEnabled);
      await uploadLimitCheckbox.setChecked(true);
      await expect(uploadMaxInput).toBeEnabled();
      await uploadMaxInput.fill(String(nextMaxMb));
      await uploadExtensions.fill(nextUploadExtensions.join('\n'));

      const saveUploadPromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/settings/file-upload')
          && response.request().method() === 'PUT';
      });
      await page.locator('.admin-page[data-page="upload-preview"] .action-btn').first().click();
      const saveUploadResponse = await saveUploadPromise;
      expect(saveUploadResponse.ok()).toBeTruthy();
      expect((await saveUploadResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const current = await getUploadPolicy(request, token);
        return JSON.stringify({
          guestUploadEnabled: current.guestUploadEnabled,
          maxFileSizeBytes: current.maxFileSizeBytes,
          allowedExtensions: current.allowedExtensions || []
        });
      }).toBe(JSON.stringify({
        guestUploadEnabled: !originalUploadPolicy.guestUploadEnabled,
        maxFileSizeBytes: Math.round(nextMaxMb * 1024 * 1024),
        allowedExtensions: nextUploadExtensions
      }));

      await previewEnabled.setChecked(!originalPreviewPolicy.enabled);
      await previewTextEnabled.setChecked(!originalPreviewPolicy.textEnabled);
      await previewExtensions.fill(nextPreviewExtensions.join('\n'));

      const savePreviewPromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/settings/file-preview')
          && response.request().method() === 'PUT';
      });
      await page.locator('.admin-page[data-page="upload-preview"] .action-btn').nth(1).click();
      const savePreviewResponse = await savePreviewPromise;
      expect(savePreviewResponse.ok()).toBeTruthy();
      expect((await savePreviewResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const current = await getPreviewPolicy(request, token);
        return JSON.stringify({
          enabled: current.enabled,
          textEnabled: current.textEnabled,
          allowedExtensions: current.allowedExtensions || []
        });
      }).toBe(JSON.stringify({
        enabled: !originalPreviewPolicy.enabled,
        textEnabled: !originalPreviewPolicy.textEnabled,
        allowedExtensions: nextPreviewExtensions
      }));
    } finally {
      await restoreUploadPolicy(request, token, originalUploadPolicy);
      await restorePreviewPolicy(request, token, originalPreviewPolicy);
    }
  });
});
