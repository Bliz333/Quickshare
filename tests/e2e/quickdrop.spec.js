const { test, expect } = require('@playwright/test');

async function stubQuickDropRealtime(page, { lang = 'en' } = {}) {
  await page.addInitScript(({ currentLang }) => {
    localStorage.setItem('quickshare-lang', currentLang);

    class FakeWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        super();
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'welcome',
              channelId: 'guest:test-device',
              label: 'Test Device'
            })
          }));
        }, 0);
      }

      send() {}

      close() {
        this.readyState = FakeWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }

    window.WebSocket = FakeWebSocket;
  }, { currentLang: lang });
}

async function gotoQuickDropPage(page, baseURL) {
  await page.goto(`${baseURL}/quickdrop.html`, { waitUntil: 'commit' });
  await expect(page.locator('#quickDropModeSwitch')).toBeVisible();
}

async function openQuickDropAccountHistory(page) {
  const panel = page.locator('#quickDropAccountHistoryPanel');
  if (await panel.isVisible()) {
    return;
  }
  await page.locator('#quickDropAccountHistoryToggle').click();
  await expect(page).toHaveURL(/#account-history$/);
  await expect(panel).toBeVisible();
}

async function openQuickDropDirectHistory(page) {
  const panel = page.locator('#quickDropDirectHistoryPanel');
  if (await panel.isVisible()) {
    return;
  }
  await page.locator('#quickDropDirectHistoryToggle').click();
  await expect(page).toHaveURL(/#temporary-history$/);
  await expect(panel).toBeVisible();
}

test.describe('QuickDrop pages', () => {
  test('guest can stay on quickdrop page and use temporary transfer without being redirected to login', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });

    await gotoQuickDropPage(page, baseURL);
    await expect(page).toHaveURL(/quickdrop\.html$/);
    await expect(page.locator('#quickDropSignalStatus')).toBeHidden();
    await expect(page.locator('#quickDropDirectChooseBtn')).toBeVisible();
    await expect(page.locator('#quickDropAccountPanels')).toBeHidden();
  });

  test('renders same-account device transfer view and saves incoming transfer to netdisk', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [
              {
                id: 12,
                senderDeviceId: 'device-b',
                receiverDeviceId: 'device-a',
                fileName: 'draft.pdf',
                fileSize: 2048,
                contentType: 'application/pdf',
                chunkSize: 1024,
                totalChunks: 2,
                uploadedChunks: 2,
                uploadedChunkIndexes: [0, 1],
                status: 'ready',
                ready: true,
                updateTime: '2026-03-21T10:00:00'
              }
            ],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            { id: 301, name: 'Projects' },
            { id: 302, name: 'Inbox' }
          ]
        })
      });
    });

    let saveCalled = false;
    let saveRequestFolderId = null;
    await page.route('**/api/quickdrop/transfers/12/save', async route => {
      saveCalled = true;
      saveRequestFolderId = route.request().postDataJSON()?.folderId ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 99,
            name: 'draft.pdf'
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropAccountHistory(page);

    await expect(page.locator('#quickDropDeviceList')).toContainText('My Laptop');
    await expect(page.locator('#quickDropSelectedDevice')).toHaveText('My Laptop');
    await expect(page.locator('#quickDropSaveFolderSelect')).toContainText('Projects');
    await expect(page.locator('#quickDropIncomingList')).toContainText('draft.pdf');
    await expect(page.locator('#quickDropIncomingList')).toContainText('Save to Netdisk');

    await page.locator('#quickDropSaveFolderSelect').selectOption('301');
    await page.locator('[data-quickdrop-save="12"]').click();
    await expect.poll(() => saveCalled).toBe(true);
    expect(saveRequestFolderId).toBe(301);
  });

  test('same-account history page uses hash navigation and browser back returns to the main stage', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropAccountHistory(page);
    await expect(page.locator('#quickDropHistoryPage')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/quickdrop\.html$/);
    await expect(page.locator('#quickDropHistoryPage')).toBeHidden();
    await expect(page.locator('#quickDropMainLayout')).toBeVisible();
  });

  test('same-account page auto-requests a direct session and prefers direct send when ready', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    let directSessionRequests = 0;
    let relayTransferCreated = false;
    await page.route('**/api/quickdrop/direct-sessions', async route => {
      directSessionRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            pairSessionId: 'pair-same-account-1',
            selfChannelId: 'user:1:device:device-a',
            selfDeviceId: 'device-a',
            peerChannelId: 'user:1:device:device-b',
            peerDeviceId: 'device-b',
            peerLabel: 'My Laptop'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/transfers', async route => {
      if (route.request().method() === 'POST') {
        relayTransferCreated = true;
      }
      await route.fallback();
    });

    await gotoQuickDropPage(page, baseURL);

    await expect.poll(() => directSessionRequests).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.__quickDropDirectChoice = null;

      QuickDropSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-1',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      QuickDropSignalManager.waitForDirectReady = async () => true;
      QuickDropSignalManager.isDirectReady = () => true;
      QuickDropSignalManager.getState = () => ({
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'ready'
      });

      QuickDropDirectTransfer.canSendToPeerDevice = deviceId => deviceId === 'device-b';
      QuickDropDirectTransfer.sendFile = async (file, options) => {
        window.__quickDropDirectChoice = {
          fileName: file.name,
          expectedPeerDeviceId: options.expectedPeerDeviceId
        };
        return { transferId: 'direct-same-account-1' };
      };
    });

    await page.setInputFiles('#quickDropFileInput', {
      name: 'same-account.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#quickDropSendBtn').click();

    const directChoice = await page.evaluate(() => window.__quickDropDirectChoice);
    expect(directChoice).toEqual({
      fileName: 'same-account.txt',
      expectedPeerDeviceId: 'device-b'
    });
    expect(relayTransferCreated).toBe(false);
  });

  test('supports public share create flow', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('quickshare-lang', 'en');
    });

    await page.route('**/api/public/quickdrop/shares', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 200,
            message: 'success',
            data: {
              id: 5,
              shareToken: 'share-abc',
              senderLabel: 'Guest Share',
              fileName: 'hello.txt',
              fileSize: 5,
              contentType: 'text/plain',
              chunkSize: 2097152,
              totalChunks: 1,
              uploadedChunks: 0,
              uploadedChunkIndexes: [],
              status: 'pending_upload',
              ready: false
            }
          })
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/api/public/quickdrop/shares/share-abc/chunks/0', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 5,
            shareToken: 'share-abc',
            senderLabel: 'Guest Share',
            fileName: 'hello.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 2097152,
            totalChunks: 1,
            uploadedChunks: 1,
            uploadedChunkIndexes: [0],
            status: 'ready',
            ready: true
          }
        })
      });
    });

    await page.goto(`${baseURL}/quickdrop-share.html`, { waitUntil: 'domcontentloaded' });
    await page.setInputFiles('#quickDropPublicFileInput', {
      name: 'hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });

    await expect(page.locator('#quickDropPublicSelectedFile')).toContainText('hello.txt');
    await page.locator('#quickDropPublicSendBtn').click();

    await expect(page.locator('#quickDropPublicResultLink')).toBeVisible();
    await expect(page.locator('#quickDropPublicResultLink')).toContainText('share-abc');

  });

  test('same-account send falls back to server relay when direct link is not ready', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await page.route('**/api/quickdrop/direct-sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            pairSessionId: 'pair-same-account-fallback',
            selfChannelId: 'user:1:device:device-a',
            selfDeviceId: 'device-a',
            peerChannelId: 'user:1:device:device-b',
            peerDeviceId: 'device-b',
            peerLabel: 'My Laptop'
          }
        })
      });
    });

    let relayTransferCreated = false;
    await page.route('**/api/quickdrop/transfers', async route => {
      if (route.request().method() === 'POST') {
        relayTransferCreated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 200,
            message: 'success',
            data: {
              id: 51,
              senderDeviceId: 'device-a',
              receiverDeviceId: 'device-b',
              fileName: 'fallback.txt',
              fileSize: 5,
              contentType: 'text/plain',
              chunkSize: 2097152,
              totalChunks: 1,
              uploadedChunks: 0,
              uploadedChunkIndexes: [],
              status: 'pending_upload',
              ready: false
            }
          })
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/quickdrop/transfers/51/chunks/0**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 51,
            senderDeviceId: 'device-a',
            receiverDeviceId: 'device-b',
            fileName: 'fallback.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 2097152,
            totalChunks: 1,
            uploadedChunks: 1,
            uploadedChunkIndexes: [0],
            status: 'ready',
            ready: true
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);

    await page.evaluate(() => {
      window.__quickDropDirectShouldNotRun = false;

      QuickDropSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-fallback',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      QuickDropSignalManager.waitForDirectReady = async () => false;
      QuickDropSignalManager.isDirectReady = () => false;
      QuickDropSignalManager.getState = () => ({
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'negotiating'
      });

      QuickDropDirectTransfer.canSendToPeerDevice = () => false;
      QuickDropDirectTransfer.sendFile = async () => {
        window.__quickDropDirectShouldNotRun = true;
      };
    });

    await page.setInputFiles('#quickDropFileInput', {
      name: 'fallback.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#quickDropSendBtn').click();

    await expect.poll(() => relayTransferCreated).toBe(true);
    expect(await page.evaluate(() => window.__quickDropDirectShouldNotRun)).toBe(false);
    await expect(page.locator('#quickDropActiveUploadMeta')).toContainText('Ready to Download');
  });

  test('same-account send switches to server relay when direct transfer breaks mid-flight', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await page.route('**/api/quickdrop/direct-sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            pairSessionId: 'pair-same-account-interrupt',
            selfChannelId: 'user:1:device:device-a',
            selfDeviceId: 'device-a',
            peerChannelId: 'user:1:device:device-b',
            peerDeviceId: 'device-b',
            peerLabel: 'My Laptop'
          }
        })
      });
    });

    let relayTransferCreated = false;
    await page.route('**/api/quickdrop/transfers', async route => {
      if (route.request().method() === 'POST') {
        relayTransferCreated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 200,
            message: 'success',
            data: {
              id: 52,
              senderDeviceId: 'device-a',
              receiverDeviceId: 'device-b',
              fileName: 'interrupt.txt',
              fileSize: 5,
              contentType: 'text/plain',
              chunkSize: 2097152,
              totalChunks: 1,
              uploadedChunks: 0,
              uploadedChunkIndexes: [],
              status: 'pending_upload',
              ready: false
            }
          })
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/quickdrop/transfers/52/chunks/0**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 52,
            senderDeviceId: 'device-a',
            receiverDeviceId: 'device-b',
            fileName: 'interrupt.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 2097152,
            totalChunks: 1,
            uploadedChunks: 1,
            uploadedChunkIndexes: [0],
            status: 'ready',
            ready: true
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);

    await page.evaluate(() => {
      window.__quickDropInterruptedDirect = 0;

      QuickDropSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-interrupt',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      QuickDropSignalManager.waitForDirectReady = async () => true;
      QuickDropSignalManager.isDirectReady = () => true;
      QuickDropSignalManager.getState = () => ({
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'ready'
      });

      QuickDropDirectTransfer.canSendToPeerDevice = () => true;
      QuickDropDirectTransfer.sendFile = async () => {
        window.__quickDropInterruptedDirect += 1;
        const error = new Error('Direct link dropped');
        error.quickDropDirectContext = {
          transferId: 'direct-interrupt-1',
          sentChunks: 1,
          acknowledgedChunks: 1,
          totalChunks: 2,
          peerDeviceId: 'device-b'
        };
        throw error;
      };
    });

    await page.setInputFiles('#quickDropFileInput', {
      name: 'interrupt.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#quickDropSendBtn').click();

    await expect.poll(() => relayTransferCreated).toBe(true);
    expect(await page.evaluate(() => window.__quickDropInterruptedDirect)).toBe(1);
    await expect(page.locator('#quickDropActiveUploadMeta')).toContainText('Ready to Download');
  });

  test('same-account page merges direct transfers into main inbox and saves them to netdisk', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            { id: 301, name: 'Direct Saves' }
          ]
        })
      });
    });

    let uploadCalled = false;
    let uploadFolderMatched = false;
    await page.route('**/api/upload', async route => {
      uploadCalled = true;
      const rawBody = route.request().postData() || '';
      uploadFolderMatched = rawBody.includes('name="folderId"') && rawBody.includes('301');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 901,
            originalName: 'direct-inbox.txt'
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropAccountHistory(page);
    await page.locator('#quickDropSaveFolderSelect').selectOption('301');

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('quickdrop:direct-control', {
        detail: {
          message: {
            type: 'transfer-offer',
            transferId: 'direct-inbox-1',
            fileName: 'direct-inbox.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 65536,
            totalChunks: 1,
            senderLabel: 'Peer Phone'
          }
        }
      }));
    });

    await page.evaluate(() => {
      const packet = QuickDropDirectTransfer.buildChunkPacket(
        'direct-inbox-1',
        0,
        1,
        new TextEncoder().encode('hello').buffer
      );
      document.dispatchEvent(new CustomEvent('quickdrop:direct-binary', {
        detail: {
          data: packet
        }
      }));
    });

    await expect(page.locator('#quickDropIncomingList')).toContainText('direct-inbox.txt');
    await expect(page.locator('#quickDropIncomingList')).toContainText('Direct');
    await expect(page.locator('#quickDropIncomingList [data-quickdrop-direct-save="direct-inbox-1"]')).toBeEnabled();
    await page.locator('#quickDropIncomingList [data-quickdrop-direct-save="direct-inbox-1"]').click();

    await expect.poll(() => uploadCalled).toBe(true);
    expect(uploadFolderMatched).toBe(true);
  });

  test('same-account page merges direct transfers into main outgoing list', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropAccountHistory(page);

    await page.evaluate(() => {
      QuickDropDirectTransfer.getTransfers = direction => {
        if (direction === 'incoming') return [];
        if (direction === 'outgoing') {
          return [{
            id: 'direct-outgoing-1',
            transferMode: 'direct',
            direction: 'outgoing',
            fileName: 'outgoing-direct.txt',
            fileSize: 5,
            totalChunks: 1,
            sentChunks: 1,
            acknowledgedChunks: 1,
            peerLabel: 'Peer Phone',
            status: 'completed',
            updateTime: '2026-03-21T10:00:00'
          }];
        }
        return [];
      };
      document.dispatchEvent(new CustomEvent('quickdrop:direct-transfer-storechange'));
    });

    await expect(page.locator('#quickDropOutgoingList')).toContainText('outgoing-direct.txt');
    await expect(page.locator('#quickDropOutgoingList')).toContainText('Direct');
  });

  test('same-account page merges direct fallback and relay into one outgoing task row', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
      localStorage.setItem('quickdrop-task-links', JSON.stringify({
        relayByTransferId: {
          '77': 'outgoing|device-b|merged.txt|5|1710000000000'
        }
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [
              {
                id: 77,
                taskKey: 'outgoing|device-b|merged.txt|5|1710000000000',
                senderDeviceId: 'device-a',
                receiverDeviceId: 'device-b',
                fileName: 'merged.txt',
                fileSize: 5,
                contentType: 'text/plain',
                chunkSize: 2097152,
                totalChunks: 1,
                uploadedChunks: 1,
                uploadedChunkIndexes: [0],
                status: 'ready',
                ready: true,
                updateTime: '2026-03-21T10:00:00'
              }
            ],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await gotoQuickDropPage(page, baseURL);

    await page.evaluate(() => {
      QuickDropDirectTransfer.getTransfers = direction => {
        if (direction === 'incoming') return [];
        if (direction === 'outgoing') {
          return [{
            id: 'direct-merged-1',
            transferMode: 'direct',
            direction: 'outgoing',
            taskKey: 'outgoing|device-b|merged.txt|5|1710000000000',
            fileName: 'merged.txt',
            fileSize: 5,
            totalChunks: 1,
            sentChunks: 1,
            acknowledgedChunks: 1,
            peerLabel: 'My Laptop',
            peerDeviceId: 'device-b',
            status: 'relay_fallback',
            updateTime: '2026-03-21T10:00:01'
          }];
        }
        return [];
      };
      document.dispatchEvent(new CustomEvent('quickdrop:direct-transfer-storechange'));
    });

    await openQuickDropAccountHistory(page);
    await expect(page.locator('#quickDropOutgoingList .transfer-card')).toHaveCount(1);
    await expect(page.locator('#quickDropOutgoingList')).toContainText('merged.txt');
    await expect(page.locator('#quickDropOutgoingList')).toContainText('Direct -> Relay');
  });

  test('same-account merged task row exposes task details modal payload', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
      localStorage.setItem('quickdrop-task-links', JSON.stringify({
        relayByTransferId: {
          '77': 'outgoing|device-b|detail.txt|5|1710000000000'
        }
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
            role: 'ADMIN'
          }
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [
              {
                id: 77,
                taskKey: 'outgoing|device-b|detail.txt|5|1710000000000',
                direction: 'outgoing',
                transferMode: 'relay',
                senderDeviceId: 'device-a',
                receiverDeviceId: 'device-b',
                peerDeviceId: 'device-b',
                peerLabel: 'My Laptop',
                fileName: 'detail.txt',
                fileSize: 5,
                contentType: 'text/plain',
                chunkSize: 2097152,
                totalChunks: 1,
                uploadedChunks: 1,
                uploadedChunkIndexes: [0],
                status: 'ready',
                ready: true,
                updateTime: '2026-03-21T10:00:00',
                task: {
                  taskKey: 'outgoing|device-b|detail.txt|5|1710000000000',
                  direction: 'outgoing',
                  transferMode: 'hybrid',
                  currentTransferMode: 'relay',
                  stage: 'ready',
                  fileName: 'detail.txt',
                  fileSize: 5,
                  peerDeviceId: 'device-b',
                  peerLabel: 'My Laptop',
                  completedChunks: 1,
                  totalChunks: 1,
                  failureReason: 'direct_transfer_interrupted',
                  fallbackAt: '2026-03-21T10:00:01',
                  updateTime: '2026-03-21T10:00:00',
                  attempts: [
                    {
                      transferMode: 'direct',
                      transferId: 'direct-detail-1',
                      stage: 'relay_fallback',
                      attemptStatus: 'relay_fallback',
                      startReason: 'same_account_direct',
                      endReason: 'relay_fallback',
                      failureReason: 'direct_transfer_interrupted',
                      completedChunks: 1,
                      totalChunks: 1,
                      startTime: '2026-03-21T09:59:58',
                      fallbackAt: '2026-03-21T10:00:01',
                      updateTime: '2026-03-21T10:00:01'
                    },
                    {
                      transferMode: 'relay',
                      transferId: '77',
                      stage: 'ready',
                      attemptStatus: 'waiting',
                      startReason: 'relay_transfer_created',
                      completedChunks: 1,
                      totalChunks: 1,
                      startTime: '2026-03-21T10:00:00',
                      updateTime: '2026-03-21T10:00:00'
                    }
                  ]
                }
              }
            ],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await gotoQuickDropPage(page, baseURL);

    await page.evaluate(() => {
      window.__quickDropDetailDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__quickDropDetailDialog = { message, value, options };
      };
      QuickDropDirectTransfer.getTransfers = direction => {
        if (direction === 'incoming') return [];
        if (direction === 'outgoing') {
          return [{
            id: 'direct-detail-1',
            transferMode: 'direct',
            direction: 'outgoing',
            taskKey: 'outgoing|device-b|detail.txt|5|1710000000000',
            fileName: 'detail.txt',
            fileSize: 5,
            totalChunks: 1,
            sentChunks: 1,
            acknowledgedChunks: 1,
            peerLabel: 'My Laptop',
            peerDeviceId: 'device-b',
            status: 'relay_fallback',
            startReason: 'same_account_direct',
            endReason: 'relay_fallback',
            failureReason: 'direct_transfer_interrupted',
            fallbackAt: '2026-03-21T10:00:01',
            updateTime: '2026-03-21T10:00:01'
          }];
        }
        return [];
      };
      document.dispatchEvent(new CustomEvent('quickdrop:direct-transfer-storechange'));
    });

    await page.evaluate(() => window.showQuickDropTransferDetails('outgoing', 0));
    const detailDialog = await page.evaluate(() => window.__quickDropDetailDialog);
    expect(detailDialog.value).toContain('Task Key: outgoing|device-b|detail.txt|5|1710000000000');
    expect(detailDialog.value).toContain('Mode: Direct -> Relay');
    expect(detailDialog.value).toContain('Lifecycle: Waiting');
    expect(detailDialog.value).toContain('Current Step: Relay · Ready to Download');
    expect(detailDialog.value).toContain('Start Reason: Server relay transfer started');
    expect(detailDialog.value).toContain('Failure Reason: Direct transfer was interrupted');
    expect(detailDialog.value).toContain('Relay Transfer ID: 77');
    expect(detailDialog.value).toContain('Direct Transfer ID: direct-detail-1');
    expect(detailDialog.value).toContain('Saved To Netdisk: Not yet');
    expect(detailDialog.value).toContain('Attempts:');
  });

  test('same-account page prefers unified server task rows and deletes by task id', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
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
            role: 'ADMIN'
          }
        })
      });
    });

    let taskDeleted = false;
    await page.route('**/api/quickdrop/tasks/501?deviceId=*', async route => {
      taskDeleted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: null
        })
      });
    });

    await page.route('**/api/quickdrop/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            currentDevice: {
              deviceId: 'device-a',
              deviceName: 'My Desktop',
              deviceType: 'Windows',
              current: true,
              online: true,
              lastSeenAt: '2026-03-21T10:00:00'
            },
            devices: [
              {
                deviceId: 'device-a',
                deviceName: 'My Desktop',
                deviceType: 'Windows',
                current: true,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              },
              {
                deviceId: 'device-b',
                deviceName: 'My Laptop',
                deviceType: 'Mac',
                current: false,
                online: true,
                lastSeenAt: '2026-03-21T10:00:00'
              }
            ],
            incomingTasks: [],
            outgoingTasks: taskDeleted ? [] : [
              {
                id: 501,
                taskKey: 'outgoing|device-b|server-task.txt|9|1710000000000',
                direction: 'outgoing',
                transferMode: 'hybrid',
                currentTransferMode: 'relay',
                stage: 'ready',
                fileName: 'server-task.txt',
                fileSize: 9,
                contentType: 'text/plain',
                senderDeviceId: 'device-a',
                receiverDeviceId: 'device-b',
                peerDeviceId: 'device-b',
                peerLabel: 'My Laptop',
                completedChunks: 1,
                totalChunks: 1,
                updateTime: '2026-03-21T10:00:10',
                attempts: [
                  {
                    transferMode: 'relay',
                    transferId: '77',
                    stage: 'ready',
                    completedChunks: 1,
                    totalChunks: 1,
                    updateTime: '2026-03-21T10:00:10'
                  },
                  {
                    transferMode: 'direct',
                    transferId: 'direct-server-task-1',
                    stage: 'relay_fallback',
                    completedChunks: 0,
                    totalChunks: 1,
                    updateTime: '2026-03-21T10:00:08'
                  }
                ]
              }
            ],
            incomingTransfers: [],
            outgoingTransfers: [],
            recommendedChunkSize: 2097152
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
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

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropAccountHistory(page);
    await page.evaluate(() => {
      window.showAppConfirm = async () => true;
    });

    await expect(page.locator('#quickDropOutgoingList .transfer-card')).toHaveCount(1);
    await expect(page.locator('#quickDropOutgoingList')).toContainText('server-task.txt');
    await expect(page.locator('#quickDropOutgoingList')).toContainText('Direct -> Relay');

    await page.locator('#quickDropOutgoingList .transfer-card [data-quickdrop-task-delete]').click();
    await expect.poll(() => taskDeleted).toBe(true);
    await expect(page.locator('#quickDropOutgoingList .transfer-card')).toHaveCount(0);
  });

  test('receives a paired direct transfer and keeps it in the browser inbox', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });

    let pairTaskSyncCalls = 0;
    await page.route('**/api/public/quickdrop/pair-tasks**', async route => {
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
    await page.route('**/api/public/quickdrop/pair-tasks/direct-attempts', async route => {
      pairTaskSyncCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 701,
            pairSessionId: 'pair-public-1',
            taskKey: 'pair:direct-offer-1'
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropDirectHistory(page);

    await page.evaluate(() => {
      QuickDropSignalManager.isDirectReady = () => true;
      QuickDropSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });

      document.dispatchEvent(new CustomEvent('quickdrop:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await expect(page.locator('#quickDropDirectPeer')).toHaveText('Peer Phone');

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('quickdrop:direct-control', {
        detail: {
          message: {
            type: 'transfer-offer',
            transferId: 'direct-offer-1',
            taskKey: 'pair:direct-offer-1',
            pairSessionId: 'pair-public-1',
            fileName: 'hello.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 65536,
            totalChunks: 1,
            senderLabel: 'Peer Phone'
          }
        }
      }));
    });

    await expect(page.locator('#quickDropDirectTransferList')).toContainText('hello.txt');

    await page.evaluate(() => {
      const packet = QuickDropDirectTransfer.buildChunkPacket(
        'direct-offer-1',
        0,
        1,
        new TextEncoder().encode('hello').buffer
      );
      document.dispatchEvent(new CustomEvent('quickdrop:direct-binary', {
        detail: {
          data: packet
        }
      }));
    });

    await expect(page.locator('#quickDropDirectTransferList')).toContainText('Ready to Download');
    await expect(page.locator('#quickDropDirectTransferList')).toContainText('hello.txt');
    await expect(page.locator('#quickDropDirectTransferList [data-quickdrop-direct-download="direct-offer-1"]')).toBeEnabled();
    await expect.poll(() => pairTaskSyncCalls).toBeGreaterThan(0);

    await openQuickDropDirectHistory(page);
    await page.evaluate(() => {
      window.__quickDropDirectDetailDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__quickDropDirectDetailDialog = { message, value, options };
      };
    });
    await page.locator('#quickDropDirectTransferList [data-quickdrop-direct-detail="direct-offer-1"]').click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__quickDropDirectDetailDialog);
    }).not.toBeNull();
    const detailDialog = await page.evaluate(() => window.__quickDropDirectDetailDialog);
    expect(detailDialog.value).toContain('Pair Task ID: 701');
    expect(detailDialog.value).toContain('Pair Session: pair-public-1');
  });

  test('sends a paired direct transfer through the direct channel hooks', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });

    let pairTaskSyncCalls = 0;
    await page.route('**/api/public/quickdrop/pair-tasks**', async route => {
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
    await page.route('**/api/public/quickdrop/pair-tasks/direct-attempts', async route => {
      pairTaskSyncCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 702,
            pairSessionId: 'pair-public-send-1',
            taskKey: 'pair:pair-transfer-send-1'
          }
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);

    await page.evaluate(() => {
      window.__quickDropDirectSend = {
        control: [],
        binaryCount: 0,
        transferId: ''
      };

      QuickDropSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-send-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });
      QuickDropSignalManager.isDirectReady = () => true;
      QuickDropSignalManager.waitForDirectDrain = async () => {};
      QuickDropSignalManager.sendDirectControl = message => {
        window.__quickDropDirectSend.control.push(message);
        if (message.type === 'transfer-offer') {
          window.__quickDropDirectSend.transferId = message.transferId;
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('quickdrop:direct-control', {
              detail: {
                message: {
                  type: 'transfer-accept',
                  transferId: message.transferId,
                  totalChunks: 1,
                  receivedCount: 0,
                  missingChunks: [0]
                }
              }
            }));
          }, 0);
        }
        return true;
      };
      QuickDropSignalManager.sendDirectBinary = () => {
        window.__quickDropDirectSend.binaryCount += 1;
        const transferId = window.__quickDropDirectSend.transferId;
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('quickdrop:direct-control', {
            detail: {
              message: {
                type: 'transfer-progress',
                transferId,
                totalChunks: 1,
                receivedCount: 1
              }
            }
          }));
          document.dispatchEvent(new CustomEvent('quickdrop:direct-control', {
            detail: {
              message: {
                type: 'transfer-complete',
                transferId,
                totalChunks: 1,
                receivedCount: 1
              }
            }
          }));
        }, 0);
        return true;
      };

      document.dispatchEvent(new CustomEvent('quickdrop:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await page.setInputFiles('#quickDropDirectFileInput', {
      name: 'direct.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });

    await expect(page.locator('#quickDropDirectSelectedFile')).toContainText('direct.txt');
    await page.locator('#quickDropDirectSendBtn').click();

    await expect(page.locator('#quickDropDirectActiveMeta')).toContainText('Direct transfer complete');
    const sendState = await page.evaluate(() => window.__quickDropDirectSend);
    expect(sendState.binaryCount).toBe(1);
    expect(sendState.control.some(item => item.type === 'transfer-offer')).toBeTruthy();
    expect(sendState.control.some(item => item.type === 'transfer-finish')).toBeTruthy();
    await expect.poll(() => pairTaskSyncCalls).toBeGreaterThan(0);
  });

  test('loads paired tasks from the server task view and can delete a server-only pair task', async ({ page, baseURL }) => {
    await stubQuickDropRealtime(page, { lang: 'en' });

    let currentPairTasks = [
      {
        id: 801,
        pairSessionId: 'pair-public-list-1',
        taskKey: 'pair:server-only-1',
        direction: 'outgoing',
        transferMode: 'direct',
        currentTransferMode: 'direct',
        stage: 'sending',
        selfChannelId: 'guest:self-browser',
        peerChannelId: 'guest:peer-phone',
        selfLabel: 'Self Browser',
        peerLabel: 'Peer Phone',
        fileName: 'server-only.txt',
        fileSize: 7,
        contentType: 'text/plain',
        completedChunks: 0,
        totalChunks: 1,
        attemptStatus: 'transferring',
        startReason: 'pair_session_direct',
        updateTime: '2026-03-21T10:00:00',
        attempts: [
          {
            transferMode: 'direct',
            transferId: 'server-transfer-1',
            stage: 'sending',
            attemptStatus: 'transferring',
            startReason: 'pair_session_direct',
            completedChunks: 0,
            totalChunks: 1,
            startTime: '2026-03-21T10:00:00',
            updateTime: '2026-03-21T10:00:00'
          }
        ]
      }
    ];
    let pairTaskDeleteCalled = false;

    await page.route('**/api/public/quickdrop/pair-tasks**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: currentPairTasks
        })
      });
    });

    await page.route('**/api/public/quickdrop/pair-tasks/801/direct-attempts/server-transfer-1**', async route => {
      pairTaskDeleteCalled = true;
      currentPairTasks = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: null
        })
      });
    });

    await gotoQuickDropPage(page, baseURL);
    await openQuickDropDirectHistory(page);
    await page.evaluate(() => {
      window.showAppConfirm = async () => true;
      window.__quickDropPairTaskDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__quickDropPairTaskDialog = { message, value, options };
      };

      QuickDropSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-list-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });
      QuickDropSignalManager.isDirectReady = () => true;

      document.dispatchEvent(new CustomEvent('quickdrop:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await expect(page.locator('#quickDropDirectTransferList')).toContainText('server-only.txt');
    await expect(page.locator('#quickDropDirectTransferList')).toContainText('Sent');

    await page.locator('#quickDropDirectTransferList [data-quickdrop-direct-detail="pair-task:801"]').click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__quickDropPairTaskDialog);
    }).not.toBeNull();
    const detailDialog = await page.evaluate(() => window.__quickDropPairTaskDialog);
    expect(detailDialog.value).toContain('Lifecycle: Transferring');
    expect(detailDialog.value).toContain('Start Reason: Paired direct session');
    expect(detailDialog.value).toContain('Pair Task ID: 801');
    expect(detailDialog.value).toContain('Direct Transfer ID: server-transfer-1');

    await page.locator('#quickDropDirectTransferList [data-quickdrop-direct-delete-task="pair-task:801"]').click();
    await expect.poll(() => pairTaskDeleteCalled).toBe(true);
    await expect(page.locator('#quickDropDirectTransferList .transfer-card')).toHaveCount(0);
  });

  test.skip('renders signed-in pickup view with save-to-netdisk folder selector', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'quickdrop-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
    });

    await page.route('**/api/public/quickdrop/shares/**', async route => {
      if (!route.request().url().includes('/api/public/quickdrop/shares/share-abc')) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 5,
            shareToken: 'share-abc',
            senderLabel: 'Guest Share',
            fileName: 'hello.txt',
            fileSize: 5,
            contentType: 'text/plain',
            chunkSize: 2097152,
            totalChunks: 1,
            uploadedChunks: 1,
            uploadedChunkIndexes: [0],
            status: 'ready',
            ready: true,
            updateTime: '2026-03-21T10:00:00'
          }
        })
      });
    });

    await page.route('**/api/folders/all', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: [
            { id: 401, name: 'QuickDrop Saves' }
          ]
        })
      });
    });

    await page.goto(`${baseURL}/quickdrop-share.html?share=share-abc`, { waitUntil: 'domcontentloaded' });
    await page.waitForResponse('**/api/public/quickdrop/shares/share-abc');
    await expect(page.locator('#quickDropPublicPickupCard')).toBeVisible();
    await expect(page.locator('#quickDropPublicFileName')).toHaveText('hello.txt');
    await expect(page.locator('#quickDropPublicDownloadBtn')).toBeEnabled();
    await expect(page.locator('#quickDropPublicSaveBtn')).toBeVisible();
    await expect(page.locator('#quickDropPublicSaveFolderSelect')).toContainText('QuickDrop Saves');
  });
});
