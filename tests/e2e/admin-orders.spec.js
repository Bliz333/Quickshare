const { test, expect } = require('@playwright/test');

async function readJson(response) {
  const body = await response.json();
  expect(body.code, `unexpected response body: ${JSON.stringify(body)}`).toBe(200);
  return body.data;
}

async function login(request, username, password) {
  const response = await request.post('/api/auth/login', {
    data: { username, password }
  });
  expect(response.ok()).toBeTruthy();
  return readJson(response);
}

async function loginAsAdmin(request) {
  const username = process.env.E2E_ADMIN_USERNAME || 'admin';
  const password = process.env.E2E_ADMIN_PASSWORD || 'ChangeMeAdmin123!';
  const user = await login(request, username, password);
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

async function getAdminOrders(request, token) {
  const response = await request.get('/api/admin/orders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function getProfile(request, token) {
  const response = await request.get('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function createPlan(request, token, payload) {
  const response = await request.post('/api/admin/plans', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  return readJson(response);
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
    if (String(plan.name || '').startsWith('E2E Order Plan')) {
      await deletePlanIfExists(request, token, plan.id);
    }
  }
}

async function createProvider(request, token, payload) {
  const response = await request.post('/api/admin/payment-providers', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  return readJson(response);
}

async function getPaymentProviders(request, token) {
  const response = await request.get('/api/admin/payment-providers', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function deleteProviderIfExists(request, token, providerId) {
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
    if (String(provider.name || '').startsWith('E2E Order Provider')) {
      await deleteProviderIfExists(request, token, provider.id);
    }
  }
}

async function createOrder(request, token, payload) {
  const response = await request.post('/api/payment/create', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  });
  const data = await readJson(response);
  expect(data.redirectUrl).toBeTruthy();
  return data;
}

async function deleteOrderIfExists(request, token, orderId) {
  if (!orderId) {
    return;
  }

  const orders = await getAdminOrders(request, token);
  const order = orders.find(item => item.id === orderId);
  if (!order) {
    return;
  }

  if (order.status === 'paid') {
    await request.put(`/api/admin/orders/${orderId}/mark-refunded`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  await request.delete(`/api/admin/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function cleanupE2EOrders(request, token) {
  const orders = await getAdminOrders(request, token);
  const targetOrders = orders.filter(order => String(order.planName || '').startsWith('E2E Order Plan'));

  for (const order of targetOrders) {
    await deleteOrderIfExists(request, token, order.id);
  }
}

function orderRow(page, orderNo) {
  return page.locator('#ordersTableBody tr').filter({
    has: page.getByText(orderNo, { exact: true })
  }).first();
}

test.describe('Admin order management', () => {
  test('marks a pending order paid, refunds it, deletes it, and restores quota', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const entryPath = await getAdminConsolePath(request, token);
    const profileBefore = await getProfile(request, token);
    const stamp = Date.now();

    let planId = null;
    let providerId = null;
    let orderId = null;

    try {
      await cleanupE2EOrders(request, token);
      await cleanupE2EPlans(request, token);
      await cleanupE2EProviders(request, token);

      const plan = await createPlan(request, token, {
        name: `E2E Order Plan ${stamp}`,
        description: 'Created for admin order test',
        type: 'storage',
        value: 4096,
        price: 1.23,
        sortOrder: 91,
        status: 1
      });
      planId = plan.id;

      const provider = await createProvider(request, token, {
        name: `E2E Order Provider ${stamp}`,
        apiUrl: `https://order-${stamp}.example.com`,
        pid: `order-pid-${stamp}`,
        merchantKey: `order-key-${stamp}`,
        payTypes: 'alipay',
        enabled: 1,
        sortOrder: 91
      });
      providerId = provider.id;

      await createOrder(request, token, {
        planId,
        providerId,
        payType: 'alipay',
        returnUrl: `${baseURL}/payment-result.html`
      });

      const ordersAfterCreate = await getAdminOrders(request, token);
      const createdOrder = ordersAfterCreate.find(order => order.planId === planId && order.providerId === providerId);
      expect(createdOrder).toBeTruthy();
      expect(createdOrder.status).toBe('pending');
      orderId = createdOrder.id;

      await seedSession(page, token, user);
      await page.goto(`${baseURL}${entryPath}`);

      await page.locator('.admin-sidebar-nav a[data-nav="payment"]').click();
      await expect(page.locator('.admin-page[data-page="payment"].active')).toBeVisible();

      const pendingRow = orderRow(page, createdOrder.orderNo);
      await expect(pendingRow).toBeVisible();
      await expect(pendingRow).toContainText(/Pending|待支付/);

      const markPaidResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/orders/${orderId}/mark-paid`)
          && response.request().method() === 'PUT';
      });
      await pendingRow.getByRole('button', { name: /Mark Paid|标记已支付/i }).click();
      const paidDialog = page.getByRole('dialog');
      await expect(paidDialog).toBeVisible();
      await paidDialog.getByRole('button', { name: /Mark Paid|确认已支付/i }).click();
      const markPaidResponse = await markPaidResponsePromise;
      expect(markPaidResponse.ok()).toBeTruthy();
      expect((await markPaidResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const orders = await getAdminOrders(request, token);
        const current = orders.find(order => order.id === orderId);
        return current?.status || null;
      }).toBe('paid');

      await expect.poll(async () => {
        const profile = await getProfile(request, token);
        return profile.storageLimit;
      }).toBe((profileBefore.storageLimit || 0) + 4096);

      const paidRow = orderRow(page, createdOrder.orderNo);
      await expect(paidRow).toBeVisible();
      await expect(paidRow).toContainText(/Paid|已支付/);

      const refundResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/orders/${orderId}/mark-refunded`)
          && response.request().method() === 'PUT';
      });
      await paidRow.getByRole('button', { name: /Mark Refunded|标记退款/i }).click();
      const refundDialog = page.getByRole('dialog');
      await expect(refundDialog).toBeVisible();
      await refundDialog.getByRole('button', { name: /Confirm Refund|确认退款/i }).click();
      const refundResponse = await refundResponsePromise;
      expect(refundResponse.ok()).toBeTruthy();
      expect((await refundResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const orders = await getAdminOrders(request, token);
        const current = orders.find(order => order.id === orderId);
        return current?.status || null;
      }).toBe('refunded');

      await expect.poll(async () => {
        const profile = await getProfile(request, token);
        return profile.storageLimit;
      }).toBe(profileBefore.storageLimit);

      const refundedRow = orderRow(page, createdOrder.orderNo);
      await expect(refundedRow).toBeVisible();
      await expect(refundedRow).toContainText(/Refunded|已退款/);

      const deleteResponsePromise = page.waitForResponse(response => {
        return response.url().endsWith(`/api/admin/orders/${orderId}`)
          && response.request().method() === 'DELETE';
      });
      await refundedRow.getByRole('button', { name: /Delete Order|删除订单/i }).click();
      const deleteDialog = page.getByRole('dialog');
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: /Delete|删除/i }).click();
      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBeTruthy();
      expect((await deleteResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const orders = await getAdminOrders(request, token);
        return orders.some(order => order.id === orderId);
      }).toBe(false);

      await expect(refundedRow).toHaveCount(0);
      orderId = null;
    } finally {
      await deleteOrderIfExists(request, token, orderId);
      await deletePlanIfExists(request, token, planId);
      await deleteProviderIfExists(request, token, providerId);
      await cleanupE2EOrders(request, token);
      await cleanupE2EPlans(request, token);
      await cleanupE2EProviders(request, token);
    }
  });
});
