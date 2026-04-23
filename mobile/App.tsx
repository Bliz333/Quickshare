import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { StatusBar } from 'expo-status-bar';

import { AccountPanel } from './src/components/AccountPanel';
import { FileBrowser } from './src/components/FileBrowser';
import { HomeDashboard } from './src/components/HomeDashboard';
import { LoginForm } from './src/components/LoginForm';
import { PricingCenter } from './src/components/PricingCenter';
import { RegisterForm } from './src/components/RegisterForm';
import { ShareCenter } from './src/components/ShareCenter';
import { Theme } from './src/theme';
import {
  buildOwnedFileDownloadUrl,
  buildOwnedFilePreviewUrl,
  buildShareDownloadUrl,
  buildSharePreviewUrl,
  buildTransferRelayDownloadUrl,
  buildTransferPickupDownloadUrl,
  buildTransferPickupPreviewUrl,
  createAndUploadTransferPublicShare,
  createAndUploadTransferRelay,
  createTransferDirectSession,
  createPaymentOrder,
  createFolder,
  createShareLink,
  deleteFile,
  deleteFolder,
  deleteTransferTask,
  fetchAllFolders,
  fetchGlobalNotifications,
  fetchPaymentOrder,
  fetchPaymentOrders,
  fetchPaymentOptions,
  fetchPersonalNotifications,
  fetchPlans,
  fetchRegistrationSettings,
  fetchFiles,
  fetchProfile,
  fetchTransferRtcConfig,
  fetchTransferSync,
  googleLogin,
  getShareInfo,
  getTransferPickupInfo,
  login,
  moveFile,
  moveFolder,
  registerAccount,
  renameFile,
  renameFolder,
  saveTransferRelayToNetdisk,
  saveTransferPickupToNetdisk,
  sendRegistrationCode,
  syncTransferDirectAttempt,
  uploadFile,
} from './src/lib/api';
import { QUICKSHARE_API_BASE_URL } from './src/lib/config';
import { buildDirectChunkPacket, parseDirectChunkPacket, QUICKSHARE_DIRECT_CHUNK_SIZE } from './src/lib/directProtocol';
import { assembleIncomingDirectTransfer, prepareIncomingDirectTransfer, saveIncomingDirectChunk } from './src/lib/directStorage';
import { createLocalDirectTransport } from './src/lib/directTransfer';
import { createDirectSignalClient } from './src/lib/directSignal';
import { clearStoredSession, loadOrCreateStoredDeviceId, loadStoredSession, saveStoredSession } from './src/lib/session';
import type {
  QuickShareDirectTransportSummary,
  QuickShareFileInfo,
  QuickShareNotification,
  QuickSharePaymentOptions,
  QuickSharePaymentOrder,
  QuickSharePlan,
  QuickShareRegistrationSettings,
  QuickShareTransferDirectSession,
  QuickShareTransferDevice,
  QuickShareTransferRtcConfig,
  QuickShareSessionState,
  QuickShareShareLink,
  QuickShareTransferPublicShare,
  QuickShareTransferTask,
  QuickShareUploadAsset,
} from './src/types/quickshare';
import type { QuickShareDirectTransportHandle } from './src/lib/directTransfer';
import type { QuickShareIncomingDirectManifest } from './src/lib/directStorage';

WebBrowser.maybeCompleteAuthSession();

type MobileTab = 'home' | 'files' | 'share' | 'account' | 'pricing';

const QUICKSHARE_MOBILE_SCHEME = 'quicksharemobile://payment-result';
const PAYMENT_POLL_INTERVAL_SECONDS = 3;
const PAYMENT_POLL_MAX_ATTEMPTS = 10;

function getOrderNoFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('order_no')
      || parsed.searchParams.get('orderNo')
      || parsed.searchParams.get('out_trade_no')
      || '';
  } catch {
    return '';
  }
}

function mergeOrderIntoList(
  orders: QuickSharePaymentOrder[],
  nextOrder: QuickSharePaymentOrder,
): QuickSharePaymentOrder[] {
  let found = false;
  const merged = orders.map((order) => {
    if (order.orderNo !== nextOrder.orderNo) {
      return order;
    }
    found = true;
    return { ...order, ...nextOrder };
  });

  return found ? merged : [nextOrder, ...merged];
}

function getRelayTransferId(task: QuickShareTransferTask): number | null {
  const relayAttempt = task.attempts?.find((attempt) => attempt.transferMode === 'relay' && attempt.transferId);
  const rawTransferId = relayAttempt?.transferId;
  if (!rawTransferId) {
    return null;
  }
  const transferId = Number.parseInt(rawTransferId, 10);
  return Number.isFinite(transferId) ? transferId : null;
}

function getFallbackRelayTransferId(
  task: QuickShareTransferTask,
  relays: Array<{ id: number; taskId?: number; taskKey?: string; ready?: boolean }>,
): number | null {
  const relay = relays.find((candidate) => {
    if (candidate.ready === false) {
      return false;
    }
    if (task.id && candidate.taskId === task.id) {
      return true;
    }
    return Boolean(task.taskKey && candidate.taskKey === task.taskKey);
  });
  return relay?.id ?? null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [session, setSession] = useState<QuickShareSessionState | null>(null);
  const [registrationSettings, setRegistrationSettings] = useState<QuickShareRegistrationSettings | null>(null);
  const [deviceId, setDeviceId] = useState('mobile-app-device');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [registerVerificationCode, setRegisterVerificationCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [files, setFiles] = useState<QuickShareFileInfo[]>([]);
  const [allFolders, setAllFolders] = useState<QuickShareFileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [path, setPath] = useState<Array<{ id: number | null; label: string }>>([{ id: null, label: 'Root' }]);
  const [createFolderName, setCreateFolderName] = useState('');
  const [actionDraftName, setActionDraftName] = useState('');
  const [actionMoveTargetId, setActionMoveTargetId] = useState('0');
  const [selectedActionItem, setSelectedActionItem] = useState<QuickShareFileInfo | null>(null);
  const [actionMode, setActionMode] = useState<'rename' | 'move' | null>(null);
  const [latestShare, setLatestShare] = useState<QuickShareShareLink | null>(null);
  const [createShareLoading, setCreateShareLoading] = useState(false);
  const [directShareLoading, setDirectShareLoading] = useState(false);
  const [directShareError, setDirectShareError] = useState<string | null>(null);
  const [deviceTransferLoading, setDeviceTransferLoading] = useState(false);
  const [deviceTransferError, setDeviceTransferError] = useState<string | null>(null);
  const [directSessionLoading, setDirectSessionLoading] = useState(false);
  const [directSessionError, setDirectSessionError] = useState<string | null>(null);
  const [latestDirectSession, setLatestDirectSession] = useState<QuickShareTransferDirectSession | null>(null);
  const [latestDirectTransport, setLatestDirectTransport] = useState<QuickShareDirectTransportSummary | null>(null);
  const [latestDirectControlMessage, setLatestDirectControlMessage] = useState<string | null>(null);
  const [latestIncomingDirectFile, setLatestIncomingDirectFile] = useState<string | null>(null);
  const [latestIncomingDirectManifest, setLatestIncomingDirectManifest] = useState<QuickShareIncomingDirectManifest | null>(null);
  const [rtcConfig, setRtcConfig] = useState<QuickShareTransferRtcConfig | null>(null);
  const directTransportRef = useRef<QuickShareDirectTransportHandle | null>(null);
  const directSignalClientRef = useRef<ReturnType<typeof createDirectSignalClient> | null>(null);
  const latestOutgoingDirectTransferRef = useRef<{
    transferId: string;
    taskKey: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    receiverDeviceId: string;
    totalChunks: number;
  } | null>(null);
  const [transferTaskActionError, setTransferTaskActionError] = useState<string | null>(null);
  const [transferTaskActionLoadingId, setTransferTaskActionLoadingId] = useState<number | null>(null);
  const [transferDevices, setTransferDevices] = useState<QuickShareTransferDevice[]>([]);
  const [transferIncomingTasks, setTransferIncomingTasks] = useState<QuickShareTransferTask[]>([]);
  const [transferOutgoingTasks, setTransferOutgoingTasks] = useState<QuickShareTransferTask[]>([]);
  const [transferIncomingRelays, setTransferIncomingRelays] = useState<Array<{ id: number; taskId?: number; taskKey?: string; ready?: boolean }>>([]);
  const [transferRecommendedChunkSize, setTransferRecommendedChunkSize] = useState<number | null>(null);
  const [transferSyncLoading, setTransferSyncLoading] = useState(false);
  const [publicShareCode, setPublicShareCode] = useState('');
  const [publicShareExtractCode, setPublicShareExtractCode] = useState('');
  const [publicShareLoading, setPublicShareLoading] = useState(false);
  const [publicShareError, setPublicShareError] = useState<string | null>(null);
  const [publicShareResult, setPublicShareResult] = useState<QuickShareShareLink | null>(null);
  const [transferPickupToken, setTransferPickupToken] = useState('');
  const [transferPickupLoading, setTransferPickupLoading] = useState(false);
  const [transferPickupError, setTransferPickupError] = useState<string | null>(null);
  const [transferPickupResult, setTransferPickupResult] = useState<QuickShareTransferPublicShare | null>(null);
  const [plans, setPlans] = useState<QuickSharePlan[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<QuickSharePaymentOptions | null>(null);
  const [paymentOrders, setPaymentOrders] = useState<QuickSharePaymentOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<QuickSharePaymentOrder | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [globalNotifications, setGlobalNotifications] = useState<QuickShareNotification[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<QuickShareNotification[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [paymentPollAttempts, setPaymentPollAttempts] = useState(0);
  const [paymentPollSecondsRemaining, setPaymentPollSecondsRemaining] = useState(0);
  const [paymentLastCheckedAt, setPaymentLastCheckedAt] = useState<string | null>(null);

  const googleClientId = registrationSettings?.googleClientId || '';

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
    androidClientId: googleClientId,
    webClientId: googleClientId,
  });

  useEffect(() => {
    (async () => {
      const settings = await fetchRegistrationSettings().catch(() => null);
      if (settings) {
        setRegistrationSettings(settings);
      }
      const storedDeviceId = await loadOrCreateStoredDeviceId().catch(() => 'mobile-app-device');
      setDeviceId(storedDeviceId);
      const storedSession = await Promise.race([
        loadStoredSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]).catch(() => null);
      if (storedSession?.token) {
        setSession(storedSession);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [planList, options] = await Promise.all([
        fetchPlans().catch(() => []),
        fetchPaymentOptions().catch(() => null),
      ]);
      setPlans(planList);
      setPaymentOptions(options);
    })();
  }, []);

  useEffect(() => {
    void fetchGlobalNotifications().then(setGlobalNotifications).catch(() => setGlobalNotifications([]));
  }, []);

  useEffect(() => {
    if (!googleResponse) {
      return;
    }
    if (googleResponse.type !== 'success') {
      setGoogleLoading(false);
      return;
    }

    const idToken = googleResponse.params?.id_token;
    if (!idToken) {
      setAuthError('Google did not return an idToken.');
      setGoogleLoading(false);
      return;
    }

    (async () => {
      try {
        const nextSession = await googleLogin(idToken);
        await saveStoredSession(nextSession);
        setSession(nextSession);
        setActiveTab('home');
        setAuthError(null);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Google login failed');
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse]);

  const loadFileSlice = useCallback(async (
    activeSession: QuickShareSessionState,
    folderId: number | null,
    nextPath?: Array<{ id: number | null; label: string }>,
  ) => {
    setFilesLoading(true);
    setFilesError(null);

    try {
      const [profile, fileEntries] = await Promise.all([
        fetchProfile(activeSession.token),
        fetchFiles(activeSession.token, folderId),
      ]);
      const folderEntries = await fetchAllFolders(activeSession.token).catch(() => []);

      const refreshedSession = { token: activeSession.token, user: profile };
      setSession(refreshedSession);
      await saveStoredSession(refreshedSession);
      setFiles(fileEntries);
      setAllFolders(folderEntries);
      setCurrentFolderId(folderId);
      if (nextPath) {
        setPath(nextPath);
      }
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Failed to load files');
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setFiles([]);
      setTransferDevices([]);
      setTransferIncomingTasks([]);
      setTransferOutgoingTasks([]);
      setTransferIncomingRelays([]);
      setLatestDirectSession(null);
      setLatestDirectTransport(null);
      setLatestIncomingDirectFile(null);
      setLatestIncomingDirectManifest(null);
      setDirectSessionError(null);
      setRtcConfig(null);
      directSignalClientRef.current?.close();
      setTransferTaskActionError(null);
      setTransferTaskActionLoadingId(null);
      setTransferRecommendedChunkSize(null);
      setPaymentOrders([]);
      setSelectedOrder(null);
      return;
    }

    void loadFileSlice(session, currentFolderId, path);
  }, [loadFileSlice, session?.token]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    (async () => {
      setPaymentLoading(true);
      try {
        const orders = await fetchPaymentOrders(session.token);
        setPaymentOrders(orders);
      } catch (error) {
        setPaymentError(error instanceof Error ? error.message : 'Failed to load payment orders');
      } finally {
        setPaymentLoading(false);
      }
    })();
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) {
      setPersonalNotifications([]);
      setNotificationError(null);
      return;
    }

    (async () => {
      setNotificationLoading(true);
      setNotificationError(null);
      try {
        const [globalList, personalList] = await Promise.all([
          fetchGlobalNotifications().catch(() => globalNotifications),
          fetchPersonalNotifications(session.token),
        ]);
        setGlobalNotifications(globalList);
        setPersonalNotifications(personalList);
      } catch (error) {
        setNotificationError(error instanceof Error ? error.message : 'Failed to load notifications');
      } finally {
        setNotificationLoading(false);
      }
    })();
  }, [session?.token]);

  const refreshSelectedOrder = useCallback(async (
    activeSession: QuickShareSessionState,
    orderNo: string,
  ) => {
    const latest = await fetchPaymentOrder(activeSession.token, orderNo);
    if (latest) {
      setSelectedOrder(latest);
      setPaymentOrders((current) => mergeOrderIntoList(current, latest));
      setPaymentLastCheckedAt(new Date().toLocaleTimeString());
    }
    return latest;
  }, []);

  const handleIncomingPaymentUrl = useCallback(async (url: string) => {
    const orderNo = getOrderNoFromUrl(url);
    if (!orderNo || !session?.token) {
      return;
    }

    setActiveTab('pricing');
    setPaymentError(null);
    setPaymentPollAttempts(0);
    setPaymentPollSecondsRemaining(0);

    try {
      const latest = await refreshSelectedOrder(session, orderNo);
      if (!latest) {
        setPaymentError(`Payment order ${orderNo} was not found.`);
      }
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Failed to load payment result');
    }
  }, [refreshSelectedOrder, session]);

  useEffect(() => {
    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingPaymentUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleIncomingPaymentUrl(url);
      }
    }).catch(() => null);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void Linking.getInitialURL().then((url) => {
          if (url) {
            void handleIncomingPaymentUrl(url);
          }
        }).catch(() => null);
      }
    });

    return () => {
      urlSubscription.remove();
      appStateSubscription.remove();
    };
  }, [handleIncomingPaymentUrl]);

  useEffect(() => {
    if (!session?.token || !selectedOrder?.orderNo || selectedOrder.status !== 'pending') {
      setPaymentPollSecondsRemaining(0);
      return undefined;
    }

    if (paymentPollAttempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
      setPaymentPollSecondsRemaining(0);
      return undefined;
    }

    setPaymentPollSecondsRemaining(PAYMENT_POLL_INTERVAL_SECONDS);

    const countdown = setInterval(() => {
      setPaymentPollSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    const timeout = setTimeout(() => {
      setPaymentPollAttempts((current) => current + 1);
      void refreshSelectedOrder(session, selectedOrder.orderNo).catch((error) => {
        setPaymentError(error instanceof Error ? error.message : 'Failed to refresh pending order');
      });
    }, PAYMENT_POLL_INTERVAL_SECONDS * 1000);

    return () => {
      clearInterval(countdown);
      clearTimeout(timeout);
    };
  }, [paymentPollAttempts, refreshSelectedOrder, selectedOrder?.orderNo, selectedOrder?.status, session]);

  const syncTransferState = useCallback(async (activeSession: QuickShareSessionState) => {
    setTransferSyncLoading(true);
    try {
        const result = await fetchTransferSync(activeSession.token, {
          deviceId,
          deviceName: activeSession.user.nickname || activeSession.user.username || 'QuickShare Mobile',
          deviceType: 'Android App',
        });
      setTransferDevices(result.devices || []);
      setTransferIncomingTasks(result.incomingTasks || []);
      setTransferOutgoingTasks(result.outgoingTasks || []);
      setTransferIncomingRelays((result.incomingTransfers || []).map((transfer) => ({
        id: transfer.id,
        taskId: transfer.taskId,
        taskKey: transfer.taskKey,
        ready: transfer.ready,
      })));
      setTransferRecommendedChunkSize(result.recommendedChunkSize || null);
    } catch {
      setTransferDevices([]);
      setTransferIncomingTasks([]);
      setTransferOutgoingTasks([]);
      setTransferIncomingRelays([]);
      setTransferTaskActionError(null);
      setTransferRecommendedChunkSize(null);
    } finally {
      setTransferSyncLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    void syncTransferState(session);
  }, [session?.token, syncTransferState]);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password) {
      setAuthError('Username and password are required.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await login(username.trim(), password);
      await saveStoredSession(nextSession);
      setSession(nextSession);
      setActiveTab('home');
      setCurrentFolderId(null);
      setPath([{ id: null, label: 'Root' }]);
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  }, [password, username]);

  const handleSendRegistrationCode = useCallback(async () => {
    if (!registerEmail.trim()) {
      setAuthError('Email is required.');
      return;
    }
    setSendCodeLoading(true);
    setAuthError(null);
    try {
      await sendRegistrationCode(registerEmail.trim());
      setAuthError('Verification code sent.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to send verification code');
    } finally {
      setSendCodeLoading(false);
    }
  }, [registerEmail]);

  const handleRegister = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Username and password are required.');
      return;
    }
    setRegisterLoading(true);
    setAuthError(null);
    try {
      await registerAccount({
        username: username.trim(),
        password,
        email: registerEmail.trim() || undefined,
        nickname: registerNickname.trim() || undefined,
        verificationCode: registerVerificationCode.trim() || undefined,
      });
      setRegisterMode(false);
      setAuthError('Registration succeeded. Please sign in.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setRegisterLoading(false);
    }
  }, [password, registerEmail, registerNickname, registerVerificationCode, username]);

  const handleSignOut = useCallback(async () => {
    await clearStoredSession();
    setSession(null);
    setFiles([]);
    setAllFolders([]);
    setFilesError(null);
    setCurrentFolderId(null);
    setPath([{ id: null, label: 'Root' }]);
    setLatestShare(null);
    setDirectShareError(null);
    setPublicShareResult(null);
    setTransferPickupResult(null);
    setTransferDevices([]);
    setTransferIncomingTasks([]);
    setSelectedActionItem(null);
    setActionMode(null);
  }, []);

  const resetFileActionState = useCallback(() => {
    setSelectedActionItem(null);
    setActionMode(null);
    setActionDraftName('');
    setActionMoveTargetId('0');
  }, []);

  const handleFolderPress = useCallback((entry: QuickShareFileInfo) => {
    if (entry.isFolder !== 1 || !session) {
      if (!session) {
        setAuthError('Please sign in to use your personal netdisk.');
        setActiveTab('account');
      }
      return;
    }

    const label = entry.name || entry.originalName || entry.fileName || `Folder #${entry.id}`;
    const nextPath = [...path, { id: entry.id, label }];
    void loadFileSlice(session, entry.id, nextPath);
  }, [loadFileSlice, path, session]);

  const handlePathPress = useCallback((folderId: number | null) => {
    if (!session) {
      setAuthError('Please sign in to use your personal netdisk.');
      setActiveTab('account');
      return;
    }

    const targetIndex = folderId === null ? 0 : path.findIndex((segment) => segment.id === folderId);
    const nextPath = targetIndex >= 0 ? path.slice(0, targetIndex + 1) : [{ id: null, label: 'Root' }];
    void loadFileSlice(session, folderId, nextPath);
  }, [loadFileSlice, path, session]);

  const handleRefresh = useCallback(() => {
    if (!session) {
      setAuthError('Please sign in to use your personal netdisk.');
      setActiveTab('account');
      return;
    }

    void loadFileSlice(session, currentFolderId, path);
  }, [currentFolderId, loadFileSlice, path, session]);

  const handleCreateFolder = useCallback(async () => {
    if (!createFolderName.trim()) {
      setFilesError('Folder name is required.');
      return;
    }
    if (!session) {
      setAuthError('Please sign in to create folders.');
      setActiveTab('account');
      return;
    }

    try {
      setFilesError(null);
      await createFolder(session.token, createFolderName.trim(), currentFolderId);
      setCreateFolderName('');
      await loadFileSlice(session, currentFolderId, path);
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Failed to create folder');
    }
  }, [createFolderName, currentFolderId, loadFileSlice, path, session]);

  const handleUpload = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      return;
    }

    if (!session) {
      setAuthError('Please sign in to upload to your personal netdisk.');
      setActiveTab('account');
      return;
    }

    setFilesLoading(true);
    setFilesError(null);
    try {
      for (const asset of result.assets) {
        const payload: QuickShareUploadAsset = {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
        };
        await uploadFile(session.token, payload, currentFolderId);
      }
      await loadFileSlice(session, currentFolderId, path);
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Upload failed');
      setFilesLoading(false);
    }
  }, [currentFolderId, loadFileSlice, path, session]);

  const handleOpenUrl = useCallback(async (url: string) => {
    await Linking.openURL(url);
  }, []);

  const handlePreviewOwnedFile = useCallback(async (entry: QuickShareFileInfo) => {
    if (!session) {
      setAuthError('Please sign in to preview personal files.');
      setActiveTab('account');
      return;
    }
    await handleOpenUrl(buildOwnedFilePreviewUrl(entry.id, session.token));
  }, [handleOpenUrl, session]);

  const handleDownloadOwnedFile = useCallback(async (entry: QuickShareFileInfo) => {
    if (!session) {
      setAuthError('Please sign in to download personal files.');
      setActiveTab('account');
      return;
    }
    await handleOpenUrl(buildOwnedFileDownloadUrl(entry.id, session.token));
  }, [handleOpenUrl, session]);

  const handleCreateShare = useCallback(async (entry: QuickShareFileInfo) => {
    if (!session) {
      setAuthError('Please sign in to create personal share links from netdisk files.');
      setActiveTab('account');
      return;
    }

    setCreateShareLoading(true);
    try {
      const result = await createShareLink(session.token, entry.id);
      setLatestShare(result);
      setActiveTab('share');
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Failed to create share');
    } finally {
      setCreateShareLoading(false);
    }
  }, [session]);

  const handleLookupPublicShare = useCallback(async () => {
    if (!publicShareCode.trim() || !publicShareExtractCode.trim()) {
      setPublicShareError('Share code and extract code are required.');
      return;
    }

    setPublicShareLoading(true);
    setPublicShareError(null);
    try {
      const result = await getShareInfo(publicShareCode.trim(), publicShareExtractCode.trim());
      setPublicShareResult(result);
    } catch (error) {
      setPublicShareError(error instanceof Error ? error.message : 'Failed to load share');
    } finally {
      setPublicShareLoading(false);
    }
  }, [publicShareCode, publicShareExtractCode]);

  const handleLookupTransferPickup = useCallback(async () => {
    if (!transferPickupToken.trim()) {
      setTransferPickupError('Pickup token is required.');
      return;
    }

    setTransferPickupLoading(true);
    setTransferPickupError(null);
    try {
      const result = await getTransferPickupInfo(transferPickupToken.trim());
      setTransferPickupResult(result);
    } catch (error) {
      setTransferPickupError(error instanceof Error ? error.message : 'Failed to load pickup');
    } finally {
      setTransferPickupLoading(false);
    }
  }, [transferPickupToken]);

  const handleSaveTransferPickup = useCallback(async () => {
    if (!session || !transferPickupResult?.shareToken) {
      setTransferPickupError(session ? 'Load a pickup token first.' : 'Sign in to save pickup files to your netdisk.');
      if (!session) {
        setActiveTab('account');
      }
      return;
    }

    try {
      await saveTransferPickupToNetdisk(session.token, transferPickupResult.shareToken, 0);
      await loadFileSlice(session, currentFolderId, path);
      setActiveTab('files');
    } catch (error) {
      setTransferPickupError(error instanceof Error ? error.message : 'Failed to save pickup');
    }
  }, [currentFolderId, loadFileSlice, path, session, transferPickupResult]);

  const handleFilesTabPress = useCallback(() => {
    if (!session) {
      setAuthError('Please sign in to use your personal netdisk.');
      setActiveTab('account');
      return;
    }
    setActiveTab('files');
  }, [session]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!registrationSettings?.googleClientId || !googleRequest) {
      setAuthError('Google login is not configured.');
      return;
    }
    setGoogleLoading(true);
    await promptGoogleAsync();
  }, [googleRequest, promptGoogleAsync, registrationSettings?.googleClientId]);

  const handleCreateDirectShare = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      return;
    }

    setDirectShareLoading(true);
    setDirectShareError(null);
    try {
      const asset = result.assets[0];
      const payload: QuickShareUploadAsset = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
      };
      const directShare = await createAndUploadTransferPublicShare(
        payload,
        session?.user.nickname || session?.user.username || 'QuickShare Mobile',
      );
      setTransferPickupResult(directShare);
      setActiveTab('share');
      if (session?.token) {
        await syncTransferState(session);
      }
    } catch (error) {
      setDirectShareError(error instanceof Error ? error.message : 'Failed to create direct share');
    } finally {
      setDirectShareLoading(false);
    }
  }, [session, syncTransferState]);

  const handleSendToDevice = useCallback(async (receiverDeviceId: string) => {
    if (!session) {
      setAuthError('Please sign in to use same-account transfer.');
      setActiveTab('account');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      return;
    }
    setDeviceTransferLoading(true);
    setDeviceTransferError(null);
    try {
      const asset = result.assets[0];
      const payload: QuickShareUploadAsset = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
      };
      const canAttemptDirect = latestDirectSession?.peerDeviceId === receiverDeviceId
        && latestDirectTransport?.controlChannelState === 'open'
        && latestDirectTransport?.fileChannelState === 'open'
        && directTransportRef.current;

      if (canAttemptDirect) {
        const directTransport = directTransportRef.current;
        if (!directTransport) {
          throw new Error('Direct transport is no longer available.');
        }
        const blob = await fetch(payload.uri).then((response) => response.blob());
        const transferId = `mobile-direct-${Date.now()}`;
        const totalChunks = Math.max(1, Math.ceil(blob.size / QUICKSHARE_DIRECT_CHUNK_SIZE));
        const taskKey = `mobile-direct|${receiverDeviceId}|${payload.name}`;
        latestOutgoingDirectTransferRef.current = {
          transferId,
          taskKey,
          fileName: payload.name,
          fileSize: blob.size,
          contentType: payload.mimeType || 'application/octet-stream',
          receiverDeviceId,
          totalChunks,
        };
        void syncTransferDirectAttempt(session.token, {
          taskKey,
          deviceId,
          senderDeviceId: deviceId,
          receiverDeviceId,
          clientTransferId: transferId,
          fileName: payload.name,
          fileSize: blob.size,
          contentType: payload.mimeType || 'application/octet-stream',
          totalChunks,
          completedChunks: 0,
          status: 'sending',
          startReason: 'same_account_direct',
        }).catch(() => null);
        const offered = directTransport.sendControl({
          type: 'transfer-offer',
          transferId,
          taskKey,
          fileName: payload.name,
          fileSize: blob.size,
          contentType: payload.mimeType || 'application/octet-stream',
          chunkSize: QUICKSHARE_DIRECT_CHUNK_SIZE,
          totalChunks,
          senderLabel: session.user.nickname || session.user.username || 'QuickShare Mobile',
          senderDeviceId: deviceId,
          receiverDeviceId,
          pairSessionId: latestDirectSession?.pairSessionId,
        });

        if (offered) {
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const start = chunkIndex * QUICKSHARE_DIRECT_CHUNK_SIZE;
            const end = Math.min(blob.size, start + QUICKSHARE_DIRECT_CHUNK_SIZE);
            const packet = buildDirectChunkPacket(
              transferId,
              chunkIndex,
              totalChunks,
              await blob.slice(start, end).arrayBuffer(),
            );
            const sent = directTransport.sendBinary(packet);
            if (!sent) {
              throw new Error('Direct data channel is not ready for file transfer.');
            }
          }
          directTransport.sendControl({
            type: 'transfer-finish',
            transferId,
          });
          void syncTransferDirectAttempt(session.token, {
            taskKey,
            deviceId,
            senderDeviceId: deviceId,
            receiverDeviceId,
            clientTransferId: transferId,
            fileName: payload.name,
            fileSize: blob.size,
            contentType: payload.mimeType || 'application/octet-stream',
            totalChunks,
            completedChunks: totalChunks,
            status: 'sending',
            startReason: 'same_account_direct',
          }).catch(() => null);
          setLatestDirectControlMessage(`sent:${transferId}`);
          await syncTransferState(session);
          return;
        }
      }

      await createAndUploadTransferRelay(session.token, {
        deviceId,
        receiverDeviceId,
        file: payload,
        taskKey: `mobile|${receiverDeviceId}|${payload.name}`,
        recommendedChunkSize: transferRecommendedChunkSize || undefined,
      });
      await syncTransferState(session);
    } catch (error) {
      setDeviceTransferError(error instanceof Error ? error.message : 'Failed to send to device');
    } finally {
      setDeviceTransferLoading(false);
    }
  }, [deviceId, latestDirectSession?.pairSessionId, latestDirectSession?.peerDeviceId, latestDirectTransport?.controlChannelState, latestDirectTransport?.fileChannelState, session, syncTransferState, transferRecommendedChunkSize]);

  const handlePrepareDirectSession = useCallback(async (targetDeviceId: string) => {
    if (!session) {
      setAuthError('Please sign in to prepare direct transfer.');
      setActiveTab('account');
      return;
    }

    setDirectSessionLoading(true);
    setDirectSessionError(null);
    try {
      const nextRtcConfig = await fetchTransferRtcConfig();
      setRtcConfig(nextRtcConfig);
      if (!nextRtcConfig?.directTransferEnabled) {
        setLatestDirectSession(null);
        setLatestDirectTransport(null);
        setLatestDirectControlMessage(null);
        setDirectSessionError('Direct transfer is not enabled by the current RTC configuration.');
        return;
      }

      if (!directSignalClientRef.current) {
        directSignalClientRef.current = createDirectSignalClient({
          token: session.token,
          deviceId,
          deviceName: session.user.nickname || session.user.username || 'QuickShare Mobile',
          deviceType: 'Android App',
          onOpen: () => {
            directSignalClientRef.current?.send({ type: 'room-devices' });
          },
          onMessage: (message) => {
            if (message.type === 'welcome') {
              setLatestDirectControlMessage(`welcome:${message.channelId || '-'}`);
            }

            if (message.type === 'room-update') {
              setLatestDirectControlMessage(`room-update:${(message.devices || []).length}`);
            }

            if (message.type === 'pair-ready') {
              setLatestDirectSession((current) => ({
                pairSessionId: message.pairSessionId || current?.pairSessionId,
                selfChannelId: current?.selfChannelId,
                selfDeviceId: current?.selfDeviceId || deviceId,
                peerChannelId: message.peerChannelId || current?.peerChannelId,
                peerDeviceId: message.peerDeviceId || current?.peerDeviceId,
                peerLabel: message.peerLabel || current?.peerLabel,
              }));
              setLatestDirectControlMessage(`pair-ready:${message.peerDeviceId || '-'}`);
            }

            if (message.type === 'signal' && message.signalType && message.payload) {
              void directTransportRef.current?.handleSignal(message.signalType, message.payload).then(() => {
                const summary = directTransportRef.current?.summary();
                if (summary) {
                  setLatestDirectTransport(summary);
                }
              }).catch((error: unknown) => {
                setDirectSessionError(error instanceof Error ? error.message : 'Failed to apply remote direct signal');
              });
            }
          },
        });
      }
      await directSignalClientRef.current.connect();

      const directSession = await createTransferDirectSession(session.token, {
        deviceId,
        targetDeviceId,
      });
      directTransportRef.current?.close();
      const directTransport = await createLocalDirectTransport(nextRtcConfig, (signalType, payload) => {
        if (directSession?.pairSessionId) {
          directSignalClientRef.current?.sendSignal(directSession.pairSessionId, signalType, payload);
        }
      }, {
        onBinaryMessage: async (payload) => {
          const packet = await parseDirectChunkPacket(payload);
          const manifest = saveIncomingDirectChunk(packet.header.transferId, packet.header.chunkIndex, packet.payload);
          setLatestDirectControlMessage(`chunk:${packet.header.transferId}:${packet.header.chunkIndex}`);
          if (manifest) {
            setLatestIncomingDirectManifest(manifest);
          }
          if (session?.token && latestDirectSession?.peerDeviceId) {
            void syncTransferDirectAttempt(session.token, {
              deviceId,
              senderDeviceId: latestDirectSession.peerDeviceId,
              receiverDeviceId: deviceId,
              clientTransferId: packet.header.transferId,
              fileName: manifest?.fileName || 'incoming-transfer',
              fileSize: manifest?.fileSize || 0,
              contentType: manifest?.contentType || 'application/octet-stream',
              totalChunks: manifest?.totalChunks || packet.header.totalChunks,
              completedChunks: manifest?.receivedChunks || 0,
              status: (manifest?.receivedChunks || 0) >= (manifest?.totalChunks || packet.header.totalChunks) ? 'completed' : 'receiving',
              startReason: 'same_account_direct',
            }).catch(() => null);
          }
          if (manifest && manifest.receivedChunks >= manifest.totalChunks) {
            const assembled = assembleIncomingDirectTransfer(packet.header.transferId);
            if (assembled?.assembledFileUri) {
              setLatestIncomingDirectFile(assembled.assembledFileUri);
              setLatestIncomingDirectManifest(assembled);
            }
          }
        },
        onControlMessage: (payload) => {
          setLatestDirectControlMessage(JSON.stringify(payload));
          if (payload.type === 'transfer-offer' && typeof payload.transferId === 'string') {
            const prepared = prepareIncomingDirectTransfer({
              transferId: payload.transferId,
              taskKey: typeof payload.taskKey === 'string' ? payload.taskKey : '',
              fileName: typeof payload.fileName === 'string' ? payload.fileName : 'incoming-transfer',
              fileSize: typeof payload.fileSize === 'number' ? payload.fileSize : 0,
              contentType: typeof payload.contentType === 'string' ? payload.contentType : 'application/octet-stream',
              totalChunks: typeof payload.totalChunks === 'number' ? payload.totalChunks : 1,
              senderDeviceId: typeof payload.senderDeviceId === 'string' ? payload.senderDeviceId : '',
              receiverDeviceId: typeof payload.receiverDeviceId === 'string' ? payload.receiverDeviceId : deviceId,
            });
            if (session?.token && typeof payload.senderDeviceId === 'string') {
              void syncTransferDirectAttempt(session.token, {
                taskKey: typeof payload.taskKey === 'string' ? payload.taskKey : '',
                deviceId,
                senderDeviceId: payload.senderDeviceId,
                receiverDeviceId: typeof payload.receiverDeviceId === 'string' ? payload.receiverDeviceId : deviceId,
                clientTransferId: payload.transferId,
                fileName: typeof payload.fileName === 'string' ? payload.fileName : 'incoming-transfer',
                fileSize: typeof payload.fileSize === 'number' ? payload.fileSize : 0,
                contentType: typeof payload.contentType === 'string' ? payload.contentType : 'application/octet-stream',
                totalChunks: typeof payload.totalChunks === 'number' ? payload.totalChunks : 1,
                completedChunks: prepared.manifest.receivedChunks,
                status: 'receiving',
                startReason: 'same_account_direct',
              }).catch(() => null);
            }
            directTransport.sendControl({
              type: 'transfer-accept',
              transferId: payload.transferId,
              totalChunks: prepared.manifest.totalChunks,
              receivedCount: prepared.manifest.receivedChunks,
              missingChunks: prepared.missingChunks,
            });
          }

          if (payload.type === 'transfer-finish' && typeof payload.transferId === 'string') {
            const assembled = assembleIncomingDirectTransfer(payload.transferId);
            if (assembled?.assembledFileUri) {
              setLatestIncomingDirectFile(assembled.assembledFileUri);
              setLatestIncomingDirectManifest(assembled);
              if (session?.token && assembled.senderDeviceId) {
                void syncTransferDirectAttempt(session.token, {
                  taskKey: assembled.taskKey,
                  deviceId,
                  senderDeviceId: assembled.senderDeviceId,
                  receiverDeviceId: assembled.receiverDeviceId || deviceId,
                  clientTransferId: payload.transferId,
                  fileName: assembled.fileName,
                  fileSize: assembled.fileSize,
                  contentType: assembled.contentType,
                  totalChunks: assembled.totalChunks,
                  completedChunks: assembled.receivedChunks,
                  status: 'completed',
                  startReason: 'same_account_direct',
                  endReason: 'peer_confirmed',
                  downloaded: true,
                }).catch(() => null);
              }
              directTransport.sendControl({
                type: 'transfer-complete',
                transferId: payload.transferId,
                totalChunks: assembled.totalChunks,
                receivedCount: assembled.receivedChunks,
              });
            }
          }

          if (payload.type === 'transfer-complete' && latestOutgoingDirectTransferRef.current && session?.token) {
            const outgoing = latestOutgoingDirectTransferRef.current;
            if (payload.transferId === outgoing.transferId) {
              void syncTransferDirectAttempt(session.token, {
                taskKey: outgoing.taskKey,
                deviceId,
                senderDeviceId: deviceId,
                receiverDeviceId: outgoing.receiverDeviceId,
                clientTransferId: outgoing.transferId,
                fileName: outgoing.fileName,
                fileSize: outgoing.fileSize,
                contentType: outgoing.contentType,
                totalChunks: outgoing.totalChunks,
                completedChunks: typeof payload.receivedCount === 'number' ? payload.receivedCount : outgoing.totalChunks,
                status: 'completed',
                startReason: 'same_account_direct',
                endReason: 'peer_confirmed',
                downloaded: true,
              }).catch(() => null);
            }
          }
        },
        onStateChange: (summary) => {
          setLatestDirectTransport(summary);
        },
      });
      directTransportRef.current = directTransport;
      setLatestDirectSession(directSession);
      setLatestDirectTransport(directTransport.summary());
      await syncTransferState(session);
    } catch (error) {
      setLatestDirectSession(null);
      setLatestDirectTransport(null);
      setLatestDirectControlMessage(null);
      setDirectSessionError(error instanceof Error ? error.message : 'Failed to prepare direct session');
    } finally {
      setDirectSessionLoading(false);
    }
  }, [deviceId, session, syncTransferState]);

  const handleSaveIncomingDirectFile = useCallback(async () => {
    if (!session || !latestIncomingDirectManifest?.assembledFileUri) {
      setDirectSessionError('No incoming direct file is ready to save yet.');
      return;
    }

    try {
      await uploadFile(session.token, {
        uri: latestIncomingDirectManifest.assembledFileUri,
        name: latestIncomingDirectManifest.fileName,
        mimeType: latestIncomingDirectManifest.contentType,
      }, currentFolderId);

      if (latestIncomingDirectManifest.senderDeviceId) {
        await syncTransferDirectAttempt(session.token, {
          taskKey: latestIncomingDirectManifest.taskKey,
          deviceId,
          senderDeviceId: latestIncomingDirectManifest.senderDeviceId,
          receiverDeviceId: latestIncomingDirectManifest.receiverDeviceId || deviceId,
          clientTransferId: latestIncomingDirectManifest.transferId,
          fileName: latestIncomingDirectManifest.fileName,
          fileSize: latestIncomingDirectManifest.fileSize,
          contentType: latestIncomingDirectManifest.contentType,
          totalChunks: latestIncomingDirectManifest.totalChunks,
          completedChunks: latestIncomingDirectManifest.receivedChunks,
          status: 'completed',
          startReason: 'same_account_direct',
          savedToNetdisk: true,
        }).catch(() => null);
      }

      await loadFileSlice(session, currentFolderId, path);
      setActiveTab('files');
    } catch (error) {
      setDirectSessionError(error instanceof Error ? error.message : 'Failed to save incoming direct file');
    }
  }, [currentFolderId, deviceId, latestIncomingDirectManifest, loadFileSlice, path, session]);

  useEffect(() => () => {
    directTransportRef.current?.close();
    directSignalClientRef.current?.close();
  }, []);

  const handleDownloadIncomingTransfer = useCallback(async (task: QuickShareTransferTask) => {
    if (!session) {
      setAuthError('Please sign in to access transfer files.');
      setActiveTab('account');
      return;
    }

    const transferId = getRelayTransferId(task) ?? getFallbackRelayTransferId(task, transferIncomingRelays);
    if (!transferId) {
      setTransferTaskActionError('This transfer is not ready for download yet.');
      return;
    }

    setTransferTaskActionLoadingId(task.id);
    setTransferTaskActionError(null);
    try {
      await handleOpenUrl(buildTransferRelayDownloadUrl(transferId, deviceId, session.token));
      await syncTransferState(session);
    } catch (error) {
      setTransferTaskActionError(error instanceof Error ? error.message : 'Failed to open incoming transfer');
    } finally {
      setTransferTaskActionLoadingId(null);
    }
  }, [deviceId, handleOpenUrl, session, syncTransferState, transferIncomingRelays]);

  const handleSaveIncomingTransfer = useCallback(async (task: QuickShareTransferTask) => {
    if (!session) {
      setAuthError('Please sign in to save transfer files to your netdisk.');
      setActiveTab('account');
      return;
    }

    const transferId = getRelayTransferId(task) ?? getFallbackRelayTransferId(task, transferIncomingRelays);
    if (!transferId) {
      setTransferTaskActionError('This transfer is not ready to save yet.');
      return;
    }

    setTransferTaskActionLoadingId(task.id);
    setTransferTaskActionError(null);
    try {
      await saveTransferRelayToNetdisk(session.token, transferId, { deviceId, folderId: currentFolderId });
      await Promise.all([
        syncTransferState(session),
        loadFileSlice(session, currentFolderId, path),
      ]);
      setActiveTab('files');
    } catch (error) {
      setTransferTaskActionError(error instanceof Error ? error.message : 'Failed to save incoming transfer');
    } finally {
      setTransferTaskActionLoadingId(null);
    }
  }, [currentFolderId, deviceId, loadFileSlice, path, session, syncTransferState, transferIncomingRelays]);

  const handleDeleteTransferTask = useCallback(async (task: QuickShareTransferTask) => {
    if (!session) {
      setAuthError('Please sign in to manage transfer tasks.');
      setActiveTab('account');
      return;
    }

    setTransferTaskActionLoadingId(task.id);
    setTransferTaskActionError(null);
    try {
      await deleteTransferTask(session.token, task.id, deviceId);
      await syncTransferState(session);
    } catch (error) {
      setTransferTaskActionError(error instanceof Error ? error.message : 'Failed to delete transfer task');
    } finally {
      setTransferTaskActionLoadingId(null);
    }
  }, [deviceId, session, syncTransferState]);

  const handleRefreshOrders = useCallback(async () => {
    if (!session) {
      setAuthError('Please sign in to view orders.');
      setActiveTab('account');
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const orders = await fetchPaymentOrders(session.token);
      setPaymentOrders(orders);
      if (selectedOrder?.orderNo) {
        const latest = await fetchPaymentOrder(session.token, selectedOrder.orderNo);
        if (latest) {
          setSelectedOrder(latest);
          setPaymentOrders((current) => mergeOrderIntoList(current, latest));
          setPaymentLastCheckedAt(new Date().toLocaleTimeString());
          setPaymentPollAttempts(0);
        }
      }
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Failed to refresh orders');
    } finally {
      setPaymentLoading(false);
    }
  }, [selectedOrder?.orderNo, session]);

  const handleSelectOrder = useCallback(async (order: QuickSharePaymentOrder) => {
    if (!session) {
      return;
    }
    try {
      const latest = await fetchPaymentOrder(session.token, order.orderNo);
      setSelectedOrder(latest || order);
      if (latest) {
        setPaymentOrders((current) => mergeOrderIntoList(current, latest));
      }
      setPaymentLastCheckedAt(new Date().toLocaleTimeString());
      setPaymentPollAttempts(0);
    } catch {
      setSelectedOrder(order);
    }
  }, [session]);

  const handleCreatePayment = useCallback(async (plan: QuickSharePlan) => {
    if (!session) {
      setAuthError('Please sign in to create orders.');
      setActiveTab('account');
      return;
    }
    if (!paymentOptions?.providerId) {
      setPaymentError('No payment provider is currently configured.');
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const order = await createPaymentOrder(session.token, {
        planId: plan.id,
        providerId: paymentOptions.providerId,
        payType: paymentOptions.payTypes?.[0] || 'alipay',
        returnUrl: QUICKSHARE_MOBILE_SCHEME,
      });
      setSelectedOrder(null);
      setPaymentPollAttempts(0);
      setPaymentLastCheckedAt(null);
      if (order.redirectUrl) {
        await handleOpenUrl(order.redirectUrl);
      }
      await handleRefreshOrders();
      setActiveTab('pricing');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Failed to create payment order');
    } finally {
      setPaymentLoading(false);
    }
  }, [handleOpenUrl, handleRefreshOrders, paymentOptions, session]);

  const handleDeleteItem = useCallback(async (entry: QuickShareFileInfo) => {
    if (!session) {
      setAuthError('Please sign in to manage your personal netdisk.');
      setActiveTab('account');
      return;
    }

    try {
      if (entry.isFolder === 1) {
        await deleteFolder(session.token, entry.id);
      } else {
        await deleteFile(session.token, entry.id);
      }
      resetFileActionState();
      await loadFileSlice(session, currentFolderId, path);
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Delete failed');
    }
  }, [currentFolderId, loadFileSlice, path, resetFileActionState, session]);

  const handleSelectRename = useCallback((entry: QuickShareFileInfo) => {
    setSelectedActionItem(entry);
    setActionMode('rename');
    setActionDraftName(entry.originalName || entry.fileName || entry.name || '');
  }, []);

  const handleSelectMove = useCallback((entry: QuickShareFileInfo) => {
    setSelectedActionItem(entry);
    setActionMode('move');
    setActionMoveTargetId('0');
  }, []);

  const handleSubmitFileAction = useCallback(async () => {
    if (!session || !selectedActionItem || !actionMode) {
      return;
    }

    try {
      if (actionMode === 'rename') {
        if (!actionDraftName.trim()) {
          setFilesError('New name is required.');
          return;
        }
        if (selectedActionItem.isFolder === 1) {
          await renameFolder(session.token, selectedActionItem.id, actionDraftName.trim());
        } else {
          await renameFile(session.token, selectedActionItem.id, actionDraftName.trim());
        }
      }

      if (actionMode === 'move') {
        const targetFolderId = Number.parseInt(actionMoveTargetId, 10);
        const normalizedTarget = Number.isNaN(targetFolderId) ? 0 : targetFolderId;
        if (selectedActionItem.isFolder === 1) {
          await moveFolder(session.token, selectedActionItem.id, normalizedTarget === 0 ? null : normalizedTarget);
        } else {
          await moveFile(session.token, selectedActionItem.id, normalizedTarget === 0 ? null : normalizedTarget);
        }
      }

      resetFileActionState();
      await loadFileSlice(session, currentFolderId, path);
    } catch (error) {
      setFilesError(error instanceof Error ? error.message : 'Action failed');
    }
  }, [actionDraftName, actionMode, actionMoveTargetId, currentFolderId, loadFileSlice, path, resetFileActionState, selectedActionItem, session]);

  const connectionHint = useMemo(() => `API: ${QUICKSHARE_API_BASE_URL}`, []);
  const paymentMeta = useMemo(() => {
    if (!selectedOrder) {
      return null;
    }

    if (selectedOrder.status !== 'pending') {
      return paymentLastCheckedAt ? `Last checked at ${paymentLastCheckedAt}.` : null;
    }

    if (paymentPollAttempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
      return paymentLastCheckedAt
        ? `Auto-refresh stopped after ${PAYMENT_POLL_MAX_ATTEMPTS} checks. Last checked at ${paymentLastCheckedAt}.`
        : `Auto-refresh stopped after ${PAYMENT_POLL_MAX_ATTEMPTS} checks.`;
    }

    const nextRefreshText = paymentPollSecondsRemaining > 0
      ? `Refreshing again in ${paymentPollSecondsRemaining}s.`
      : 'Refreshing payment status…';

    return paymentLastCheckedAt
      ? `${nextRefreshText} Last checked at ${paymentLastCheckedAt}.`
      : nextRefreshText;
  }, [paymentLastCheckedAt, paymentPollAttempts, paymentPollSecondsRemaining, selectedOrder]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {session ? (
          <>
            <View style={styles.tabBar}>
              <TabButton active={activeTab === 'home'} label="Home" onPress={() => setActiveTab('home')} />
              <TabButton active={activeTab === 'files'} label="Files" onPress={handleFilesTabPress} />
              <TabButton active={activeTab === 'share'} label="Share" onPress={() => setActiveTab('share')} />
              <TabButton active={activeTab === 'pricing'} label="Plans" onPress={() => setActiveTab('pricing')} />
              <TabButton active={activeTab === 'account'} label="Account" onPress={() => setActiveTab('account')} />
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'home' ? (
                <HomeDashboard
                  deviceTransferError={deviceTransferError}
                  deviceTransferLoading={deviceTransferLoading}
                  directSessionError={directSessionError}
                  directSessionLoading={directSessionLoading}
                  devices={transferDevices}
                  directShareError={directShareError}
                  directShareLoading={directShareLoading}
                  incomingTasks={transferIncomingTasks}
                  outgoingTasks={transferOutgoingTasks}
                  latestDirectControlMessage={latestDirectControlMessage}
                  latestIncomingDirectFile={latestIncomingDirectFile}
                  latestDirectSession={latestDirectSession}
                  latestDirectTransport={latestDirectTransport}
                  onCreateDirectShare={handleCreateDirectShare}
                  onDeleteTransferTask={handleDeleteTransferTask}
                  onPrepareDirectSession={handlePrepareDirectSession}
                  onDownloadIncomingTransfer={handleDownloadIncomingTransfer}
                  onSaveIncomingDirectFile={handleSaveIncomingDirectFile}
                  onSaveIncomingTransfer={handleSaveIncomingTransfer}
                  onSendToDevice={handleSendToDevice}
                  latestShare={latestShare}
                  latestTransferPickup={transferPickupResult}
                  onGoToGoogleLogin={handleGoogleSignIn}
                  onGoToAccount={() => setActiveTab('account')}
                  onGoToFiles={handleFilesTabPress}
                  onGoToPricing={() => setActiveTab('pricing')}
                  onGoToShare={() => setActiveTab('share')}
                  profile={session?.user || null}
                  syncLoading={transferSyncLoading}
                  transferTaskActionError={transferTaskActionError}
                  transferTaskActionLoadingId={transferTaskActionLoadingId}
                />
              ) : null}

              {activeTab === 'files' ? (
                <FileBrowser
                  actionDraftName={actionDraftName}
                  actionMode={actionMode}
                  actionMoveTargetId={actionMoveTargetId}
                  actionTargetLabel={selectedActionItem ? (selectedActionItem.originalName || selectedActionItem.fileName || selectedActionItem.name || `Entry #${selectedActionItem.id}`) : null}
                  allFolders={allFolders}
                  createFolderName={createFolderName}
                  currentFolderId={currentFolderId}
                  error={filesError}
                  files={files}
                  isLoggedIn={Boolean(session?.token)}
                  loading={filesLoading}
                  onCreateFolder={handleCreateFolder}
                  onCreateFolderNameChange={setCreateFolderName}
                  onDeleteItem={handleDeleteItem}
                  onDownloadFile={handleDownloadOwnedFile}
                  onFolderPress={handleFolderPress}
                  onMoveTargetChange={setActionMoveTargetId}
                  onPathPress={handlePathPress}
                  onPreviewFile={handlePreviewOwnedFile}
                  onRefresh={handleRefresh}
                  onRenameDraftChange={setActionDraftName}
                  onSelectMove={handleSelectMove}
                  onSelectRename={handleSelectRename}
                  onShareFile={handleCreateShare}
                  onSignOut={handleSignOut}
                  onSubmitAction={handleSubmitFileAction}
                  onUpload={handleUpload}
                  path={path}
                  profile={session.user}
                />
              ) : null}

              {activeTab === 'share' ? (
                <ShareCenter
                  createShareLoading={createShareLoading}
                  latestShare={latestShare}
                  onLookupPublicShare={handleLookupPublicShare}
                  onLookupTransferPickup={handleLookupTransferPickup}
                  onOpenLatestShareDownload={() => latestShare ? handleOpenUrl(buildShareDownloadUrl(latestShare.shareCode, latestShare.extractCode || '')) : Promise.resolve()}
                  onOpenLatestSharePreview={() => latestShare ? handleOpenUrl(buildSharePreviewUrl(latestShare.shareCode, latestShare.extractCode || '')) : Promise.resolve()}
                  onOpenPublicShareDownload={() => publicShareResult ? handleOpenUrl(buildShareDownloadUrl(publicShareResult.shareCode, publicShareExtractCode)) : Promise.resolve()}
                  onOpenPublicSharePreview={() => publicShareResult ? handleOpenUrl(buildSharePreviewUrl(publicShareResult.shareCode, publicShareExtractCode)) : Promise.resolve()}
                  onOpenTransferPickupDownload={() => transferPickupResult ? handleOpenUrl(buildTransferPickupDownloadUrl(transferPickupResult.shareToken)) : Promise.resolve()}
                  onOpenTransferPickupPreview={() => transferPickupResult ? handleOpenUrl(buildTransferPickupPreviewUrl(transferPickupResult.shareToken)) : Promise.resolve()}
                  onPublicShareCodeChange={setPublicShareCode}
                  onPublicShareExtractCodeChange={setPublicShareExtractCode}
                  onSaveTransferPickup={handleSaveTransferPickup}
                  onTransferPickupTokenChange={setTransferPickupToken}
                  publicShareCode={publicShareCode}
                  publicShareError={publicShareError}
                  publicShareExtractCode={publicShareExtractCode}
                  publicShareLoading={publicShareLoading}
                  publicShareResult={publicShareResult}
                  transferPickupError={transferPickupError}
                  transferPickupLoading={transferPickupLoading}
                  transferPickupResult={transferPickupResult}
                  transferPickupToken={transferPickupToken}
                />
              ) : null}

              {activeTab === 'pricing' ? (
                <PricingCenter
                  error={paymentError}
                  loading={paymentLoading}
                  onCreateOrder={handleCreatePayment}
                  onRefreshOrders={handleRefreshOrders}
                  onSelectOrder={handleSelectOrder}
                  orders={paymentOrders}
                  paymentMeta={paymentMeta}
                  paymentOptions={paymentOptions}
                  plans={plans}
                  selectedOrder={selectedOrder}
                />
              ) : null}

              {activeTab === 'account' ? (
                session ? (
                  <AccountPanel
                    apiBaseUrl={QUICKSHARE_API_BASE_URL}
                    globalNotifications={globalNotifications}
                    notificationError={notificationError}
                    notificationLoading={notificationLoading}
                    onSignOut={handleSignOut}
                    personalNotifications={personalNotifications}
                    profile={session.user}
                  />
                ) : (
                  <View style={styles.loginScreen}>
                    {registerMode ? (
                      <RegisterForm
                        email={registerEmail}
                        emailVerificationEnabled={Boolean(registrationSettings?.emailVerificationEnabled)}
                        error={authError}
                        loading={registerLoading}
                        nickname={registerNickname}
                        onEmailChange={setRegisterEmail}
                        onNicknameChange={setRegisterNickname}
                        onPasswordChange={setPassword}
                        onSendCode={handleSendRegistrationCode}
                        onSubmit={handleRegister}
                        onUsernameChange={setUsername}
                        onVerificationCodeChange={setRegisterVerificationCode}
                        password={password}
                        sendCodeLoading={sendCodeLoading}
                        username={username}
                        verificationCode={registerVerificationCode}
                      />
                    ) : (
                      <LoginForm
                        error={authError}
                        googleEnabled={Boolean(registrationSettings?.googleClientId)}
                        googleLoading={googleLoading}
                        loading={authLoading}
                        onGoogleSubmit={handleGoogleSignIn}
                        onPasswordChange={setPassword}
                        onSubmit={handleLogin}
                        onUsernameChange={setUsername}
                        password={password}
                        username={username}
                      />
                    )}
                    <Pressable onPress={() => setRegisterMode((value) => !value)} style={({ pressed }) => [styles.authToggle, pressed ? styles.tabButtonPressed : null]}>
                      <Text style={styles.authToggleText}>{registerMode ? 'Back to sign in' : 'Create a new account'}</Text>
                    </Pressable>
                    <Text style={styles.connectionHint}>{connectionHint}</Text>
                  </View>
                )
              ) : null}
            </View>
          </>
        ) : activeTab === 'files' || activeTab === 'account' ? (
          <View style={styles.loginScreen}>
            {registerMode ? (
              <RegisterForm
                email={registerEmail}
                emailVerificationEnabled={Boolean(registrationSettings?.emailVerificationEnabled)}
                error={authError}
                loading={registerLoading}
                nickname={registerNickname}
                onEmailChange={setRegisterEmail}
                onNicknameChange={setRegisterNickname}
                onPasswordChange={setPassword}
                onSendCode={handleSendRegistrationCode}
                onSubmit={handleRegister}
                onUsernameChange={setUsername}
                onVerificationCodeChange={setRegisterVerificationCode}
                password={password}
                sendCodeLoading={sendCodeLoading}
                username={username}
                verificationCode={registerVerificationCode}
              />
            ) : (
              <LoginForm
                error={authError}
                googleEnabled={Boolean(registrationSettings?.googleClientId)}
                googleLoading={googleLoading}
                loading={authLoading}
                onGoogleSubmit={handleGoogleSignIn}
                onPasswordChange={setPassword}
                onSubmit={handleLogin}
                onUsernameChange={setUsername}
                password={password}
                username={username}
              />
            )}
            <Pressable onPress={() => setRegisterMode((value) => !value)} style={({ pressed }) => [styles.authToggle, pressed ? styles.tabButtonPressed : null]}>
              <Text style={styles.authToggleText}>{registerMode ? 'Back to sign in' : 'Create a new account'}</Text>
            </Pressable>
            <Text style={styles.connectionHint}>{connectionHint}</Text>
          </View>
        ) : (
          <>
            <View style={styles.tabBar}>
              <TabButton active={activeTab === 'home'} label="Home" onPress={() => setActiveTab('home')} />
              <TabButton active={false} label="Files" onPress={handleFilesTabPress} />
              <TabButton active={activeTab === 'share'} label="Share" onPress={() => setActiveTab('share')} />
              <TabButton active={activeTab === 'pricing'} label="Plans" onPress={() => setActiveTab('pricing')} />
              <TabButton active={false} label="Account" onPress={() => setActiveTab('account')} />
            </View>

            <View style={styles.tabContent}>
              {activeTab === 'home' ? (
                <HomeDashboard
                  deviceTransferError={null}
                  deviceTransferLoading={false}
                  directSessionError={null}
                  directSessionLoading={false}
                  devices={[]}
                  directShareError={directShareError}
                  directShareLoading={directShareLoading}
                  incomingTasks={[]}
                  outgoingTasks={[]}
                  latestDirectControlMessage={null}
                  latestIncomingDirectFile={null}
                  latestDirectSession={null}
                  latestDirectTransport={null}
                  onCreateDirectShare={handleCreateDirectShare}
                  onDeleteTransferTask={() => {}}
                  onPrepareDirectSession={() => {}}
                  onDownloadIncomingTransfer={() => {}}
                  onSaveIncomingDirectFile={() => {}}
                  onSaveIncomingTransfer={() => {}}
                  onSendToDevice={() => {}}
                  latestShare={latestShare}
                  latestTransferPickup={transferPickupResult}
                  onGoToGoogleLogin={handleGoogleSignIn}
                  onGoToAccount={() => setActiveTab('account')}
                  onGoToFiles={handleFilesTabPress}
                  onGoToPricing={() => setActiveTab('pricing')}
                  onGoToShare={() => setActiveTab('share')}
                  profile={null}
                  syncLoading={false}
                  transferTaskActionError={null}
                  transferTaskActionLoadingId={null}
                />
              ) : null}

              {activeTab === 'share' ? (
                <ShareCenter
                  createShareLoading={createShareLoading}
                  latestShare={latestShare}
                  onLookupPublicShare={handleLookupPublicShare}
                  onLookupTransferPickup={handleLookupTransferPickup}
                  onOpenLatestShareDownload={() => latestShare ? handleOpenUrl(buildShareDownloadUrl(latestShare.shareCode, latestShare.extractCode || '')) : Promise.resolve()}
                  onOpenLatestSharePreview={() => latestShare ? handleOpenUrl(buildSharePreviewUrl(latestShare.shareCode, latestShare.extractCode || '')) : Promise.resolve()}
                  onOpenPublicShareDownload={() => publicShareResult ? handleOpenUrl(buildShareDownloadUrl(publicShareResult.shareCode, publicShareExtractCode)) : Promise.resolve()}
                  onOpenPublicSharePreview={() => publicShareResult ? handleOpenUrl(buildSharePreviewUrl(publicShareResult.shareCode, publicShareExtractCode)) : Promise.resolve()}
                  onOpenTransferPickupDownload={() => transferPickupResult ? handleOpenUrl(buildTransferPickupDownloadUrl(transferPickupResult.shareToken)) : Promise.resolve()}
                  onOpenTransferPickupPreview={() => transferPickupResult ? handleOpenUrl(buildTransferPickupPreviewUrl(transferPickupResult.shareToken)) : Promise.resolve()}
                  onPublicShareCodeChange={setPublicShareCode}
                  onPublicShareExtractCodeChange={setPublicShareExtractCode}
                  onSaveTransferPickup={handleSaveTransferPickup}
                  onTransferPickupTokenChange={setTransferPickupToken}
                  publicShareCode={publicShareCode}
                  publicShareError={publicShareError}
                  publicShareExtractCode={publicShareExtractCode}
                  publicShareLoading={publicShareLoading}
                  publicShareResult={publicShareResult}
                  transferPickupError={transferPickupError}
                  transferPickupLoading={transferPickupLoading}
                  transferPickupResult={transferPickupResult}
                  transferPickupToken={transferPickupToken}
                />
              ) : null}

              {activeTab === 'pricing' ? (
                <PricingCenter
                  error={paymentError}
                  loading={paymentLoading}
                  onCreateOrder={handleCreatePayment}
                  onRefreshOrders={handleRefreshOrders}
                  onSelectOrder={handleSelectOrder}
                  orders={paymentOrders}
                  paymentMeta={paymentMeta}
                  paymentOptions={paymentOptions}
                  plans={plans}
                  selectedOrder={selectedOrder}
                />
              ) : null}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabButton, active ? styles.tabButtonActive : null, pressed ? styles.tabButtonPressed : null]}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Theme.bg,
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Theme.space9,
    paddingVertical: Theme.space8,
  },
  tabBar: {
    flexDirection: 'row',
    gap: Theme.space3,
    marginBottom: Theme.space6,
    padding: Theme.space3,
    borderRadius: Theme.radius2xl,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: Theme.radiusLg,
    flex: 1,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  tabButtonActive: {
    backgroundColor: Theme.primaryDark,
  },
  tabButtonPressed: {
    opacity: 0.88,
  },
  tabButtonText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: Theme.textInverse,
  },
  tabContent: {
    flex: 1,
  },
  loginScreen: {
    flex: 1,
    gap: Theme.space6,
    justifyContent: 'center',
  },
  connectionHint: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeSm,
    textAlign: 'center',
  },
  authToggle: {
    alignItems: 'center',
    marginTop: Theme.space2,
    backgroundColor: Theme.surface,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    minHeight: Theme.touchMin,
    justifyContent: 'center',
  },
  authToggleText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
});
