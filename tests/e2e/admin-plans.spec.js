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

async function getPlans(request, token) {
  const response = await request.get('/api/admin/plans', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function deletePlanIfExists(request, token, planId) {
  if (!planId) {
    return;
  }

  await request.delete(`/api/admin/plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function cleanupE2EPlans(request, token) {
  const plans = await getPlans(request, token);
  for (const plan of plans) {
    if (String(plan.name || '').startsWith('E2E Plan')) {
      await deletePlanIfExists(request, token, plan.id);
    }
  }
}

function planRow(page, name) {
  return page.locator('#plansTableBody tr').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

test.describe('Admin plan settings', () => {
  test('creates, edits, and deletes a plan through the admin UI', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    await cleanupE2EPlans(request, token);
    const originalPlans = await getPlans(request, token);
    const stamp = Date.now();
    const createdName = `E2E Plan ${stamp}`;
    const updatedName = `E2E Plan Updated ${stamp}`;

    let createdPlanId = null;

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="plans"]').click();
      await expect(page.locator('.admin-page[data-page="plans"].active')).toBeVisible();

      await page.locator('#planName').fill(createdName);
      await page.locator('#planDescription').fill('Created by Playwright');
      await page.locator('#planType').selectOption('downloads');
      await page.locator('#planValue').fill('25');
      await page.locator('#planPrice').fill('3.50');
      await page.locator('#planSortOrder').fill('77');
      await page.locator('#planStatus').setChecked(false);

      const createResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/admin/plans')
          && response.request().method() === 'POST';
      });
      await page.locator('#planSaveBtn').click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      const createdPlan = await readJson(createResponse);
      createdPlanId = createdPlan.id;
      expect(createdPlanId).toBeTruthy();

      await expect.poll(async () => {
        const plans = await getPlans(request, token);
        const current = plans.find(plan => plan.id === createdPlanId);
        return JSON.stringify({
          name: current?.name,
          type: current?.type,
          value: current?.value,
          price: current?.price,
          sortOrder: current?.sortOrder,
          status: current?.status
        });
      }).toBe(JSON.stringify({
        name: createdName,
        type: 'downloads',
        value: 25,
        price: 3.5,
        sortOrder: 77,
        status: 0
      }));

      await expect(page.locator('#plansCountBadge')).toHaveText(String(originalPlans.length + 1));
      const createdRow = planRow(page, createdName);
      await expect(createdRow).toBeVisible();

      const editResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/plans/${createdPlanId}`)
          && response.request().method() === 'PUT';
      });
      await createdRow.locator('button.action-btn').first().click();
      await expect(page.locator('#planCancelBtn')).not.toHaveClass(/hidden/);
      await page.locator('#planName').fill(updatedName);
      await page.locator('#planDescription').fill('Updated by Playwright');
      await page.locator('#planType').selectOption('vip');
      await page.locator('#planValue').fill('45');
      await page.locator('#planPrice').fill('8.80');
      await page.locator('#planSortOrder').fill('12');
      await page.locator('#planStatus').setChecked(true);
      await page.locator('#planSaveBtn').click();
      const editResponse = await editResponsePromise;
      expect(editResponse.ok()).toBeTruthy();
      await readJson(editResponse);

      await expect.poll(async () => {
        const plans = await getPlans(request, token);
        const current = plans.find(plan => plan.id === createdPlanId);
        return JSON.stringify({
          name: current?.name,
          type: current?.type,
          value: current?.value,
          price: current?.price,
          sortOrder: current?.sortOrder,
          status: current?.status
        });
      }).toBe(JSON.stringify({
        name: updatedName,
        type: 'vip',
        value: 45,
        price: 8.8,
        sortOrder: 12,
        status: 1
      }));

      const updatedRow = planRow(page, updatedName);
      await expect(updatedRow).toBeVisible();
      await expect(page.locator('#planCancelBtn')).toHaveClass(/hidden/);

      const deleteResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/plans/${createdPlanId}`)
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
        const plans = await getPlans(request, token);
        return plans.some(plan => plan.id === createdPlanId);
      }).toBe(false);

      await expect(updatedRow).toHaveCount(0);
      await expect(page.locator('#plansCountBadge')).toHaveText(String(originalPlans.length));
      createdPlanId = null;
    } finally {
      await deletePlanIfExists(request, token, createdPlanId);
      await cleanupE2EPlans(request, token);
    }
  });
});
