import { buildApiUrl } from './config';
import type {
  QuickShareFileInfo,
  QuickShareNotification,
  QuickShareResult,
  QuickShareRegistrationSettings,
  QuickSharePlan,
  QuickSharePaymentOptions,
  QuickSharePaymentOrder,
  QuickShareTransferPublicShare,
  QuickShareTransferDirectSession,
  QuickShareTransferPairClaim,
  QuickShareTransferPairCode,
  QuickShareTransferRelay,
  QuickShareTransferRtcConfig,
  QuickShareTransferTask,
  QuickShareTransferSync,
  QuickShareSessionState,
  QuickShareShareLink,
  QuickShareUploadAsset,
  QuickShareUser,
} from '../types/quickshare';

async function parseJson<T>(response: Response): Promise<QuickShareResult<T>> {
  const text = await response.text();
  let payload: QuickShareResult<T> | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as QuickShareResult<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload || payload.code !== 200) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }

  return payload;
}

export async function login(username: string, password: string): Promise<QuickShareSessionState> {
  const response = await fetch(buildApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const result = await parseJson<QuickShareUser>(response);
  if (!result.data?.token) {
    throw new Error('Missing JWT token in login response');
  }

  return {
    token: result.data.token,
    user: result.data,
  };
}

export async function sendRegistrationCode(email: string): Promise<void> {
  const response = await fetch(buildApiUrl('/api/auth/send-code'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, locale: 'en' }),
  });
  await parseJson<string>(response);
}

export async function registerAccount(payload: {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  verificationCode?: string;
}): Promise<QuickShareUser> {
  const response = await fetch(buildApiUrl('/api/auth/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<QuickShareUser>(response);
  return result.data;
}

export async function googleLogin(idToken: string): Promise<QuickShareSessionState> {
  const response = await fetch(buildApiUrl('/api/auth/google'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const result = await parseJson<QuickShareUser>(response);
  if (!result.data?.token) {
    throw new Error('Missing JWT token in Google login response');
  }

  return {
    token: result.data.token,
    user: result.data,
  };
}

export async function fetchRegistrationSettings(): Promise<QuickShareRegistrationSettings> {
  const response = await fetch(buildApiUrl('/api/public/registration-settings'));
  const result = await parseJson<QuickShareRegistrationSettings>(response);
  return result.data || {};
}

export async function fetchGlobalNotifications(limit = 10): Promise<QuickShareNotification[]> {
  const url = new URL(buildApiUrl('/api/public/notifications'));
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  const result = await parseJson<QuickShareNotification[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function fetchPersonalNotifications(token: string, limit = 10): Promise<QuickShareNotification[]> {
  const url = new URL(buildApiUrl('/api/notifications/personal'));
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await parseJson<QuickShareNotification[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function fetchPlans(): Promise<QuickSharePlan[]> {
  const response = await fetch(buildApiUrl('/api/public/plans'));
  const result = await parseJson<QuickSharePlan[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function fetchPaymentOptions(): Promise<QuickSharePaymentOptions | null> {
  const response = await fetch(buildApiUrl('/api/public/payment-options'));
  const result = await parseJson<QuickSharePaymentOptions | null>(response);
  return result.data || null;
}

export async function fetchPaymentOrders(token: string): Promise<QuickSharePaymentOrder[]> {
  const response = await fetch(buildApiUrl('/api/payment/orders'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await parseJson<QuickSharePaymentOrder[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function fetchPaymentOrder(token: string, orderNo: string): Promise<QuickSharePaymentOrder | null> {
  const response = await fetch(buildApiUrl(`/api/payment/order/${encodeURIComponent(orderNo)}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await parseJson<QuickSharePaymentOrder | null>(response);
  return result.data || null;
}

export async function createPaymentOrder(
  token: string,
  payload: { planId: number; providerId?: number; payType?: string; returnUrl: string },
): Promise<{ redirectUrl?: string }> {
  const response = await fetch(buildApiUrl('/api/payment/create'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<{ redirectUrl?: string }>(response);
  return result.data || {};
}

export async function fetchProfile(token: string): Promise<QuickShareUser> {
  const response = await fetch(buildApiUrl('/api/profile'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await parseJson<QuickShareUser>(response);
  return result.data;
}

export async function fetchFiles(token: string, folderId: number | null): Promise<QuickShareFileInfo[]> {
  const url = new URL(buildApiUrl('/api/files'));
  if (folderId !== null) {
    url.searchParams.set('folderId', String(folderId));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await parseJson<QuickShareFileInfo[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function fetchAllFolders(token: string): Promise<QuickShareFileInfo[]> {
  const response = await fetch(buildApiUrl('/api/folders/all'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await parseJson<QuickShareFileInfo[]>(response);
  return Array.isArray(result.data) ? result.data : [];
}

export async function createFolder(token: string, name: string, parentId: number | null): Promise<QuickShareFileInfo> {
  const response = await fetch(buildApiUrl('/api/folders'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      parentId: parentId ?? 0,
    }),
  });

  const result = await parseJson<QuickShareFileInfo>(response);
  return result.data;
}

export async function renameFile(token: string, fileId: number, newName: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/files/${fileId}/rename`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newName }),
  });
  await parseJson<null>(response);
}

export async function renameFolder(token: string, folderId: number, newName: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/folders/${folderId}/rename`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newName }),
  });
  await parseJson<null>(response);
}

export async function deleteFile(token: string, fileId: number): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/files/${fileId}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await parseJson<null>(response);
}

export async function deleteFolder(token: string, folderId: number): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/folders/${folderId}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await parseJson<null>(response);
}

export async function moveFile(token: string, fileId: number, targetFolderId: number | null): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/files/${fileId}/move`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetFolderId: targetFolderId ?? 0 }),
  });
  await parseJson<null>(response);
}

export async function moveFolder(token: string, folderId: number, targetFolderId: number | null): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/folders/${folderId}/move`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetFolderId: targetFolderId ?? 0 }),
  });
  await parseJson<null>(response);
}

export async function uploadFile(token: string, file: QuickShareUploadAsset, folderId: number | null): Promise<QuickShareFileInfo> {
  const formData = new FormData();
  const blob = await fetch(file.uri).then((response) => response.blob());
  formData.append('file', blob, file.name);
  if (folderId !== null) {
    formData.append('folderId', String(folderId));
  }

  const response = await fetch(buildApiUrl('/api/upload'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await parseJson<QuickShareFileInfo>(response);
  return result.data;
}

export async function createShareLink(
  token: string,
  fileId: number,
  options?: { extractCode?: string; expireHours?: number; maxDownload?: number },
): Promise<QuickShareShareLink> {
  const response = await fetch(buildApiUrl('/api/share'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      extractCode: options?.extractCode || null,
      expireHours: options?.expireHours ?? null,
      maxDownload: options?.maxDownload ?? null,
    }),
  });

  const result = await parseJson<QuickShareShareLink>(response);
  return result.data;
}

export async function getShareInfo(shareCode: string, extractCode: string): Promise<QuickShareShareLink> {
  const url = new URL(buildApiUrl(`/api/share/${encodeURIComponent(shareCode)}`));
  url.searchParams.set('extractCode', extractCode);

  const response = await fetch(url.toString());
  const result = await parseJson<QuickShareShareLink>(response);
  return result.data;
}

export async function getTransferPickupInfo(shareToken: string): Promise<QuickShareTransferPublicShare> {
  const response = await fetch(buildApiUrl(`/api/public/transfer/shares/${encodeURIComponent(shareToken)}`));
  const result = await parseJson<QuickShareTransferPublicShare>(response);
  return result.data;
}

export async function createTransferPublicShare(
  file: QuickShareUploadAsset,
  senderLabel: string,
): Promise<QuickShareTransferPublicShare> {
  const response = await fetch(buildApiUrl('/api/public/transfer/shares'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      senderLabel,
      fileName: file.name,
      fileSize: await fetch(file.uri).then((r) => r.blob()).then((b) => b.size),
      contentType: file.mimeType || 'application/octet-stream',
      chunkSize: 2 * 1024 * 1024,
    }),
  });

  const result = await parseJson<QuickShareTransferPublicShare>(response);
  return result.data;
}

export async function uploadTransferPublicShareChunk(
  shareToken: string,
  chunkIndex: number,
  body: Blob,
): Promise<QuickShareTransferPublicShare> {
  const response = await fetch(buildApiUrl(`/api/public/transfer/shares/${encodeURIComponent(shareToken)}/chunks/${chunkIndex}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body,
  });

  const result = await parseJson<QuickShareTransferPublicShare>(response);
  return result.data;
}

export async function createAndUploadTransferPublicShare(
  file: QuickShareUploadAsset,
  senderLabel: string,
): Promise<QuickShareTransferPublicShare> {
  const blob = await fetch(file.uri).then((response) => response.blob());
  const created = await createTransferPublicShare(file, senderLabel);
  const chunkSize = created.chunkSize || blob.size;
  let latest = created;

  for (let index = 0; index < Math.max(1, Math.ceil(blob.size / chunkSize)); index += 1) {
    const chunk = blob.slice(index * chunkSize, Math.min(blob.size, (index + 1) * chunkSize));
    latest = await uploadTransferPublicShareChunk(created.shareToken, index, chunk);
  }

  return latest;
}

export async function fetchTransferSync(
  token: string,
  payload: { deviceId: string; deviceName: string; deviceType: string },
): Promise<QuickShareTransferSync> {
  const response = await fetch(buildApiUrl('/api/transfer/sync'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await parseJson<QuickShareTransferSync>(response);
  return {
    currentDevice: result.data?.currentDevice,
    devices: Array.isArray(result.data?.devices) ? result.data.devices : [],
    incomingTasks: Array.isArray(result.data?.incomingTasks) ? result.data.incomingTasks : [],
    outgoingTasks: Array.isArray(result.data?.outgoingTasks) ? result.data.outgoingTasks : [],
    incomingTransfers: Array.isArray(result.data?.incomingTransfers) ? result.data.incomingTransfers as QuickShareTransferRelay[] : [],
    outgoingTransfers: Array.isArray(result.data?.outgoingTransfers) ? result.data.outgoingTransfers as QuickShareTransferRelay[] : [],
    recommendedChunkSize: result.data?.recommendedChunkSize,
  };
}

export async function fetchTransferRtcConfig(): Promise<QuickShareTransferRtcConfig | null> {
  const response = await fetch(buildApiUrl('/api/public/transfer/rtc-config'));
  const result = await parseJson<QuickShareTransferRtcConfig | null>(response);
  return result.data || null;
}

export async function createTransferDirectSession(
  token: string,
  payload: { deviceId: string; targetDeviceId: string },
): Promise<QuickShareTransferDirectSession | null> {
  const response = await fetch(buildApiUrl('/api/transfer/direct-sessions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<QuickShareTransferDirectSession | null>(response);
  return result.data || null;
}

export async function syncTransferDirectAttempt(
  token: string,
  payload: {
    taskId?: number | null;
    taskKey?: string;
    deviceId: string;
    senderDeviceId: string;
    receiverDeviceId: string;
    clientTransferId: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    totalChunks?: number;
    completedChunks?: number;
    status: string;
    startReason?: string;
    endReason?: string;
    failureReason?: string;
    savedToNetdisk?: boolean;
    downloaded?: boolean;
  },
): Promise<QuickShareTransferTask | null> {
  const response = await fetch(buildApiUrl('/api/transfer/tasks/direct-attempts'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<QuickShareTransferTask | null>(response);
  return result.data || null;
}

export async function createTransferPairCode(payload: {
  deviceId: string;
  guestId?: string;
  deviceName: string;
  deviceType: string;
}, token?: string): Promise<QuickShareTransferPairCode | null> {
  const response = await fetch(buildApiUrl('/api/public/transfer/pair-codes'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<QuickShareTransferPairCode | null>(response);
  return result.data || null;
}

export async function claimTransferPairCode(
  code: string,
  payload: { deviceId: string; guestId?: string; deviceName: string; deviceType: string },
  token?: string,
): Promise<QuickShareTransferPairClaim | null> {
  const response = await fetch(buildApiUrl(`/api/public/transfer/pair-codes/${encodeURIComponent(code)}/claim`), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<QuickShareTransferPairClaim | null>(response);
  return result.data || null;
}

export async function createTransferRelay(
  token: string,
  payload: {
    taskId?: number | null;
    deviceId: string;
    receiverDeviceId: string;
    taskKey?: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    chunkSize: number;
  },
): Promise<Record<string, unknown>> {
  const response = await fetch(buildApiUrl('/api/transfer/transfers'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await parseJson<Record<string, unknown>>(response);
  return result.data || {};
}

export async function uploadTransferRelayChunk(
  token: string,
  transferId: number,
  deviceId: string,
  chunkIndex: number,
  body: Blob,
): Promise<Record<string, unknown>> {
  const url = new URL(buildApiUrl(`/api/transfer/transfers/${transferId}/chunks/${chunkIndex}`));
  url.searchParams.set('deviceId', deviceId);

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body,
  });
  const result = await parseJson<Record<string, unknown>>(response);
  return result.data || {};
}

export async function createAndUploadTransferRelay(
  token: string,
  payload: {
    deviceId: string;
    receiverDeviceId: string;
    file: QuickShareUploadAsset;
    taskKey?: string;
    recommendedChunkSize?: number;
  },
): Promise<Record<string, unknown>> {
  const blob = await fetch(payload.file.uri).then((response) => response.blob());
  let transfer = await createTransferRelay(token, {
    deviceId: payload.deviceId,
    receiverDeviceId: payload.receiverDeviceId,
    taskKey: payload.taskKey,
    fileName: payload.file.name,
    fileSize: blob.size,
    contentType: payload.file.mimeType || 'application/octet-stream',
    chunkSize: payload.recommendedChunkSize || 2 * 1024 * 1024,
  });

  const transferId = Number(transfer.id);
  const chunkSize = Number(transfer.chunkSize || payload.recommendedChunkSize || blob.size);
  const totalChunks = Math.max(1, Math.ceil(blob.size / chunkSize));
  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = blob.slice(index * chunkSize, Math.min(blob.size, (index + 1) * chunkSize));
    transfer = await uploadTransferRelayChunk(token, transferId, payload.deviceId, index, chunk);
  }
  return transfer;
}

export function buildTransferRelayDownloadUrl(transferId: number, deviceId: string, token: string): string {
  const url = new URL(buildApiUrl(`/api/transfer/transfers/${transferId}/download`));
  url.searchParams.set('deviceId', deviceId);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function saveTransferRelayToNetdisk(
  token: string,
  transferId: number,
  payload: { deviceId: string; folderId?: number | null },
): Promise<QuickShareFileInfo> {
  const response = await fetch(buildApiUrl(`/api/transfer/transfers/${transferId}/save`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: payload.deviceId,
      folderId: payload.folderId ?? 0,
    }),
  });
  const result = await parseJson<QuickShareFileInfo>(response);
  return result.data;
}

export async function deleteTransferTask(token: string, taskId: number, deviceId: string): Promise<void> {
  const url = new URL(buildApiUrl(`/api/transfer/tasks/${taskId}`));
  url.searchParams.set('deviceId', deviceId);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await parseJson<null>(response);
}

export async function saveTransferPickupToNetdisk(token: string, shareToken: string, folderId: number | null): Promise<QuickShareFileInfo> {
  const response = await fetch(buildApiUrl(`/api/transfer/public-shares/${encodeURIComponent(shareToken)}/save`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folderId: folderId ?? 0 }),
  });

  const result = await parseJson<QuickShareFileInfo>(response);
  return result.data;
}

export function buildOwnedFileDownloadUrl(fileId: number, token: string): string {
  const url = new URL(buildApiUrl(`/api/files/${fileId}/download`));
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildOwnedFilePreviewUrl(fileId: number, token: string): string {
  const url = new URL(buildApiUrl(`/api/files/${fileId}/preview`));
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildShareDownloadUrl(shareCode: string, extractCode: string): string {
  const url = new URL(buildApiUrl(`/api/download/${encodeURIComponent(shareCode)}`));
  url.searchParams.set('extractCode', extractCode);
  return url.toString();
}

export function buildSharePreviewUrl(shareCode: string, extractCode: string): string {
  const url = new URL(buildApiUrl(`/api/preview/${encodeURIComponent(shareCode)}`));
  url.searchParams.set('extractCode', extractCode);
  return url.toString();
}

export function buildTransferPickupDownloadUrl(shareToken: string): string {
  return buildApiUrl(`/api/public/transfer/shares/${encodeURIComponent(shareToken)}/download`);
}

export function buildTransferPickupPreviewUrl(shareToken: string): string {
  return buildApiUrl(`/api/public/transfer/shares/${encodeURIComponent(shareToken)}/preview`);
}
