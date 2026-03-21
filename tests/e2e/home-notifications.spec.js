const { test, expect } = require('@playwright/test');

test.describe('Home notifications panel', () => {
  test('keeps notifications collapsed for anonymous visitors until the bell icon is clicked', async ({ page, baseURL }) => {
    await page.route('**/api/public/notifications?limit=12', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            {
              id: 1,
              scope: 'all',
              subject: 'Global Notice E2E',
              body: 'Visible for everyone.',
              createTime: '2026-03-20T12:00:00'
            }
          ]
        })
      });
    });

    await page.goto(`${baseURL}/index.html`);

    await expect(page.locator('#homeNotificationButton')).toBeVisible();
    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#homeNotificationBadge')).toBeHidden();

    await page.locator('#homeNotificationButton').click();
    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#homeNoticeList')).toContainText('Global Notice E2E');
    await expect(page.locator('#homeNoticeList')).toContainText('Visible for everyone.');
    await expect(page.locator('#homeNoticeTabPersonal')).toBeHidden();
    await expect(page.locator('#homeNoticeLoginHint')).toBeVisible();

    await page.locator('#homeNoticeCloseBtn').click();
    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'true');
  });

  test('auto-opens the notification center for logged-in users when newer notifications arrive', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
      localStorage.setItem('quickshare-home-notifications-seen:user:1', JSON.stringify({
        all: 'all:1',
        personal: 'personal:1'
      }));
    });

    await page.route('**/api/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 1,
            username: 'admin',
            nickname: 'QuickShare Admin',
            role: 'ADMIN',
            storageLimit: 1073741824,
            storageUsed: 0,
            downloadLimit: -1,
            downloadUsed: 0,
            vipExpireTime: null
          }
        })
      });
    });

    await page.route('**/api/public/notifications?limit=12', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            {
              id: 10,
              scope: 'all',
              subject: 'Global Notice E2E Logged',
              body: 'Shared with all users.',
              createTime: '2026-03-20T12:00:00'
            }
          ]
        })
      });
    });

    await page.route('**/api/notifications/personal?limit=12', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            {
              id: 11,
              scope: 'personal',
              subject: 'Personal Notice E2E',
              body: 'Visible only to the current user.',
              createTime: '2026-03-20T13:00:00'
            }
          ]
        })
      });
    });

    await page.goto(`${baseURL}/index.html`);

    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#homeNoticeTabPersonal')).toBeVisible();
    await expect(page.locator('#homeNoticeLoginHint')).toBeHidden();
    await expect(page.locator('#homeNoticeTabPersonal')).toHaveClass(/active/);
    await expect(page.locator('#homeNoticeList')).toContainText('Personal Notice E2E');
    await expect(page.locator('#homeNoticeList')).toContainText('Visible only to the current user.');
    await expect(page.locator('#homeNotificationBadge')).toBeVisible();
    await expect(page.locator('#homeNotificationBadge')).toHaveText('2');
    await expect(page.locator('#homeNoticeMarkAllBtn')).toBeVisible();

    await page.locator('[data-home-notice-mark-read="true"]').click();
    await expect(page.locator('#homeNoticeList')).toContainText('Read');
    await expect(page.locator('#homeNotificationBadge')).toHaveText('1');

    await page.locator('#homeNoticeTabAll').click();
    await expect(page.locator('#homeNoticeTabAll')).toHaveClass(/active/);
    await expect(page.locator('#homeNoticeList')).toContainText('Global Notice E2E Logged');
    await page.locator('#homeNoticeMarkAllBtn').click();
    await expect(page.locator('#homeNotificationBadge')).toBeHidden();
    await expect(page.locator('#homeNoticeMarkAllBtn')).toBeHidden();

    await page.locator('#homeNoticeCloseBtn').click();
    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#homeNotificationBadge')).toBeHidden();
  });

  test('keeps the top action cluster usable on mobile screens', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.route('**/api/public/notifications?limit=12', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: []
        })
      });
    });

    await page.goto(`${baseURL}/index.html`);

    await expect(page.locator('.top-buttons')).toBeVisible();
    await expect(page.locator('#homeNotificationButton')).toBeVisible();
    await expect(page.locator('#langBtn')).toBeVisible();

    const actionBox = await page.locator('.top-buttons').boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox.width).toBeLessThan(240);

    await page.locator('#homeNotificationButton').click();
    await expect(page.locator('#homeNotificationsPanel')).toHaveAttribute('aria-hidden', 'false');
  });

  test('supports show-more pagination and long-body expand/collapse', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('quickshare-lang', 'en');
    });

    await page.route('**/api/public/notifications?limit=12', async route => {
      const longBody = 'This is a very long notification body. '.repeat(16);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            { id: 101, scope: 'all', subject: 'Notice 1', body: longBody, createTime: '2026-03-21T10:00:00' },
            { id: 102, scope: 'all', subject: 'Notice 2', body: 'Body 2', createTime: '2026-03-21T09:00:00' },
            { id: 103, scope: 'all', subject: 'Notice 3', body: 'Body 3', createTime: '2026-03-21T08:00:00' },
            { id: 104, scope: 'all', subject: 'Notice 4', body: 'Body 4', createTime: '2026-03-21T07:00:00' },
            { id: 105, scope: 'all', subject: 'Notice 5', body: 'Body 5', createTime: '2026-03-21T06:00:00' },
            { id: 106, scope: 'all', subject: 'Notice 6', body: 'Body 6', createTime: '2026-03-21T05:00:00' }
          ]
        })
      });
    });

    await page.goto(`${baseURL}/index.html`);
    await page.locator('#homeNotificationButton').click();

    await expect(page.locator('#homeNoticeList .home-notice-item')).toHaveCount(4);
    await expect(page.locator('#homeNoticeMoreBtn')).toBeVisible();
    await expect(page.locator('#homeNoticeMoreBtn')).toContainText('2');

    const firstBody = page.locator('#homeNoticeList .home-notice-body').first();
    await expect(firstBody).toHaveClass(/collapsed/);
    await page.locator('[data-home-notice-toggle-body="true"]').first().click();
    await expect(firstBody).not.toHaveClass(/collapsed/);
    await expect(page.locator('[data-home-notice-toggle-body="true"]').first()).toHaveText('Collapse');

    await page.locator('#homeNoticeMoreBtn').click();
    await expect(page.locator('#homeNoticeList .home-notice-item')).toHaveCount(6);
    await expect(page.locator('#homeNoticeMoreBtn')).toBeHidden();
  });
});
