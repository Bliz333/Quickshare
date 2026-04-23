import {
  buildOwnedFileDownloadUrl,
  buildOwnedFilePreviewUrl,
  buildShareDownloadUrl,
  buildSharePreviewUrl,
  buildTransferPickupDownloadUrl,
  buildTransferPickupPreviewUrl,
  createAndUploadTransferPublicShare,
  createAndUploadTransferRelay,
  createPaymentOrder,
  createShareLink,
  fetchFiles,
  fetchPaymentOrder,
  fetchPaymentOptions,
  fetchPaymentOrders,
  fetchPlans,
  fetchProfile,
  fetchTransferSync,
  getTransferPickupInfo,
  login,
  registerAccount,
  saveTransferPickupToNetdisk,
  sendRegistrationCode,
  uploadFile,
} from './api';

type MockJson = { code: number; message: string; data: unknown };

function jsonResponse(data: unknown, status = 200): Response {
  const payload: MockJson = { code: status === 200 ? 200 : status, message: status === 200 ? 'success' : 'error', data };
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

class MockFormData {
  entries: Array<[string, unknown, string | undefined]> = [];

  append(name: string, value: unknown, fileName?: string) {
    this.entries.push([name, value, fileName]);
  }
}

describe('mobile api baseline', () => {
  const originalFetch = global.fetch;
  const originalFormData = global.FormData;

  beforeEach(() => {
    global.fetch = jest.fn();
    // @ts-expect-error test shim
    global.FormData = MockFormData;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.FormData = originalFormData;
    jest.restoreAllMocks();
  });

  test('auth and profile flows hit the expected endpoints', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', token: 'jwt-token' }))
      .mockResolvedValueOnce(jsonResponse('sent'))
      .mockResolvedValueOnce(jsonResponse({ id: 2, username: 'new-user' }))
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', nickname: 'QuickShare Admin' }));

    await expect(login('admin', 'secret')).resolves.toEqual({
      token: 'jwt-token',
      user: expect.objectContaining({ username: 'admin' }),
    });
    await expect(sendRegistrationCode('admin@example.com')).resolves.toBeUndefined();
    await expect(registerAccount({ username: 'new-user', password: 'secret', email: 'new@example.com' })).resolves.toEqual(
      expect.objectContaining({ username: 'new-user' })
    );
    await expect(fetchProfile('jwt-token')).resolves.toEqual(expect.objectContaining({ nickname: 'QuickShare Admin' }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8080/api/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ username: 'admin', password: 'secret' }) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8080/api/auth/send-code',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'admin@example.com', locale: 'en' }) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:8080/api/profile',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-token' } })
    );
  });

  test('plans, payments, and redirect metadata are fetched through mobile api helpers', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ id: 8, name: 'Pro' }]))
      .mockResolvedValueOnce(jsonResponse({ providerId: 3, providerName: 'SmokePay', payTypes: ['alipay'] }))
      .mockResolvedValueOnce(jsonResponse([{ id: 4, orderNo: 'ORD-1' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 4, orderNo: 'ORD-1', status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ redirectUrl: 'https://pay.example.test/submit?ok=1' }));

    await expect(fetchPlans()).resolves.toEqual([expect.objectContaining({ name: 'Pro' })]);
    await expect(fetchPaymentOptions()).resolves.toEqual(expect.objectContaining({ providerName: 'SmokePay' }));
    await expect(fetchPaymentOrders('jwt-token')).resolves.toEqual([expect.objectContaining({ orderNo: 'ORD-1' })]);
    await expect(fetchPaymentOrder('jwt-token', 'ORD-1')).resolves.toEqual(expect.objectContaining({ status: 'pending' }));
    await expect(createPaymentOrder('jwt-token', { planId: 8, providerId: 3, payType: 'alipay', returnUrl: 'http://127.0.0.1:8080/payment-result.html' }))
      .resolves.toEqual(expect.objectContaining({ redirectUrl: 'https://pay.example.test/submit?ok=1' }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:8080/api/payment/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
      })
    );
  });

  test('files, share links, pickup, and save-to-netdisk flows use the expected endpoints', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const blob = { size: 5 };

    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ id: 1, originalName: 'report.pdf' }]))
      .mockResolvedValueOnce({ blob: async () => blob } as Response)
      .mockResolvedValueOnce(jsonResponse({ id: 2, originalName: 'upload.txt' }))
      .mockResolvedValueOnce(jsonResponse({ shareCode: 'SC123', extractCode: 'ABCD' }))
      .mockResolvedValueOnce(jsonResponse({ shareToken: 'pickup-9', fileName: 'hello.txt', ready: true }))
      .mockResolvedValueOnce(jsonResponse({ id: 9, originalName: 'saved.txt' }));

    await expect(fetchFiles('jwt-token', 0)).resolves.toEqual([expect.objectContaining({ originalName: 'report.pdf' })]);
    await expect(uploadFile('jwt-token', { uri: 'file:///tmp/upload.txt', name: 'upload.txt', mimeType: 'text/plain' }, 0))
      .resolves.toEqual(expect.objectContaining({ originalName: 'upload.txt' }));
    await expect(createShareLink('jwt-token', 2, { extractCode: 'ABCD', expireHours: 24, maxDownload: 3 }))
      .resolves.toEqual(expect.objectContaining({ shareCode: 'SC123' }));
    await expect(getTransferPickupInfo('pickup-9')).resolves.toEqual(expect.objectContaining({ ready: true }));
    await expect(saveTransferPickupToNetdisk('jwt-token', 'pickup-9', 0)).resolves.toEqual(expect.objectContaining({ id: 9 }));

    const uploadCall = fetchMock.mock.calls[2];
    expect(uploadCall[0]).toBe('http://127.0.0.1:8080/api/upload');
    expect(uploadCall[1].method).toBe('POST');
    const uploadForm = uploadCall[1].body as MockFormData;
    expect(uploadForm.entries).toEqual([
      ['file', blob, 'upload.txt'],
      ['folderId', '0', undefined],
    ]);

    expect(buildOwnedFileDownloadUrl(2, 'jwt-token')).toContain('/api/files/2/download');
    expect(buildOwnedFilePreviewUrl(2, 'jwt-token')).toContain('/api/files/2/preview');
    expect(buildShareDownloadUrl('SC123', 'ABCD')).toContain('/api/download/SC123');
    expect(buildSharePreviewUrl('SC123', 'ABCD')).toContain('/api/preview/SC123');
    expect(buildTransferPickupDownloadUrl('pickup-9')).toContain('/api/public/transfer/shares/pickup-9/download');
    expect(buildTransferPickupPreviewUrl('pickup-9')).toContain('/api/public/transfer/shares/pickup-9/preview');
  });

  test('public share upload, relay upload, and transfer sync flows are exercised', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const chunk = { kind: 'chunk-0' };
    const blob = {
      size: 5,
      slice: jest.fn(() => chunk),
    };

    fetchMock
      .mockResolvedValueOnce({ blob: async () => blob } as unknown as Response)
      .mockResolvedValueOnce({ blob: async () => blob } as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ shareToken: 'pickup-9', chunkSize: 5 }))
      .mockResolvedValueOnce(jsonResponse({ shareToken: 'pickup-9', ready: true }))
      .mockResolvedValueOnce(jsonResponse({
        currentDevice: { deviceId: 'mobile-a' },
        devices: [{ deviceId: 'mobile-a' }, { deviceId: 'mobile-b' }],
        incomingTasks: [{ id: 1, fileName: 'incoming.txt' }],
        outgoingTasks: [{ id: 2, fileName: 'outgoing.txt' }],
        recommendedChunkSize: 64 * 1024,
      }))
      .mockResolvedValueOnce({ blob: async () => blob } as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ id: 44, chunkSize: 5 }))
      .mockResolvedValueOnce(jsonResponse({ id: 44, status: 'ready' }));

    await expect(createAndUploadTransferPublicShare({ uri: 'file:///tmp/public.txt', name: 'public.txt', mimeType: 'text/plain' }, 'Guest Share'))
      .resolves.toEqual(expect.objectContaining({ ready: true }));
    await expect(fetchTransferSync('jwt-token', { deviceId: 'mobile-a', deviceName: 'My Phone', deviceType: 'Android' }))
      .resolves.toEqual(expect.objectContaining({ devices: expect.arrayContaining([expect.objectContaining({ deviceId: 'mobile-b' })]) }));
    await expect(createAndUploadTransferRelay('jwt-token', {
      deviceId: 'mobile-a',
      receiverDeviceId: 'mobile-b',
      file: { uri: 'file:///tmp/relay.txt', name: 'relay.txt', mimeType: 'text/plain' },
      recommendedChunkSize: 5,
    })).resolves.toEqual(expect.objectContaining({ status: 'ready' }));

    expect(blob.slice).toHaveBeenCalled();
    expect(fetchMock.mock.calls[2][0]).toBe('http://127.0.0.1:8080/api/public/transfer/shares');
    expect(fetchMock.mock.calls[4][0]).toBe('http://127.0.0.1:8080/api/transfer/sync');
    expect(fetchMock.mock.calls[6][0]).toBe('http://127.0.0.1:8080/api/transfer/transfers');
  });
});
