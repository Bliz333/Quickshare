const { test, expect } = require('@playwright/test');

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

async function createFolder(request, token, name, parentId = 0) {
  const response = await request.post('/api/folders', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, parentId }
  });
  return readJson(response);
}

async function uploadTextFile(request, token, folderId, fileName, content) {
  const response = await request.post('/api/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(content, 'utf8')
      },
      folderId: String(folderId)
    }
  });
  return readJson(response);
}

async function listFolderEntries(request, token, folderId) {
  const response = await request.get(`/api/files?folderId=${folderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return readJson(response);
}

async function deleteFolderIfExists(request, token, folderId) {
  if (!folderId) {
    return;
  }

  await request.delete(`/api/folders/${folderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function listRow(page, name) {
  return page.locator('#listContent > div').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

function itemCheckbox(row) {
  return row.locator('input[type="checkbox"]').first();
}

test.describe('Netdisk drag and drop', () => {
  test('moves a file and a folder by dragging them onto a target folder', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const targetFolderName = uniqueName('e2e-drag-target');
    const sourceFolderName = uniqueName('e2e-drag-source');
    const fileName = uniqueName('e2e-drag-file') + '.txt';
    const fileContent = `drag-content-${Date.now()}`;

    let targetFolderId = null;

    try {
      const targetFolder = await createFolder(request, token, targetFolderName, 0);
      targetFolderId = targetFolder.id;
      await createFolder(request, token, sourceFolderName, 0);
      await uploadTextFile(request, token, 0, fileName, fileContent);

      await page.addInitScript(
        ({ storedToken, storedUser }) => {
          localStorage.setItem('token', storedToken);
          localStorage.setItem('user', JSON.stringify(storedUser));
        },
        { storedToken: token, storedUser: user }
      );

      await page.goto(`${baseURL}/netdisk.html`);
      await expect(page.locator('#listContent')).toBeVisible();

      const targetFolderRow = listRow(page, targetFolderName);
      const sourceFolderRow = listRow(page, sourceFolderName);
      const fileRow = listRow(page, fileName);

      await expect(targetFolderRow).toBeVisible();
      await expect(sourceFolderRow).toBeVisible();
      await expect(fileRow).toBeVisible();

      await fileRow.dragTo(targetFolderRow);

      await expect.poll(async () => {
        const entries = await listFolderEntries(request, token, targetFolderId);
        return entries.some(entry => (entry.originalName || entry.fileName || entry.name) === fileName);
      }).toBe(true);

      await expect(fileRow).toHaveCount(0);

      await sourceFolderRow.dragTo(targetFolderRow);

      await expect.poll(async () => {
        const entries = await listFolderEntries(request, token, targetFolderId);
        return entries.some(entry => (entry.originalName || entry.fileName || entry.name) === sourceFolderName);
      }).toBe(true);

      await expect(sourceFolderRow).toHaveCount(0);

      await targetFolderRow.click();
      await expect(listRow(page, fileName)).toBeVisible();
      await expect(listRow(page, sourceFolderName)).toBeVisible();
    } finally {
      await deleteFolderIfExists(request, token, targetFolderId);
    }
  });

  test('moves and deletes multiple items through selection mode batch dialogs', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const targetFolderName = uniqueName('e2e-batch-target');
    const sourceFolderName = uniqueName('e2e-batch-folder');
    const firstFileName = uniqueName('e2e-batch-file-a') + '.txt';
    const secondFileName = uniqueName('e2e-batch-file-b') + '.txt';

    let targetFolderId = null;

    try {
      const targetFolder = await createFolder(request, token, targetFolderName, 0);
      targetFolderId = targetFolder.id;
      await createFolder(request, token, sourceFolderName, 0);
      await uploadTextFile(request, token, 0, firstFileName, `batch-a-${Date.now()}`);
      await uploadTextFile(request, token, 0, secondFileName, `batch-b-${Date.now()}`);

      await page.addInitScript(
        ({ storedToken, storedUser }) => {
          localStorage.setItem('token', storedToken);
          localStorage.setItem('user', JSON.stringify(storedUser));
        },
        { storedToken: token, storedUser: user }
      );

      await page.goto(`${baseURL}/netdisk.html`);
      await expect(page.locator('#listContent')).toBeVisible();

      const targetFolderRow = listRow(page, targetFolderName);
      const sourceFolderRow = listRow(page, sourceFolderName);
      const firstFileRow = listRow(page, firstFileName);
      const secondFileRow = listRow(page, secondFileName);

      await expect(targetFolderRow).toBeVisible();
      await expect(sourceFolderRow).toBeVisible();
      await expect(firstFileRow).toBeVisible();
      await expect(secondFileRow).toBeVisible();

      await page.locator('#selectionModeToggle').click();
      await expect(page.locator('#bulkActionsBar')).toBeVisible();

      await itemCheckbox(sourceFolderRow).check();
      await itemCheckbox(firstFileRow).check();
      await itemCheckbox(secondFileRow).check();

      await expect(page.locator('#selectedCountText')).toContainText('3');

      await page.locator('#batchMoveBtn').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('#actionBatchMoveTarget').selectOption(String(targetFolderId));
      await page.locator('[data-dialog-confirm]').click();

      await expect.poll(async () => {
        const entries = await listFolderEntries(request, token, targetFolderId);
        const names = entries.map(entry => entry.originalName || entry.fileName || entry.name);
        return [
          names.includes(sourceFolderName),
          names.includes(firstFileName),
          names.includes(secondFileName)
        ].every(Boolean);
      }).toBe(true);

      await expect(sourceFolderRow).toHaveCount(0);
      await expect(firstFileRow).toHaveCount(0);
      await expect(secondFileRow).toHaveCount(0);

      await page.locator('#selectionModeToggle').click();
      await targetFolderRow.click();
      await expect(listRow(page, sourceFolderName)).toBeVisible();
      await expect(listRow(page, firstFileName)).toBeVisible();
      await expect(listRow(page, secondFileName)).toBeVisible();

      await page.locator('#selectionModeToggle').click();
      await expect(page.locator('#bulkActionsBar')).toBeVisible();
      await page.locator('#selectAllVisibleBtn').click();
      await expect(page.locator('#selectedCountText')).toContainText('3');

      await page.locator('#batchDeleteBtn').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('[data-dialog-confirm]').click();

      await expect.poll(async () => {
        const entries = await listFolderEntries(request, token, targetFolderId);
        return entries.length;
      }).toBe(0);

      await expect(listRow(page, sourceFolderName)).toHaveCount(0);
      await expect(listRow(page, firstFileName)).toHaveCount(0);
      await expect(listRow(page, secondFileName)).toHaveCount(0);
    } finally {
      await deleteFolderIfExists(request, token, targetFolderId);
    }
  });

  test('uses browser back to restore previous netdisk folder context', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const parentFolderName = uniqueName('e2e-history-parent');
    const childFolderName = uniqueName('e2e-history-child');
    const historyFileName = uniqueName('e2e-history-file') + '.txt';

    let parentFolderId = null;

    try {
      const parentFolder = await createFolder(request, token, parentFolderName, 0);
      parentFolderId = parentFolder.id;
      const childFolder = await createFolder(request, token, childFolderName, parentFolderId);
      await uploadTextFile(request, token, childFolder.id, historyFileName, `history-${Date.now()}`);

      await page.addInitScript(
        ({ storedToken, storedUser }) => {
          localStorage.setItem('token', storedToken);
          localStorage.setItem('user', JSON.stringify(storedUser));
        },
        { storedToken: token, storedUser: user }
      );

      await page.goto(`${baseURL}/netdisk.html`);

      const parentFolderRow = listRow(page, parentFolderName);
      await expect(parentFolderRow).toBeVisible();
      await parentFolderRow.click();

      const childFolderRow = listRow(page, childFolderName);
      await expect(childFolderRow).toBeVisible();
      await expect(parentFolderRow).toHaveCount(0);

      await childFolderRow.click();
      await expect(listRow(page, historyFileName)).toBeVisible();
      await expect(childFolderRow).toHaveCount(0);

      await page.goBack();
      await expect(childFolderRow).toBeVisible();
      await expect(listRow(page, historyFileName)).toHaveCount(0);

      await page.goBack();
      await expect(parentFolderRow).toBeVisible();
      await expect(childFolderRow).toHaveCount(0);
    } finally {
      await deleteFolderIfExists(request, token, parentFolderId);
    }
  });
});
