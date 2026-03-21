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

async function getRateLimitPolicies(request, token) {
  const response = await request.get('/api/admin/settings/rate-limits', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function restoreRateLimitPolicy(request, token, scene, policy) {
  await request.put(`/api/admin/settings/rate-limits/${scene}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      enabled: policy.enabled,
      maxRequests: policy.maxRequests,
      windowSeconds: policy.windowSeconds
    }
  });
}

function toSceneDomId(scene) {
  return String(scene || '').replace(/[^a-z0-9]+/ig, '-').toLowerCase();
}

test.describe('Admin rate limit settings', () => {
  test('renders all scenes, saves one policy, and restores original values', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const originalPolicies = await getRateLimitPolicies(request, token);
    const targetScene = 'public-download';
    const originalPolicy = originalPolicies.find(policy => policy.scene === targetScene);

    expect(originalPolicies.length).toBeGreaterThanOrEqual(4);
    expect(originalPolicy).toBeTruthy();

    const nextPolicy = {
      enabled: !originalPolicy.enabled,
      maxRequests: originalPolicy.maxRequests === 9 ? 6 : 9,
      windowSeconds: originalPolicy.windowSeconds === 180 ? 120 : 180
    };
    const targetSceneId = toSceneDomId(targetScene);

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="security"]').click();
      await expect(page.locator('.admin-page[data-page="security"].active')).toBeVisible();

      const tableBody = page.locator('#rateLimitTableBody');
      await expect(tableBody.locator('tr')).toHaveCount(originalPolicies.length);

      for (const policy of originalPolicies) {
        const sceneId = toSceneDomId(policy.scene);
        await expect(page.locator(`#rate-enabled-${sceneId}`)).toBeVisible();
        await expect(page.locator(`#rate-max-${sceneId}`)).toHaveValue(String(policy.maxRequests));
        await expect(page.locator(`#rate-window-${sceneId}`)).toHaveValue(String(policy.windowSeconds));
      }

      const enabledCheckbox = page.locator(`#rate-enabled-${targetSceneId}`);
      const maxRequestsInput = page.locator(`#rate-max-${targetSceneId}`);
      const windowSecondsInput = page.locator(`#rate-window-${targetSceneId}`);
      const saveButton = maxRequestsInput.locator('xpath=ancestor::tr').locator('button.action-btn');

      await enabledCheckbox.setChecked(nextPolicy.enabled);
      await maxRequestsInput.fill(String(nextPolicy.maxRequests));
      await windowSecondsInput.fill(String(nextPolicy.windowSeconds));

      const saveResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/settings/rate-limits/${targetScene}`)
          && response.request().method() === 'PUT';
      });
      await saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();
      expect((await saveResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const currentPolicies = await getRateLimitPolicies(request, token);
        const current = currentPolicies.find(policy => policy.scene === targetScene);
        return JSON.stringify({
          enabled: current.enabled,
          maxRequests: current.maxRequests,
          windowSeconds: current.windowSeconds
        });
      }).toBe(JSON.stringify(nextPolicy));

      await expect(page.locator(`#rate-max-${targetSceneId}`)).toHaveValue(String(nextPolicy.maxRequests));
      await expect(page.locator(`#rate-window-${targetSceneId}`)).toHaveValue(String(nextPolicy.windowSeconds));
      await expect(page.locator(`#rate-enabled-${targetSceneId}`)).toBeChecked({ checked: nextPolicy.enabled });
    } finally {
      await restoreRateLimitPolicy(request, token, targetScene, originalPolicy);
    }
  });
});
