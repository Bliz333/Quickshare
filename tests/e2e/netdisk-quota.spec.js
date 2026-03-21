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

async function getProfile(request, token) {
  const response = await request.get('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function seedSession(page, token, user) {
  await page.addInitScript(
    ({ storedToken, storedUser }) => {
      localStorage.setItem('token', storedToken);
      localStorage.setItem('user', JSON.stringify(storedUser));
      localStorage.setItem('quickshare-lang', 'en');
    },
    { storedToken: token, storedUser: user }
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const base = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(base));
  return `${Math.round((bytes / Math.pow(base, index)) * 100) / 100} ${sizes[index]}`;
}

function expectedStorageText(profile) {
  if (profile.storageLimit && profile.storageLimit > 0) {
    return `${formatFileSize(profile.storageUsed || 0)} / ${formatFileSize(profile.storageLimit)}`;
  }
  if (profile.storageUsed) {
    return `${formatFileSize(profile.storageUsed)} / Unlimited`;
  }
  return 'Unlimited';
}

function expectedDownloadText(profile) {
  const used = profile.downloadUsed || 0;
  const limit = profile.downloadLimit || 0;
  if (limit > 0) {
    return `${used} / ${limit}`;
  }
  return `${used} / Unlimited`;
}

function expectedStorageWidth(profile) {
  if (!(profile.storageLimit && profile.storageLimit > 0)) {
    return '0%';
  }
  const used = profile.storageUsed || 0;
  const percentage = Math.min(100, Math.round((used / profile.storageLimit) * 100));
  return `${percentage}%`;
}

test.describe('Netdisk quota sidebar', () => {
  test('renders current user quota, VIP status, and upgrade entry', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const profile = await getProfile(request, token);
    const vipText = await page.evaluate(currentProfile => {
      if (!currentProfile.vipExpireTime) {
        return 'No VIP';
      }

      const expireDate = new Date(currentProfile.vipExpireTime);
      if (expireDate > new Date()) {
        return `VIP Active → ${expireDate.toLocaleDateString('en-US')}`;
      }

      return 'VIP Expired';
    }, profile);

    await seedSession(page, token, user);
    await page.goto(`${baseURL}/netdisk.html`);

    await expect(page.locator('#listContent')).toBeVisible();
    await expect(page.locator('#quotaSection')).toBeVisible();
    await expect(page.locator('#userName')).toHaveText(profile.nickname || profile.username);
    await expect(page.locator('#userVipStatus')).toHaveText(vipText);
    await expect(page.locator('#quotaStorageText')).toHaveText(expectedStorageText(profile));
    await expect(page.locator('#quotaDownloadsText')).toHaveText(expectedDownloadText(profile));
    await expect
      .poll(async () => page.locator('#quotaStorageBar').evaluate(element => element.style.width))
      .toBe(expectedStorageWidth(profile));

    const upgradeEntry = page.locator('#quotaSection a[href="pricing.html"]');
    await expect(upgradeEntry).toBeVisible();
    await expect(upgradeEntry).toHaveText('Upgrade');
  });
});
