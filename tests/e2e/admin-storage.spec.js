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

async function getStoragePolicy(request, token) {
  const response = await request.get('/api/admin/settings/storage', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function getHealthStatus(request) {
  const response = await request.get('/api/health');
  return readJson(response);
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) ? `${numeric}%` : `${numeric.toFixed(1)}%`;
}

function getPercentPattern() {
  return /\d+(\.\d)?%/;
}

function getRiskLabelPattern(level) {
  switch (level) {
    case 'critical':
      return /(Critical|空间紧张)/;
    case 'warning':
      return /(Watch closely|需要关注)/;
    case 'healthy':
      return /(Healthy|空间充足)/;
    default:
      return /(Unknown|状态未知)/;
  }
}

function getRiskHintPattern(level) {
  switch (level) {
    case 'critical':
      return /(critical range|高风险区间)/;
    case 'warning':
      return /(warning range|关注区间)/;
    default:
      return /(watch free space|关注可用空间)/;
  }
}

test.describe('Admin storage settings', () => {
  test('renders runtime summary, toggles storage fields, saves current type, and tests connection', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const originalPolicy = await getStoragePolicy(request, token);
    const healthStatus = await getHealthStatus(request);

    await seedSession(page, token, user);
    await page.goto(`${baseURL}${entryPath}`);

    const overviewCards = page.locator('#overviewCards');
    if (originalPolicy.type === 'local') {
      await expect(overviewCards.locator('[data-overview-card="storage-risk"]')).toContainText(getRiskLabelPattern(originalPolicy.localDiskRiskLevel));
      await expect(overviewCards.locator('[data-overview-card="storage-risk"]')).toContainText(getPercentPattern());
      await expect(overviewCards.locator('[data-overview-card="storage-risk"]')).toContainText(originalPolicy.localUploadDir);
    } else {
      await expect(overviewCards.locator('[data-overview-card="storage-runtime"]')).toBeVisible();
    }

    await page.locator('.admin-sidebar-nav a[data-nav="storage"]').click();
    await expect(page.locator('.admin-page[data-page="storage"].active')).toBeVisible();

    const runtimeSummary = page.locator('#storageRuntimeSummary');
    const runtimeHint = page.locator('#storageRuntimeHint');
    const storageTypeSelect = page.locator('#storageType');
    const s3Fields = page.locator('#s3Fields');

    await expect(runtimeSummary).toContainText(originalPolicy.type === 's3' ? 'S3' : 'Local');
    if (originalPolicy.type === 'local') {
      expect(healthStatus.storage).toBe('local');
      expect(healthStatus.storageUploadDir).toBe(originalPolicy.localUploadDir);
      expect(healthStatus.storageDiskRiskLevel).toBe(originalPolicy.localDiskRiskLevel);

      await expect(runtimeSummary).toContainText(originalPolicy.localUploadDir);
      await expect(runtimeSummary.locator('[data-runtime-card="local-risk"]')).toContainText(getRiskLabelPattern(originalPolicy.localDiskRiskLevel));
      await expect(runtimeSummary.locator('[data-runtime-card="local-risk"]')).toContainText(getPercentPattern());
      await expect(runtimeSummary.locator('[data-runtime-card="local-risk"] [data-risk-level]')).toHaveAttribute(
        'data-risk-level',
        originalPolicy.localDiskRiskLevel || 'unknown'
      );
      await expect(runtimeHint).toContainText(getRiskHintPattern(originalPolicy.localDiskRiskLevel));
      await expect(storageTypeSelect).toHaveValue('local');
      await expect(s3Fields).toBeHidden();

      await storageTypeSelect.selectOption('s3');
      await expect(s3Fields).toBeVisible();
      await expect(runtimeSummary.locator('[data-runtime-card="local-risk"]')).toContainText(getPercentPattern());
      await storageTypeSelect.selectOption('local');
      await expect(s3Fields).toBeHidden();
    } else {
      expect(healthStatus.storage).toBe('s3');
      await expect(runtimeSummary).toContainText(originalPolicy.s3Bucket || '-');
      await expect(runtimeSummary.locator('[data-runtime-card="local-risk"]')).toHaveCount(0);
      await expect(storageTypeSelect).toHaveValue('s3');
      await expect(s3Fields).toBeVisible();

      await storageTypeSelect.selectOption('local');
      await expect(s3Fields).toBeHidden();
      await storageTypeSelect.selectOption('s3');
      await expect(s3Fields).toBeVisible();
    }

    const saveResponsePromise = page.waitForResponse(response => {
      return response.url().endsWith('/api/admin/settings/storage')
        && response.request().method() === 'PUT';
    });
    await page.locator('.admin-page[data-page="storage"] .action-group .action-btn').first().click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();
    const saveResult = await saveResponse.json();
    expect(saveResult.code).toBe(200);

    await expect.poll(async () => {
      const current = await getStoragePolicy(request, token);
      return current.type;
    }).toBe(originalPolicy.type);

    const testConnectionPromise = page.waitForResponse(response => {
      return response.url().endsWith('/api/admin/settings/storage/test')
        && response.request().method() === 'POST';
    });
    await page.locator('.admin-page[data-page="storage"] .action-group .action-btn').nth(1).click();
    const testConnectionResponse = await testConnectionPromise;
    expect(testConnectionResponse.ok()).toBeTruthy();
    const testConnectionResult = await testConnectionResponse.json();
    expect(testConnectionResult.code).toBe(200);
    if (originalPolicy.type === 'local') {
      expect(testConnectionResult.data).toBe('local');
    } else {
      expect(typeof testConnectionResult.data).toBe('string');
      expect(testConnectionResult.data.length).toBeGreaterThan(0);
    }
  });
});
