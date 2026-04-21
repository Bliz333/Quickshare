export interface QuickShareResult<T> {
  code: number;
  message: string;
  data: T;
}

export interface QuickShareUser {
  id: number;
  username: string;
  email?: string;
  nickname?: string;
  token?: string;
  role?: string;
  storageLimit?: number;
  storageUsed?: number;
  downloadLimit?: number;
  downloadUsed?: number;
  vipExpireTime?: string;
}

export interface QuickShareNotification {
  id: number;
  scope?: string;
  subject?: string;
  body?: string;
  createTime?: string;
}

export interface QuickShareFileInfo {
  id: number;
  fileName?: string;
  originalName?: string;
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  uploadTime?: string;
  name?: string;
  isFolder?: number;
  parentId?: number;
  folderId?: number;
  fileCount?: number;
  createTime?: string;
}

export interface QuickShareSessionState {
  token: string;
  user: QuickShareUser;
}

export interface QuickShareRegistrationSettings {
  emailVerificationEnabled?: boolean;
  recaptchaEnabled?: boolean;
  captchaProvider?: string;
  recaptchaSiteKey?: string;
  googleClientId?: string;
  appleClientId?: string;
}

export interface QuickShareShareLink {
  shareCode: string;
  shareUrl?: string;
  extractCode?: string;
  expireTime?: string;
  maxDownload?: number;
  fileName?: string;
  fileType?: string;
}

export interface QuickShareTransferPublicShare {
  id: number;
  shareToken: string;
  senderLabel?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  chunkSize?: number;
  status?: string;
  ready?: boolean;
  pickupUrl?: string;
  updateTime?: string;
}

export interface QuickShareTransferDevice {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  current?: boolean;
  online?: boolean;
  lastSeenAt?: string;
}

export interface QuickShareTransferTaskAttempt {
  transferMode?: string;
  transferId?: string;
  stage?: string;
  attemptStatus?: string;
  startReason?: string;
  endReason?: string;
  failureReason?: string;
  completedChunks?: number;
  totalChunks?: number;
  startTime?: string;
  updateTime?: string;
  completedAt?: string;
  failedAt?: string;
  fallbackAt?: string;
  savedToNetdiskAt?: string;
  downloadedAt?: string;
}

export interface QuickShareTransferTask {
  id: number;
  taskKey?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  direction?: string;
  transferMode?: string;
  currentTransferMode?: string;
  stage?: string;
  attemptStatus?: string;
  startReason?: string;
  endReason?: string;
  failureReason?: string;
  peerLabel?: string;
  peerDeviceId?: string;
  senderDeviceId?: string;
  receiverDeviceId?: string;
  completedChunks?: number;
  totalChunks?: number;
  startTime?: string;
  completedAt?: string;
  failedAt?: string;
  fallbackAt?: string;
  savedToNetdiskAt?: string;
  attempts?: QuickShareTransferTaskAttempt[];
  createTime?: string;
  updateTime?: string;
}

export interface QuickShareTransferRelay {
  id: number;
  taskId?: number;
  taskKey?: string;
  direction?: string;
  transferMode?: string;
  peerDeviceId?: string;
  peerLabel?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  chunkSize?: number;
  totalChunks?: number;
  uploadedChunks?: number;
  uploadedChunkIndexes?: number[];
  status?: string;
  ready?: boolean;
  downloadedAt?: string;
}

export interface QuickShareTransferIceServer {
  urls?: string[];
  username?: string;
  credential?: string;
}

export interface QuickShareTransferRtcConfig {
  directTransferEnabled?: boolean;
  iceServers?: QuickShareTransferIceServer[];
}

export interface QuickShareTransferDirectSession {
  pairSessionId?: string;
  selfChannelId?: string;
  selfDeviceId?: string;
  peerChannelId?: string;
  peerDeviceId?: string;
  peerLabel?: string;
}

export interface QuickShareDirectTransportSummary {
  connectionState: string;
  signalingState: string;
  controlChannelState: string;
  fileChannelState: string;
  hasLocalOffer: boolean;
}

export interface QuickShareTransferPairCode {
  code: string;
  pairSessionId?: string;
  creatorLabel?: string;
  creatorChannelId?: string;
  expireTime?: string;
}

export interface QuickShareTransferPairClaim {
  pairSessionId?: string;
  claimerChannelId?: string;
  creatorChannelId?: string;
  peerLabel?: string;
  peerDeviceId?: string;
}

export interface QuickShareTransferSync {
  currentDevice?: QuickShareTransferDevice;
  devices?: QuickShareTransferDevice[];
  incomingTasks?: QuickShareTransferTask[];
  outgoingTasks?: QuickShareTransferTask[];
  incomingTransfers?: QuickShareTransferRelay[];
  outgoingTransfers?: QuickShareTransferRelay[];
  recommendedChunkSize?: number;
}

export interface QuickShareUploadAsset {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface QuickSharePlan {
  id: number;
  name?: string;
  description?: string;
  type?: string;
  value?: number;
  price?: number;
}

export interface QuickSharePaymentOptions {
  providerId?: number;
  providerName?: string;
  payTypes?: string[];
}

export interface QuickSharePaymentOrder {
  id?: number;
  orderNo: string;
  planName?: string;
  amount?: number;
  status?: string;
  payType?: string;
  tradeNo?: string;
  createTime?: string;
}
