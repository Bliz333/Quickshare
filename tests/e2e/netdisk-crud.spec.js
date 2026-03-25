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

async function seedSession(page, token, user) {
  await page.addInitScript(
    ({ storedToken, storedUser }) => {
      localStorage.setItem('token', storedToken);
      localStorage.setItem('user', JSON.stringify(storedUser));
    },
    { storedToken: token, storedUser: user }
  );
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

async function deleteFileIfExists(request, token, fileId) {
  if (!fileId) return;

  await request.delete(`/api/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function deleteFolderIfExists(request, token, folderId) {
  if (!folderId) return;

  await request.delete(`/api/folders/${folderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function listRow(page, name) {
  return page.locator('#listContent > div').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

function gridCard(page, name) {
  return page.locator('#gridView > div').filter({
    has: page.getByText(name, { exact: true })
  }).first();
}

async function getVisibleNetdiskItem(page, name) {
  const listItem = listRow(page, name);
  if (await listItem.isVisible().catch(() => false)) {
    return listItem;
  }

  return gridCard(page, name);
}

test.describe('Netdisk CRUD dialogs', () => {
  test('creates folders, renames items, shares a file, and deletes everything through the page dialogs', async ({ page, request, baseURL }) => {
    const { token, user } = await loginAsAdmin(request);
    const folderName = uniqueName('e2e-crud-folder');
    const renamedFolderName = uniqueName('e2e-crud-folder-renamed');
    const fileName = uniqueName('e2e-crud-file') + '.txt';
    const renamedFileName = uniqueName('e2e-crud-file-renamed') + '.txt';
    const fileContent = `crud-${Date.now()}`;

    let folderId = null;
    let fileId = null;

    try {
      await seedSession(page, token, user);
      await page.goto(`${baseURL}/netdisk.html`);
      await expect(page.locator('button[onclick="createFolder()"]')).toBeVisible();

      const createFolderPromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/folders')
          && response.request().method() === 'POST';
      });
      await page.locator('button[onclick="createFolder()"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('#actionFolderName').fill(folderName);
      await page.locator('[data-dialog-confirm]').click();

      const createFolderResponse = await createFolderPromise;
      expect(createFolderResponse.ok()).toBeTruthy();
      const createdFolder = await readJson(createFolderResponse);
      folderId = createdFolder.id;

      await page.reload();
      const createdFolderItem = await getVisibleNetdiskItem(page, folderName);
      await expect(createdFolderItem).toBeVisible();

      const renameFolderPromise = page.waitForResponse(response => {
        return response.url().includes(`/api/folders/${folderId}/rename`)
          && response.request().method() === 'PUT';
      });
      await createdFolderItem.locator('button[onclick*="renameFolder"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('#actionRenameValue').fill(renamedFolderName);
      await page.locator('[data-dialog-confirm]').click();

      const renameFolderResponse = await renameFolderPromise;
      expect(renameFolderResponse.ok()).toBeTruthy();
      expect((await renameFolderResponse.json()).code).toBe(200);
      const renamedFolderItem = await getVisibleNetdiskItem(page, renamedFolderName);
      await expect(renamedFolderItem).toBeVisible();

      await renamedFolderItem.click();
      await expect(page.locator('#breadcrumbPath')).toContainText(renamedFolderName);

      const uploadedFile = await uploadTextFile(request, token, folderId, fileName, fileContent);
      fileId = uploadedFile.id;

      await page.reload();
      const uploadedFileItem = await getVisibleNetdiskItem(page, fileName);
      await expect(uploadedFileItem).toBeVisible();

      const renameFilePromise = page.waitForResponse(response => {
        return response.url().includes(`/api/files/${fileId}/rename`)
          && response.request().method() === 'PUT';
      });
      await uploadedFileItem.locator('button[onclick*="renameFile"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('#actionRenameValue').fill(renamedFileName);
      await page.locator('[data-dialog-confirm]').click();

      const renameFileResponse = await renameFilePromise;
      expect(renameFileResponse.ok()).toBeTruthy();
      expect((await renameFileResponse.json()).code).toBe(200);
      const renamedFileItem = await getVisibleNetdiskItem(page, renamedFileName);
      await expect(renamedFileItem).toBeVisible();

      const sharePromise = page.waitForResponse(response => {
        return response.url().endsWith('/api/share')
          && response.request().method() === 'POST';
      });
      await renamedFileItem.locator('button[onclick*="shareFile"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('#actionShareExtractCode').fill('E2E1');
      await page.locator('#actionShareExpireDays').selectOption('7');
      await page.locator('[data-dialog-confirm]').click();

      const shareResponse = await sharePromise;
      expect(shareResponse.ok()).toBeTruthy();
      const shareResult = await readJson(shareResponse);

      await expect(page.locator('#actionDialogContent .share-result-link').first()).toContainText(`share=${shareResult.shareCode}`);
      await expect(page.locator('#actionDialogContent .share-result-link').nth(1)).toContainText(shareResult.extractCode || 'E2E1');
      await page.locator('[data-dialog-confirm]').click();
      await expect(page.locator('#actionDialog')).not.toHaveClass(/active/);

      const deleteFilePromise = page.waitForResponse(response => {
        return response.url().includes(`/api/files/${fileId}`)
          && response.request().method() === 'DELETE';
      });
      await renamedFileItem.locator('button[onclick*="deleteFile"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('[data-dialog-confirm]').click();

      const deleteFileResponse = await deleteFilePromise;
      expect(deleteFileResponse.ok()).toBeTruthy();
      expect((await deleteFileResponse.json()).code).toBe(200);
      fileId = null;

      await expect((await getVisibleNetdiskItem(page, renamedFileName))).toHaveCount(0);
      await expect.poll(async () => {
        const entries = await listFolderEntries(request, token, folderId);
        return entries.some(entry => (entry.originalName || entry.fileName || entry.name) === renamedFileName);
      }).toBe(false);

      await page.locator('.netdisk-drop-root').click();
      const rootFolderItem = await getVisibleNetdiskItem(page, renamedFolderName);
      await expect(rootFolderItem).toBeVisible();

      const deleteFolderPromise = page.waitForResponse(response => {
        return response.url().includes(`/api/folders/${folderId}`)
          && response.request().method() === 'DELETE';
      });
      await rootFolderItem.locator('button[onclick*="deleteFolder"]').click();
      await expect(page.locator('#actionDialog')).toHaveClass(/active/);
      await page.locator('[data-dialog-confirm]').click();

      const deleteFolderResponse = await deleteFolderPromise;
      expect(deleteFolderResponse.ok()).toBeTruthy();
      expect((await deleteFolderResponse.json()).code).toBe(200);
      folderId = null;

      await expect((await getVisibleNetdiskItem(page, renamedFolderName))).toHaveCount(0);
    } finally {
      await deleteFileIfExists(request, token, fileId);
      await deleteFolderIfExists(request, token, folderId);
    }
  });
});
