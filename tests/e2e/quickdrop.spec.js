const { test, expect } = require('@playwright/test');

async function stubTransferRealtime(page, { lang = 'en' } = {}) {
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

async function gotoTransferPage(page, baseURL) {
  await page.goto(`${baseURL}/transfer.html`, { waitUntil: 'commit' });
  await expect(page.locator('#transferModeSwitch')).toBeVisible();
}

async function openTransferAccountHistory(page) {
  const panel = page.locator('#transferAccountHistoryPanel');
  if (await panel.isVisible()) {
    return;
  }
  await page.locator('#transferAccountHistoryToggle').click();
  await expect(page).toHaveURL(/[?&]view=account-history$/);
  await expect(panel).toBeVisible();
}

async function openTransferDirectHistory(page) {
  const panel = page.locator('#transferDirectHistoryPanel');
  if (await panel.isVisible()) {
    return;
  }
  await page.locator('#transferDirectHistoryToggle').click();
  await expect(page).toHaveURL(/[?&]view=temporary-history$/);
  await expect(panel).toBeVisible();
}

test.describe('Transfer pages', () => {
  test('guest can stay on transfer page and use temporary transfer without being redirected to login', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });

    await gotoTransferPage(page, baseURL);
    await expect(page).toHaveURL(/transfer.html$/);
    await expect(page.locator('#transferSignalStatus')).toBeHidden();
    await expect(page.locator('#transferDirectChooseBtn')).toBeVisible();
    await expect(page.locator('#transferAccountPanels')).toBeHidden();
  });

  test('renders same-account device transfer view and saves incoming transfer to netdisk', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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
    await page.route('**/api/transfer/transfers/12/save', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);

    await expect(page.locator('#transferDeviceList')).toContainText('My Laptop');
    await expect(page.locator('#transferSelectedDevice')).toHaveText('My Laptop');
    await expect(page.locator('#transferSaveFolderSelect')).toContainText('Projects');
    await expect(page.locator('#transferIncomingList')).toContainText('draft.pdf');
    await expect(page.locator('#transferIncomingList')).toContainText('Save to Netdisk');

    await page.locator('#transferSaveFolderSelect').selectOption('301');
    await page.locator('[data-transfer-save="12"]').click();
    await expect.poll(() => saveCalled).toBe(true);
    expect(saveRequestFolderId).toBe(301);
  });

  test('same-account main page shows an incoming notice card and can jump into the inbox', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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
                id: 18,
                senderDeviceId: 'device-b',
                receiverDeviceId: 'device-a',
                fileName: 'arrival.zip',
                fileSize: 8192,
                contentType: 'application/zip',
                chunkSize: 1024,
                totalChunks: 8,
                uploadedChunks: 8,
                uploadedChunkIndexes: [0, 1, 2, 3, 4, 5, 6, 7],
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

    await gotoTransferPage(page, baseURL);

    await expect(page.locator('#transferIncomingNoticeCard')).toBeVisible();
    await expect(page.locator('#transferIncomingNoticeCard')).toContainText('arrival.zip');
    await expect(page.locator('#transferIncomingNoticeStatus')).toContainText(/Ready|待下载|已就绪/);

    await page.locator('#transferIncomingNoticeOpenBtn').click();
    await expect(page).toHaveURL(/[?&]view=account-history$/);
    await expect(page.locator('#transferAccountHistoryPanel')).toBeVisible();
    await expect(page.locator('#transferIncomingList')).toContainText('arrival.zip');
  });

  test('shows saved badge and view-in-netdisk link when incoming task was already saved', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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
          data: { id: 1, username: 'admin', nickname: 'QuickShare Admin', role: 'ADMIN' }
        })
      });
    });

    await page.route('**/api/transfer/sync', async route => {
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
                updateTime: '2026-03-21T10:00:00',
                savedToNetdiskAt: '2026-03-26T10:00:00'
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
          data: [{ id: 301, name: 'Projects' }]
        })
      });
    });

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);

    await expect(page.locator('#transferIncomingList')).toContainText('draft.pdf');
    await expect(page.locator('#transferIncomingList [data-transfer-save]')).toHaveCount(0);
    await expect(page.locator('#transferIncomingList')).toContainText('Saved to Netdisk');
    await expect(page.locator('#transferIncomingList a[href="netdisk.html"]')).toBeVisible();
  });

  test('same-account history page uses route navigation and browser back returns to the main stage', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);
    await expect(page.locator('#transferHistoryPage')).toBeVisible();
    await page.goBack({ waitUntil: 'commit' });
    await expect(page).toHaveURL(/transfer.html$/);
    await expect(page.locator('#transferHistoryPage')).toBeHidden();
    await expect(page.locator('#transferMainLayout')).toBeVisible();
  });

  test('same-account page auto-requests a direct session and prefers direct send when ready', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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
    await page.route('**/api/transfer/direct-sessions', async route => {
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

    await page.route('**/api/transfer/transfers', async route => {
      if (route.request().method() === 'POST') {
        relayTransferCreated = true;
      }
      await route.fallback();
    });

    await gotoTransferPage(page, baseURL);

    await expect.poll(() => directSessionRequests).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.__transferDirectChoice = null;

      TransferSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-1',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      TransferSignalManager.waitForDirectReady = async () => true;
      TransferSignalManager.isDirectReady = () => true;
      TransferSignalManager.getState = () => ({
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'ready'
      });

      TransferDirectTransfer.canSendToPeerDevice = deviceId => deviceId === 'device-b';
      TransferDirectTransfer.sendFile = async (file, options) => {
        window.__transferDirectChoice = {
          fileName: file.name,
          expectedPeerDeviceId: options.expectedPeerDeviceId
        };
        return { transferId: 'direct-same-account-1' };
      };
    });

    await page.setInputFiles('#transferFileInput', {
      name: 'same-account.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#transferSendBtn').click();

    const directChoice = await page.evaluate(() => window.__transferDirectChoice);
    expect(directChoice).toEqual({
      fileName: 'same-account.txt',
      expectedPeerDeviceId: 'device-b'
    });
    expect(relayTransferCreated).toBe(false);
  });

  test('same-account send retries transient direct-session signaling errors before falling back to relay', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    let relayTransferCreated = false;
    await page.route('**/api/transfer/direct-sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            pairSessionId: 'pair-same-account-retry',
            selfChannelId: 'user:1:device:device-a',
            selfDeviceId: 'device-a',
            peerChannelId: 'user:1:device:device-b',
            peerDeviceId: 'device-b',
            peerLabel: 'My Laptop'
          }
        })
      });
    });

    await page.route('**/api/transfer/transfers', async route => {
      if (route.request().method() === 'POST') {
        relayTransferCreated = true;
      }
      await route.fallback();
    });

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      window.__transferDirectChoice = null;
      window.__transferEnsurePairAttempts = 0;
      window.__transferPeerReady = false;

      TransferSignalManager.ensurePairWithDevice = async () => {
        window.__transferEnsurePairAttempts += 1;
        if (window.__transferEnsurePairAttempts === 1) {
          throw new Error('目标设备当前没有连上直连信令');
        }
        window.__transferPeerReady = true;
        return {
          pairSessionId: 'pair-same-account-retry',
          peerChannelId: 'user:1:device:device-b',
          peerDeviceId: 'device-b',
          peerLabel: 'My Laptop'
        };
      };
      TransferSignalManager.waitForDirectReady = async () => window.__transferPeerReady;
      TransferSignalManager.isDirectReady = () => window.__transferPeerReady;
      TransferSignalManager.getState = () => ({
        connected: true,
        latestPeerLabel: window.__transferPeerReady ? 'My Laptop' : '',
        latestPeerChannelId: window.__transferPeerReady ? 'user:1:device:device-b' : '',
        latestPeerDeviceId: window.__transferPeerReady ? 'device-b' : '',
        directState: window.__transferPeerReady ? 'ready' : 'idle',
        directDiagnostics: {
          rtcHasTurn: false
        }
      });

      TransferDirectTransfer.canSendToPeerDevice = deviceId => deviceId === 'device-b';
      TransferDirectTransfer.sendFile = async (file, options) => {
        window.__transferDirectChoice = {
          fileName: file.name,
          expectedPeerDeviceId: options.expectedPeerDeviceId
        };
        return { transferId: 'direct-same-account-retry-1' };
      };
    });

    await page.locator('[data-transfer-device="device-b"]').click();
    await page.setInputFiles('#transferFileInput', {
      name: 'retry-direct.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#transferSendBtn').click();

    await expect.poll(() => page.evaluate(() => window.__transferEnsurePairAttempts)).toBe(2);
    expect(await page.evaluate(() => window.__transferDirectChoice)).toEqual({
      fileName: 'retry-direct.txt',
      expectedPeerDeviceId: 'device-b'
    });
    expect(relayTransferCreated).toBe(false);
  });

  test('supports public share create flow', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('quickshare-lang', 'en');
    });

    await page.route('**/api/public/transfer/shares', async route => {
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

    await page.route('**/api/public/transfer/shares/share-abc/chunks/0', async route => {
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

    await page.goto(`${baseURL}/transfer-share.html`, { waitUntil: 'domcontentloaded' });
    await page.setInputFiles('#transferPublicFileInput', {
      name: 'hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });

    await expect(page.locator('#transferPublicSelectedFile')).toContainText('hello.txt');
    await page.locator('#transferPublicSendBtn').click();

    await expect(page.locator('#transferPublicResultLink')).toBeVisible();
    await expect(page.locator('#transferPublicResultLink')).toContainText('share-abc');

  });

  test('same-account send falls back to server relay when direct link is not ready', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    await page.route('**/api/transfer/direct-sessions', async route => {
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

    let directFallbackSyncPayload = null;
    await page.route('**/api/transfer/tasks/direct-attempts', async route => {
      directFallbackSyncPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'success',
          data: {
            id: 7001,
            taskKey: directFallbackSyncPayload.taskKey,
            direction: 'outgoing',
            transferMode: 'direct',
            currentTransferMode: 'direct',
            stage: directFallbackSyncPayload.status,
            attemptStatus: 'relay_fallback',
            endReason: directFallbackSyncPayload.endReason,
            failureReason: directFallbackSyncPayload.failureReason,
            fileName: directFallbackSyncPayload.fileName,
            fileSize: directFallbackSyncPayload.fileSize,
            completedChunks: 0,
            totalChunks: 1,
            attempts: [
              {
                transferMode: 'direct',
                transferId: directFallbackSyncPayload.clientTransferId,
                stage: directFallbackSyncPayload.status,
                attemptStatus: 'relay_fallback',
                endReason: directFallbackSyncPayload.endReason,
                failureReason: directFallbackSyncPayload.failureReason,
                completedChunks: 0,
                totalChunks: 1,
                updateTime: '2026-03-21T10:00:00'
              }
            ]
          }
        })
      });
    });

    let relayTransferCreated = false;
    await page.route('**/api/transfer/transfers', async route => {
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

    await page.route('**/api/transfer/transfers/51/chunks/0**', async route => {
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

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      window.__transferDirectShouldNotRun = false;

      TransferSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-fallback',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      TransferSignalManager.waitForDirectReady = async () => false;
      TransferSignalManager.isDirectReady = () => false;
      TransferSignalManager.getState = () => ({
        connected: true,
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'negotiating',
        directDiagnostics: {
          rtcHasTurn: true
        }
      });

      TransferDirectTransfer.canSendToPeerDevice = () => false;
      TransferDirectTransfer.sendFile = async () => {
        window.__transferDirectShouldNotRun = true;
      };
    });

    await page.setInputFiles('#transferFileInput', {
      name: 'fallback.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#transferSendBtn').click();

    await expect.poll(() => relayTransferCreated).toBe(true);
    await expect.poll(() => directFallbackSyncPayload).not.toBeNull();
    expect(directFallbackSyncPayload.status).toBe('relay_fallback');
    expect(directFallbackSyncPayload.endReason).toBe('relay_fallback');
    expect(directFallbackSyncPayload.failureReason).toBe('direct_ready_timeout');
    expect(await page.evaluate(() => window.__transferDirectShouldNotRun)).toBe(false);
    await expect(page.locator('#transferActiveUploadMeta')).toContainText('Ready to Download');
  });

  test('same-account send switches to server relay when direct transfer breaks mid-flight', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    await page.route('**/api/transfer/direct-sessions', async route => {
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
    await page.route('**/api/transfer/transfers', async route => {
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

    await page.route('**/api/transfer/transfers/52/chunks/0**', async route => {
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

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      window.__transferInterruptedDirect = 0;

      TransferSignalManager.ensurePairWithDevice = async () => ({
        pairSessionId: 'pair-same-account-interrupt',
        peerChannelId: 'user:1:device:device-b',
        peerDeviceId: 'device-b',
        peerLabel: 'My Laptop'
      });
      TransferSignalManager.waitForDirectReady = async () => true;
      TransferSignalManager.isDirectReady = () => true;
      TransferSignalManager.getState = () => ({
        latestPeerLabel: 'My Laptop',
        latestPeerChannelId: 'user:1:device:device-b',
        latestPeerDeviceId: 'device-b',
        directState: 'ready'
      });

      TransferDirectTransfer.canSendToPeerDevice = () => true;
      TransferDirectTransfer.sendFile = async () => {
        window.__transferInterruptedDirect += 1;
        const error = new Error('Direct link dropped');
        error.transferDirectContext = {
          transferId: 'direct-interrupt-1',
          sentChunks: 1,
          acknowledgedChunks: 1,
          totalChunks: 2,
          peerDeviceId: 'device-b'
        };
        throw error;
      };
    });

    await page.setInputFiles('#transferFileInput', {
      name: 'interrupt.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });
    await page.locator('#transferSendBtn').click();

    await expect.poll(() => relayTransferCreated).toBe(true);
    expect(await page.evaluate(() => window.__transferInterruptedDirect)).toBe(1);
    await expect(page.locator('#transferActiveUploadMeta')).toContainText('Ready to Download');
  });

  test('same-account page merges direct transfers into main inbox and saves them to netdisk', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);
    await page.locator('#transferSaveFolderSelect').selectOption('301');

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('transfer:direct-control', {
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
      const packet = TransferDirectTransfer.buildChunkPacket(
        'direct-inbox-1',
        0,
        1,
        new TextEncoder().encode('hello').buffer
      );
      document.dispatchEvent(new CustomEvent('transfer:direct-binary', {
        detail: {
          data: packet
        }
      }));
    });

    await expect(page.locator('#transferIncomingList')).toContainText('direct-inbox.txt');
    await expect(page.locator('#transferIncomingList')).toContainText('Direct');
    await expect(page.locator('#transferIncomingList [data-transfer-direct-save="direct-inbox-1"]')).toBeEnabled();
    await page.locator('#transferIncomingList [data-transfer-direct-save="direct-inbox-1"]').click();

    await expect.poll(() => uploadCalled).toBe(true);
    expect(uploadFolderMatched).toBe(true);
  });

  test('same-account page merges direct transfers into main outgoing list', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);

    await page.evaluate(() => {
      TransferDirectTransfer.getTransfers = direction => {
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
      document.dispatchEvent(new CustomEvent('transfer:direct-transfer-storechange'));
    });

    await expect(page.locator('#transferOutgoingList')).toContainText('outgoing-direct.txt');
    await expect(page.locator('#transferOutgoingList')).toContainText('Direct');
  });

  test('same-account page merges direct fallback and relay into one outgoing task row', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
      localStorage.setItem('transfer-task-links', JSON.stringify({
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      TransferDirectTransfer.getTransfers = direction => {
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
      document.dispatchEvent(new CustomEvent('transfer:direct-transfer-storechange'));
    });

    await openTransferAccountHistory(page);
    await expect(page.locator('#transferOutgoingList .transfer-card')).toHaveCount(1);
    await expect(page.locator('#transferOutgoingList')).toContainText('merged.txt');
    await expect(page.locator('#transferOutgoingList')).toContainText('Direct -> Relay');
  });

  test('same-account merged task row exposes task details modal payload', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
      localStorage.setItem('transfer-task-links', JSON.stringify({
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      window.__transferDetailDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__transferDetailDialog = { message, value, options };
      };
      TransferDirectTransfer.getTransfers = direction => {
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
      document.dispatchEvent(new CustomEvent('transfer:direct-transfer-storechange'));
    });

    await page.evaluate(() => window.showTransferTransferDetails('outgoing', 0));
    const detailDialog = await page.evaluate(() => window.__transferDetailDialog);
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
      localStorage.setItem('token', 'transfer-token');
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
    await page.route('**/api/transfer/tasks/501?deviceId=*', async route => {
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

    await page.route('**/api/transfer/sync', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferAccountHistory(page);
    await page.evaluate(() => {
      window.showAppConfirm = async () => true;
    });

    await expect(page.locator('#transferOutgoingList .transfer-card')).toHaveCount(1);
    await expect(page.locator('#transferOutgoingList')).toContainText('server-task.txt');
    await expect(page.locator('#transferOutgoingList')).toContainText('Direct -> Relay');

    await page.locator('#transferOutgoingList .transfer-card [data-transfer-task-delete]').click();
    await expect.poll(() => taskDeleted).toBe(true);
    await expect(page.locator('#transferOutgoingList .transfer-card')).toHaveCount(0);
  });

  test('receives a paired direct transfer and keeps it in the browser inbox', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });

    let pairTaskSyncCalls = 0;
    await page.route('**/api/public/transfer/pair-tasks**', async route => {
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
    await page.route('**/api/public/transfer/pair-tasks/direct-attempts', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferDirectHistory(page);

    await page.evaluate(() => {
      TransferSignalManager.isDirectReady = () => true;
      TransferSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });

      document.dispatchEvent(new CustomEvent('transfer:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await expect(page.locator('#transferDirectPeer')).toHaveText('Peer Phone');

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('transfer:direct-control', {
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

    await expect(page.locator('#transferDirectTransferList')).toContainText('hello.txt');

    await page.evaluate(() => {
      const packet = TransferDirectTransfer.buildChunkPacket(
        'direct-offer-1',
        0,
        1,
        new TextEncoder().encode('hello').buffer
      );
      document.dispatchEvent(new CustomEvent('transfer:direct-binary', {
        detail: {
          data: packet
        }
      }));
    });

    await expect(page.locator('#transferDirectTransferList')).toContainText('Ready to Download');
    await expect(page.locator('#transferDirectTransferList')).toContainText('hello.txt');
    await expect(page.locator('#transferDirectTransferList [data-transfer-direct-download="direct-offer-1"]')).toBeEnabled();
    await expect.poll(() => pairTaskSyncCalls).toBeGreaterThan(0);

    await openTransferDirectHistory(page);
    await page.evaluate(() => {
      window.__transferDirectDetailDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__transferDirectDetailDialog = { message, value, options };
      };
    });
    await page.locator('#transferDirectTransferList [data-transfer-direct-detail="direct-offer-1"]').click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__transferDirectDetailDialog);
    }).not.toBeNull();
    const detailDialog = await page.evaluate(() => window.__transferDirectDetailDialog);
    expect(detailDialog.value).toContain('Pair Task ID: 701');
    expect(detailDialog.value).toContain('Pair Session: pair-public-1');
  });

  test('sends a paired direct transfer through the direct channel hooks', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });

    let pairTaskSyncCalls = 0;
    await page.route('**/api/public/transfer/pair-tasks**', async route => {
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
    await page.route('**/api/public/transfer/pair-tasks/direct-attempts', async route => {
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

    await gotoTransferPage(page, baseURL);

    await page.evaluate(() => {
      window.__transferDirectSend = {
        control: [],
        binaryCount: 0,
        transferId: ''
      };

      TransferSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-send-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });
      TransferSignalManager.isDirectReady = () => true;
      TransferSignalManager.waitForDirectDrain = async () => {};
      TransferSignalManager.sendDirectControl = message => {
        window.__transferDirectSend.control.push(message);
        if (message.type === 'transfer-offer') {
          window.__transferDirectSend.transferId = message.transferId;
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('transfer:direct-control', {
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
      TransferSignalManager.sendDirectBinary = () => {
        window.__transferDirectSend.binaryCount += 1;
        const transferId = window.__transferDirectSend.transferId;
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('transfer:direct-control', {
            detail: {
              message: {
                type: 'transfer-progress',
                transferId,
                totalChunks: 1,
                receivedCount: 1
              }
            }
          }));
          document.dispatchEvent(new CustomEvent('transfer:direct-control', {
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

      document.dispatchEvent(new CustomEvent('transfer:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await page.setInputFiles('#transferDirectFileInput', {
      name: 'direct.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello')
    });

    await expect(page.locator('#transferDirectSelectedFile')).toContainText('direct.txt');
    await page.locator('#transferDirectSendBtn').click();

    await expect(page.locator('#transferDirectActiveMeta')).toContainText('Direct transfer complete');
    const sendState = await page.evaluate(() => window.__transferDirectSend);
    expect(sendState.binaryCount).toBe(1);
    expect(sendState.control.some(item => item.type === 'transfer-offer')).toBeTruthy();
    expect(sendState.control.some(item => item.type === 'transfer-finish')).toBeTruthy();
    await expect.poll(() => pairTaskSyncCalls).toBeGreaterThan(0);
  });

  test('loads paired tasks from the server task view and can delete a server-only pair task', async ({ page, baseURL }) => {
    await stubTransferRealtime(page, { lang: 'en' });

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

    await page.route('**/api/public/transfer/pair-tasks**', async route => {
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

    await page.route('**/api/public/transfer/pair-tasks/801/direct-attempts/server-transfer-1**', async route => {
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

    await gotoTransferPage(page, baseURL);
    await openTransferDirectHistory(page);
    await page.evaluate(() => {
      window.showAppConfirm = async () => true;
      window.__transferPairTaskDialog = null;
      window.showAppCopyDialog = async (message, value, options) => {
        window.__transferPairTaskDialog = { message, value, options };
      };

      TransferSignalManager.getState = () => ({
        channelId: 'guest:self-browser',
        pairSessionId: 'pair-public-list-1',
        latestPeerLabel: 'Peer Phone',
        latestPeerChannelId: 'guest:peer-phone'
      });
      TransferSignalManager.isDirectReady = () => true;

      document.dispatchEvent(new CustomEvent('transfer:direct-statechange', {
        detail: {
          directState: 'ready',
          peerLabel: 'Peer Phone',
          peerChannelId: 'guest:peer-phone'
        }
      }));
    });

    await expect(page.locator('#transferDirectTransferList')).toContainText('server-only.txt');
    await expect(page.locator('#transferDirectTransferList')).toContainText('Sent');

    await page.locator('#transferDirectTransferList [data-transfer-direct-detail="pair-task:801"]').click();
    await expect.poll(async () => {
      return page.evaluate(() => window.__transferPairTaskDialog);
    }).not.toBeNull();
    const detailDialog = await page.evaluate(() => window.__transferPairTaskDialog);
    expect(detailDialog.value).toContain('Lifecycle: Transferring');
    expect(detailDialog.value).toContain('Start Reason: Paired direct session');
    expect(detailDialog.value).toContain('Pair Task ID: 801');
    expect(detailDialog.value).toContain('Direct Transfer ID: server-transfer-1');

    await page.locator('#transferDirectTransferList [data-transfer-direct-delete-task="pair-task:801"]').click();
    await expect.poll(() => pairTaskDeleteCalled).toBe(true);
    await expect(page.locator('#transferDirectTransferList .transfer-card')).toHaveCount(0);
  });

  test.skip('renders signed-in pickup view with save-to-netdisk folder selector', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'transfer-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: 'QuickShare Admin',
        role: 'ADMIN'
      }));
    });

    await page.route('**/api/public/transfer/shares/**', async route => {
      if (!route.request().url().includes('/api/public/transfer/shares/share-abc')) {
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
            { id: 401, name: 'Transfer Saves' }
          ]
        })
      });
    });

    await page.goto(`${baseURL}/transfer-share.html?share=share-abc`, { waitUntil: 'domcontentloaded' });
    await page.waitForResponse('**/api/public/transfer/shares/share-abc');
    await expect(page.locator('#transferPublicPickupCard')).toBeVisible();
    await expect(page.locator('#transferPublicFileName')).toHaveText('hello.txt');
    await expect(page.locator('#transferPublicDownloadBtn')).toBeEnabled();
    await expect(page.locator('#transferPublicSaveBtn')).toBeVisible();
    await expect(page.locator('#transferPublicSaveFolderSelect')).toContainText('Transfer Saves');
  });
});
