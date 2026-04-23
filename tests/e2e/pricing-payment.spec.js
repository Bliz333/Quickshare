const crypto = require('crypto');
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

async function getAdminProviders(request, token) {
  return readJson(await request.get('/api/admin/payment-providers', {
    headers: { Authorization: `Bearer ${token}` }
  }));
}

async function getAdminOrders(request, token) {
  return readJson(await request.get('/api/admin/orders', {
    headers: { Authorization: `Bearer ${token}` }
  }));
}

async function getMyOrder(request, token, orderNo) {
  return readJson(await request.get(`/api/payment/order/${orderNo}`, {
    headers: { Authorization: `Bearer ${token}` }
  }));
}

async function getProfile(request, token) {
  return readJson(await request.get('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  }));
}

async function createPlan(request, token, payload) {
  return readJson(await request.post('/api/admin/plans', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  }));
}

async function createProvider(request, token, payload) {
  return readJson(await request.post('/api/admin/payment-providers', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload
  }));
}

async function deleteOrderIfExists(request, token, orderId) {
  if (!orderId) return;

  const orders = await getAdminOrders(request, token);
  const current = orders.find(order => order.id === orderId);
  if (!current) return;

  if (current.status === 'paid') {
    const refundResponse = await request.put(`/api/admin/orders/${orderId}/mark-refunded`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(refundResponse.ok()).toBeTruthy();
  }

  const deleteResponse = await request.delete(`/api/admin/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(deleteResponse.ok()).toBeTruthy();
}

async function deleteProviderIfExists(request, token, providerId) {
  if (!providerId) return;
  const response = await request.delete(`/api/admin/payment-providers/${providerId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(response.ok()).toBeTruthy();
}

async function deletePlanIfExists(request, token, planId) {
  if (!planId) return;
  const response = await request.delete(`/api/admin/plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(response.ok()).toBeTruthy();
}

function generateNotifySign(params, merchantKey) {
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));

  const signBase = sortedEntries.map(([key, value]) => `${key}=${value}`).join('&') + merchantKey;
  return crypto.createHash('md5').update(signBase).digest('hex');
}

test.describe('Pricing and payment pages', () => {
  test('pricing page renders plans, payment availability, and current order history', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const plans = await readJson(await request.get('/api/public/plans'));
    const paymentOptions = await readJson(await request.get('/api/public/payment-options'));
    const orders = await readJson(await request.get('/api/payment/orders', {
      headers: { Authorization: `Bearer ${token}` }
    }));

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/pricing.html`);

    await expect(page.locator('#plansGrid .plan-card')).toHaveCount(plans.length);
    await expect(page.locator('#ordersList .order-card')).toHaveCount(orders.length);

    const buyButtons = page.locator('#plansGrid .buy-btn');
    if (paymentOptions) {
      await expect(buyButtons.first()).toBeEnabled();
    } else {
      await expect(buyButtons.first()).toBeDisabled();
      await expect(page.locator('#paymentOptionsNotice')).toContainText(/支付|payment/i);
    }

    if (orders.length > 0) {
      await expect(page.locator('#ordersList')).toContainText(orders[0].orderNo);
      await expect(page.locator('#ordersList')).toContainText(orders[0].planName);
    }
  });

  test('payment result page renders order details and status for a paid order', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const mockedOrder = {
      orderNo: 'QS-RESULT-E2E',
      planName: 'E2E Result Plan',
      amount: 19.99,
      status: 'paid'
    };

    await page.route('**/api/payment/order/QS-RESULT-E2E', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: mockedOrder
        })
      });
    });

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/payment-result.html?order_no=${encodeURIComponent(mockedOrder.orderNo)}`);

    await expect(page.locator('#resultContent')).toContainText(mockedOrder.orderNo);
    await expect(page.locator('#resultContent')).toContainText(mockedOrder.planName);
    await expect(page.locator('.result-icon')).toHaveClass(/success/);
  });

  test('payment result page shows no-order fallback when order number is missing', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/payment-result.html`);

    await expect(page.locator('#resultContent')).toContainText(/订单|order/i);
    await expect(page.locator('#resultContent a[href="netdisk.html"]')).toBeVisible();
  });

  test('payment result page auto-polls pending order until paid', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    let pollCount = 0;

    await page.route('**/api/payment/order/QS-PENDING-E2E', async route => {
      pollCount += 1;
      const payload = pollCount === 1
        ? {
            code: 200,
            message: 'success',
            data: {
              orderNo: 'QS-PENDING-E2E',
              planName: 'E2E Pending Plan',
              amount: 9.99,
              status: 'pending'
            }
          }
        : {
            code: 200,
            message: 'success',
            data: {
              orderNo: 'QS-PENDING-E2E',
              planName: 'E2E Pending Plan',
              amount: 9.99,
              status: 'paid'
            }
          };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload)
      });
    });

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/payment-result.html?order_no=QS-PENDING-E2E`);

    await expect(page.locator('.result-icon')).toHaveClass(/pending/);
    await expect(page.locator('#paymentRefreshBtn')).toBeVisible();
    await expect(page.locator('#paymentResultMeta')).toBeVisible();

    await expect.poll(async () => pollCount, { timeout: 10000 }).toBeGreaterThan(1);
    await expect(page.locator('.result-icon')).toHaveClass(/success/);
    await expect(page.locator('#resultContent')).toContainText('QS-PENDING-E2E');
    await expect(page.locator('#paymentRefreshBtn')).toHaveCount(0);
  });

  test('payment result page manual refresh updates a pending order to refunded', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    let requestCount = 0;

    await page.route('**/api/payment/order/QS-MANUAL-E2E', async route => {
      requestCount += 1;
      const status = requestCount === 1 ? 'pending' : 'refunded';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            orderNo: 'QS-MANUAL-E2E',
            planName: 'E2E Manual Refresh Plan',
            amount: 9.99,
            status
          }
        })
      });
    });

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/payment-result.html?order_no=QS-MANUAL-E2E`);

    const refreshButton = page.locator('#paymentRefreshBtn');
    await expect(page.locator('.result-icon')).toHaveClass(/pending/);
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    await expect.poll(() => requestCount).toBeGreaterThan(1);
    await expect(page.locator('.result-icon')).toHaveClass(/refunded/);
    await expect(page.locator('#resultContent')).toContainText('QS-MANUAL-E2E');
    await expect(refreshButton).toHaveCount(0);
  });

  test('pricing page opens pay modal and redirects after create-order success', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const plans = await readJson(await request.get('/api/public/plans'));
    expect(plans.length).toBeGreaterThan(0);

    let createOrderPayload = null;

    await page.route('**/api/public/payment-options', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            providerId: 88,
            providerName: 'E2E Provider',
            payTypes: ['alipay', 'wxpay']
          }
        })
      });
    });

    await page.route('**/api/payment/create', async route => {
      createOrderPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            redirectUrl: `${baseURL}/payment-result.html?order_no=QS-E2E-REDIRECT`
          }
        })
      });
    });

    await page.route('**/api/payment/order/QS-E2E-REDIRECT', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            orderNo: 'QS-E2E-REDIRECT',
            planName: plans[0].name,
            amount: plans[0].price,
            status: 'pending'
          }
        })
      });
    });

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/pricing.html`);

    const firstBuyButton = page.locator('#plansGrid .buy-btn').first();
    await expect(firstBuyButton).toBeEnabled();
    await firstBuyButton.click();

    await expect(page.locator('#payModal')).toBeVisible();
    await expect(page.locator('#payOptions .pay-option')).toHaveCount(2);

    await page.locator('#payOptions .pay-option').nth(1).click();
    await page.locator('#confirmPayBtn').click();

    await expect.poll(() => createOrderPayload).not.toBeNull();
    expect(createOrderPayload.planId).toBe(plans[0].id);
    expect(createOrderPayload.providerId).toBe(88);
    expect(createOrderPayload.payType).toBe('wxpay');

    await page.waitForURL('**/payment-result.html?order_no=QS-E2E-REDIRECT');
    await expect(page.locator('#resultContent')).toContainText('QS-E2E-REDIRECT');
    await expect(page.locator('.result-icon')).toHaveClass(/pending/);
  });

  test('payment create returns a redirect URL with localhost callback parameters', async ({ request, baseURL }) => {
    const { token } = await loginAsAdmin(request);
    const stamp = Date.now();
    let planId = null;
    let providerId = null;
    let orderId = null;

    try {
      const plan = await createPlan(request, token, {
        name: `E2E Redirect Plan ${stamp}`,
        description: 'Created for redirect URL test',
        type: 'storage',
        value: 1024,
        price: 1.23,
        sortOrder: 997,
        status: 1
      });
      planId = plan.id;

      const provider = await createProvider(request, token, {
        name: `E2E Redirect Provider ${stamp}`,
        apiUrl: `https://redirect-${stamp}.example.com`,
        pid: `redirect-pid-${stamp}`,
        merchantKey: `redirect-key-${stamp}`,
        payTypes: 'alipay,wxpay',
        enabled: 1,
        sortOrder: 997
      });
      providerId = provider.id;

      const createData = await readJson(await request.post('/api/payment/create', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          planId,
          providerId,
          payType: 'alipay',
          returnUrl: `${baseURL}/payment-result.html`
        }
      }));

      expect(createData.redirectUrl).toBeTruthy();
      expect(createData.redirectUrl.startsWith(`${provider.apiUrl}/submit.php?`)).toBeTruthy();

      const redirect = new URL(createData.redirectUrl);
      expect(redirect.searchParams.get('pid')).toBe(provider.pid);
      expect(redirect.searchParams.get('type')).toBe('alipay');
      expect(redirect.searchParams.get('notify_url')).toBe(`${baseURL}/api/payment/notify`);
      expect(redirect.searchParams.get('return_url')).toBe(`${baseURL}/payment-result.html`);
      expect(redirect.searchParams.get('name')).toBeTruthy();
      expect(redirect.searchParams.get('money')).toBeTruthy();
      expect(redirect.searchParams.get('sign')).toBeTruthy();
      expect(redirect.searchParams.get('sign_type')).toBe('MD5');

      const orderNo = redirect.searchParams.get('out_trade_no');
      expect(orderNo).toBeTruthy();

      const order = await getMyOrder(request, token, orderNo);
      expect(order).toBeTruthy();
      expect(order.status).toBe('pending');
      orderId = order.id;
    } finally {
      await deleteOrderIfExists(request, token, orderId);
      await deleteProviderIfExists(request, token, providerId);
      await deletePlanIfExists(request, token, planId);
    }
  });

  test('signed local notify drives an order to paid and refunded with quota rollback', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const profileBefore = await getProfile(request, token);
    const stamp = Date.now();

    let planId = null;
    let providerId = null;
    let orderId = null;
    let orderNo = null;

    try {
      const plan = await createPlan(request, token, {
        name: `E2E Notify Plan ${stamp}`,
        description: 'Created for notify flow test',
        type: 'storage',
        value: 2048,
        price: 0.88,
        sortOrder: 998,
        status: 1
      });
      planId = plan.id;

      const provider = await createProvider(request, token, {
        name: `E2E Notify Provider ${stamp}`,
        apiUrl: `https://notify-${stamp}.example.com`,
        pid: `notify-pid-${stamp}`,
        merchantKey: `notify-key-${stamp}`,
        payTypes: 'alipay',
        enabled: 1,
        sortOrder: 998
      });
      providerId = provider.id;

      const createData = await readJson(await request.post('/api/payment/create', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          planId,
          providerId,
          payType: 'alipay',
          returnUrl: `${baseURL}/payment-result.html`
        }
      }));

      const redirect = new URL(createData.redirectUrl);
      orderNo = redirect.searchParams.get('out_trade_no');
      expect(orderNo).toBeTruthy();

      const pendingOrder = await getMyOrder(request, token, orderNo);
      expect(pendingOrder.status).toBe('pending');
      orderId = pendingOrder.id;

      const notifyParams = {
        money: '0.88',
        out_trade_no: orderNo,
        pid: `notify-pid-${stamp}`,
        trade_no: `TRADE-${stamp}`,
        trade_status: 'TRADE_SUCCESS'
      };
      const sign = generateNotifySign(notifyParams, `notify-key-${stamp}`);
      const notifyResponse = await request.post('/api/payment/notify', {
        form: {
          ...notifyParams,
          sign,
          sign_type: 'MD5'
        }
      });
      expect(await notifyResponse.text()).toBe('success');

      await expect.poll(async () => {
        const current = await getMyOrder(request, token, orderNo);
        return current?.status || null;
      }).toBe('paid');

      await expect.poll(async () => {
        const profile = await getProfile(request, token);
        return profile.storageLimit;
      }).toBe((profileBefore.storageLimit || 0) + 2048);

      await seedSession(page, token, user);
      await page.goto(`${baseURL}/payment-result.html?order_no=${encodeURIComponent(orderNo)}`);
      await expect(page.locator('.result-icon')).toHaveClass(/success/);
      await expect(page.locator('#resultContent')).toContainText(orderNo);

      const refundResponse = await request.put(`/api/admin/orders/${orderId}/mark-refunded`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      expect(refundResponse.ok()).toBeTruthy();
      expect((await refundResponse.json()).code).toBe(200);

      await expect.poll(async () => {
        const current = await getMyOrder(request, token, orderNo);
        return current?.status || null;
      }).toBe('refunded');

      await expect.poll(async () => {
        const profile = await getProfile(request, token);
        return profile.storageLimit;
      }).toBe(profileBefore.storageLimit);

      await page.goto(`${baseURL}/payment-result.html?order_no=${encodeURIComponent(orderNo)}`);
      await expect(page.locator('.result-icon')).toHaveClass(/refunded/);
      await expect(page.locator('#resultContent')).toContainText(orderNo);
    } finally {
      await deleteOrderIfExists(request, token, orderId);
      await deleteProviderIfExists(request, token, providerId);
      await deletePlanIfExists(request, token, planId);
    }
  });
});
