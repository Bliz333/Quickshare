const QUICKDROP_DEVICE_ID_KEY = 'quickdrop-device-id';
const QUICKDROP_DEVICE_NAME_KEY = 'quickdrop-device-name';
const QUICKDROP_PENDING_UPLOADS_KEY = 'quickdrop-pending-uploads';
const QUICKDROP_TASK_LINKS_KEY = 'quickdrop-task-links';
const QUICKDROP_SYNC_INTERVAL_MS = 15000;
const QUICKDROP_HASH_TEMPORARY_HISTORY = '#temporary-history';
const QUICKDROP_HASH_ACCOUNT_HISTORY = '#account-history';
const QUICKDROP_ROUTE_VIEW_KEY = 'view';
const QUICKDROP_ROUTE_TEMPORARY_HISTORY = 'temporary-history';
const QUICKDROP_ROUTE_ACCOUNT_HISTORY = 'account-history';

const quickDropState = {
    profile: null,
    currentDevice: null,
    devices: [],
    folders: [],
    incomingTasks: null,
    outgoingTasks: null,
    incomingTransfers: [],
    outgoingTransfers: [],
    directIncomingTransfers: [],
    directOutgoingTransfers: [],
    selectedReceiverDeviceId: '',
    recommendedChunkSize: 2 * 1024 * 1024,
    selectedFiles: [],
    selectedFile: null,
    sending: false,
    activeUpload: null,
    displayIncomingTransfers: [],
    displayOutgoingTransfers: [],
    syncTimer: null,
    directSessionTargetDeviceId: '',
    directSessionLastAttemptAt: 0,
    accountMode: false,
    currentMode: 'temporary',
    currentSubpage: 'main',
    directHistoryExpanded: false,
    accountHistoryExpanded: false,
    deviceSettingsExpanded: false,
    pickerMenuExpanded: false
};

function quickDropText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function quickDropRequest(path, options = {}) {
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    };

    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    }).then(async response => {
        const text = await response.text();
        const result = text ? JSON.parse(text) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'QuickDrop request failed');
        }
        return result.data;
    });
}

function getQuickDropDeviceId() {
    let deviceId = localStorage.getItem(QUICKDROP_DEVICE_ID_KEY);
    if (deviceId) {
        return deviceId;
    }

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        deviceId = window.crypto.randomUUID();
    } else {
        deviceId = `qd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    localStorage.setItem(QUICKDROP_DEVICE_ID_KEY, deviceId);
    return deviceId;
}

function detectQuickDropDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/android/i.test(ua)) return 'Android';
    if (/macintosh|mac os x/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Browser';
}

function defaultQuickDropDeviceName() {
    const profile = quickDropState.profile;
    const owner = profile?.nickname || profile?.username || 'QuickShare';
    return `${owner} · ${detectQuickDropDeviceType()}`;
}

function getQuickDropFileDisplayName(file) {
    return file?.webkitRelativePath || file?.name || '';
}

function normalizeQuickDropBatchFileName(file) {
    const displayName = getQuickDropFileDisplayName(file);
    const normalized = String(displayName || file?.name || '')
        .replace(/[\\/]+/g, '__')
        .trim();
    return normalized || `quickdrop-${Date.now()}`;
}

function buildQuickDropSelectionItem(file) {
    const displayName = getQuickDropFileDisplayName(file) || file.name || 'quickdrop-file';
    const normalizedName = normalizeQuickDropBatchFileName(file);
    const transferFile = normalizedName === file.name
        ? file
        : new File([file], normalizedName, {
            type: file.type || 'application/octet-stream',
            lastModified: file.lastModified || Date.now()
        });
    return {
        id: `${normalizedName}:${file.size}:${file.lastModified || 0}`,
        label: displayName,
        file: transferFile,
        size: file.size || 0
    };
}

function setQuickDropSelectedFiles(files) {
    const items = Array.from(files || [])
        .filter(item => item instanceof File)
        .map(buildQuickDropSelectionItem);
    quickDropState.selectedFiles = items;
    quickDropState.selectedFile = items[0]?.file || null;
}

function clearQuickDropSelectedFile() {
    quickDropState.selectedFiles = [];
    quickDropState.selectedFile = null;
    closeQuickDropPickerMenu();
    const fileInput = document.getElementById('quickDropFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    const folderInput = document.getElementById('quickDropFolderInput');
    if (folderInput) {
        folderInput.value = '';
    }
}

function setQuickDropAccountMode(enabled) {
    quickDropState.accountMode = Boolean(enabled);
    const accountPanels = document.getElementById('quickDropAccountPanels');
    const accountModeBtn = document.getElementById('quickDropAccountModeBtn');
    if (accountPanels) {
        accountPanels.classList.toggle('hidden', !quickDropState.accountMode);
    }
    if (accountModeBtn) {
        accountModeBtn.classList.toggle('hidden', !quickDropState.accountMode);
    }
    if (!quickDropState.accountMode) {
        quickDropState.deviceSettingsExpanded = false;
        quickDropState.pickerMenuExpanded = false;
        quickDropState.currentSubpage = 'main';
        setQuickDropMode('temporary');
    }
}

function setQuickDropMode(mode) {
    const normalizedMode = mode === 'account' && quickDropState.accountMode ? 'account' : 'temporary';
    quickDropState.currentMode = normalizedMode;
    quickDropState.pickerMenuExpanded = false;

    const temporaryIds = ['quickDropTemporaryTransferCard'];
    const accountIds = ['quickDropAccountPanels'];
    temporaryIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle('hidden', normalizedMode !== 'temporary');
        }
    });
    accountIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle('hidden', normalizedMode !== 'account');
        }
    });

    const temporaryBtn = document.getElementById('quickDropTemporaryModeBtn');
    const accountBtn = document.getElementById('quickDropAccountModeBtn');
    if (temporaryBtn) {
        temporaryBtn.classList.toggle('active', normalizedMode === 'temporary');
    }
    if (accountBtn) {
        accountBtn.classList.toggle('active', normalizedMode === 'account');
        accountBtn.disabled = !quickDropState.accountMode;
    }
    renderQuickDropModeGuide();
}

function renderQuickDropModeGuide() {
    const guide = document.getElementById('quickDropModeGuide');
    if (!guide) {
        return;
    }
    guide.textContent = quickDropState.currentMode === 'account'
        ? quickDropText('quickDropModeGuideAccount', 'My devices: choose one of your devices first, then send files or a folder.')
        : quickDropText('quickDropModeGuideTemporary', 'Temporary transfer: get a match code first, then choose files or a folder and send.');
}

function renderQuickDropSubpage() {
    const hero = document.getElementById('quickDropHeroSection');
    const mainLayout = document.getElementById('quickDropMainLayout');
    const historyPage = document.getElementById('quickDropHistoryPage');
    const historyPageTitle = document.getElementById('quickDropHistoryPageTitle');
    const showingHistory = quickDropState.currentSubpage !== 'main';

    if (hero) {
        hero.classList.toggle('hidden', showingHistory);
    }
    if (mainLayout) {
        mainLayout.classList.toggle('hidden', showingHistory);
    }
    if (historyPage) {
        historyPage.classList.toggle('hidden', !showingHistory);
    }
    if (historyPageTitle) {
        historyPageTitle.textContent = quickDropState.currentSubpage === 'temporaryHistory'
            ? quickDropText('quickDropDirectInboxTitle', 'Transfer History')
            : quickDropText('quickDropActivityTitle', 'History');
    }
}

function getQuickDropHistoryRouteValue(target) {
    if (target === 'temporaryHistory') {
        return QUICKDROP_ROUTE_TEMPORARY_HISTORY;
    }
    if (target === 'accountHistory') {
        return QUICKDROP_ROUTE_ACCOUNT_HISTORY;
    }
    return '';
}

function getQuickDropSubpageFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const routeView = params.get(QUICKDROP_ROUTE_VIEW_KEY) || '';
    if (routeView === QUICKDROP_ROUTE_TEMPORARY_HISTORY) {
        return 'temporaryHistory';
    }
    if (routeView === QUICKDROP_ROUTE_ACCOUNT_HISTORY && quickDropState.accountMode) {
        return 'accountHistory';
    }
    const currentHash = window.location.hash || '';
    if (currentHash === QUICKDROP_HASH_TEMPORARY_HISTORY) {
        return 'temporaryHistory';
    }
    if (currentHash === QUICKDROP_HASH_ACCOUNT_HISTORY && quickDropState.accountMode) {
        return 'accountHistory';
    }
    return 'main';
}

function buildQuickDropHistoryUrl(target) {
    const url = new URL(window.location.href);
    const routeValue = getQuickDropHistoryRouteValue(target);
    if (routeValue) {
        url.searchParams.set(QUICKDROP_ROUTE_VIEW_KEY, routeValue);
    } else {
        url.searchParams.delete(QUICKDROP_ROUTE_VIEW_KEY);
    }
    url.hash = '';
    return `${url.pathname}${url.search}`;
}

function syncQuickDropHistoryLocation(target, options = {}) {
    const desiredUrl = buildQuickDropHistoryUrl(target);
    const replace = Boolean(options.replace);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === desiredUrl) {
        applyQuickDropSubpageFromLocation();
        return;
    }
    if (replace) {
        window.history.replaceState(null, '', desiredUrl);
        applyQuickDropSubpageFromLocation();
        return;
    }
    window.history.pushState(null, '', desiredUrl);
    applyQuickDropSubpageFromLocation();
}

function applyQuickDropSubpageFromLocation() {
    const nextSubpage = getQuickDropSubpageFromLocation();
    const expectedUrl = buildQuickDropHistoryUrl(nextSubpage);
    if (`${window.location.pathname}${window.location.search}` !== expectedUrl || window.location.hash) {
        syncQuickDropHistoryLocation(nextSubpage, { replace: true });
        return;
    }
    quickDropState.currentSubpage = nextSubpage;
    quickDropState.directHistoryExpanded = nextSubpage === 'temporaryHistory';
    quickDropState.accountHistoryExpanded = nextSubpage === 'accountHistory';
    renderQuickDropSubpage();
    renderQuickDropDisclosure();
}

function renderQuickDropDisclosure() {
    const signalStatus = document.getElementById('quickDropSignalStatus');
    const temporaryStatusRow = document.getElementById('quickDropTemporaryStatusRow');
    const pairingMeta = document.getElementById('quickDropPairingMeta');
    const directHistoryPanel = document.getElementById('quickDropDirectHistoryPanel');
    const directHistoryToggle = document.getElementById('quickDropDirectHistoryToggle');
    const accountHistoryPanel = document.getElementById('quickDropAccountHistoryPanel');
    const accountHistoryToggle = document.getElementById('quickDropAccountHistoryToggle');
    const deviceSettingsPanel = document.getElementById('quickDropDeviceSettingsPanel');
    const deviceSettingsToggle = document.getElementById('quickDropDeviceSettingsToggle');
    const showTemporaryStatus = quickDropState.currentMode === 'temporary'
        && !!(window.QuickDropSignalManager?.getState?.().pairSessionId || window.QuickDropSignalManager?.isDirectReady?.());
    const subpageMode = quickDropState.currentSubpage === 'temporaryHistory'
        ? 'temporary'
        : quickDropState.currentSubpage === 'accountHistory'
            ? 'account'
            : '';

    if (signalStatus) {
        signalStatus.classList.toggle('hidden', !showTemporaryStatus);
    }
    if (temporaryStatusRow) {
        temporaryStatusRow.classList.toggle('hidden', !showTemporaryStatus);
    }
    if (pairingMeta) {
        pairingMeta.classList.toggle('hidden', !showTemporaryStatus);
    }
    if (directHistoryPanel) {
        directHistoryPanel.classList.toggle('hidden', subpageMode !== 'temporary');
    }
    if (directHistoryToggle) {
        directHistoryToggle.querySelector('span').textContent = quickDropState.currentSubpage === 'temporaryHistory'
            ? quickDropText('quickDropHideTemporaryHistory', '收起互传记录')
            : quickDropText('quickDropShowTemporaryHistory', '查看互传记录');
    }
    if (accountHistoryPanel) {
        accountHistoryPanel.classList.toggle('hidden', subpageMode !== 'account');
    }
    if (accountHistoryToggle) {
        accountHistoryToggle.querySelector('span').textContent = quickDropState.currentSubpage === 'accountHistory'
            ? quickDropText('quickDropHideAccountHistory', '收起收发记录')
            : quickDropText('quickDropShowAccountHistory', '查看收发记录');
    }
    if (deviceSettingsPanel) {
        deviceSettingsPanel.classList.toggle('hidden', !quickDropState.deviceSettingsExpanded);
    }
    if (deviceSettingsToggle) {
        deviceSettingsToggle.querySelector('span').textContent = quickDropState.deviceSettingsExpanded
            ? quickDropText('quickDropHideDeviceSettings', '收起设备名')
            : quickDropText('quickDropShowDeviceSettings', '改设备名');
    }
}

function renderQuickDropPickerMenu() {
    const pickerMenu = document.getElementById('quickDropPickerMenu');
    if (!pickerMenu) {
        return;
    }
    pickerMenu.classList.toggle('hidden', !quickDropState.pickerMenuExpanded);
}

function toggleQuickDropPickerMenu() {
    if (!quickDropState.selectedReceiverDeviceId) {
        showToast(quickDropText('quickDropChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    quickDropState.pickerMenuExpanded = !quickDropState.pickerMenuExpanded;
    renderQuickDropPickerMenu();
}

function closeQuickDropPickerMenu() {
    if (!quickDropState.pickerMenuExpanded) {
        return;
    }
    quickDropState.pickerMenuExpanded = false;
    renderQuickDropPickerMenu();
}

function closeQuickDropHistoryDrawer() {
    syncQuickDropHistoryLocation('main');
}

function openQuickDropHistoryPage(target) {
    const normalizedTarget = target === 'temporaryHistory' ? 'temporaryHistory' : 'accountHistory';
    if (normalizedTarget === 'accountHistory' && !quickDropState.accountMode) {
        return;
    }
    syncQuickDropHistoryLocation(normalizedTarget);
}

function getStoredQuickDropDeviceName() {
    return localStorage.getItem(QUICKDROP_DEVICE_NAME_KEY) || defaultQuickDropDeviceName();
}

function setStoredQuickDropDeviceName(name) {
    localStorage.setItem(QUICKDROP_DEVICE_NAME_KEY, name);
}

function loadQuickDropPendingUploads() {
    try {
        return JSON.parse(localStorage.getItem(QUICKDROP_PENDING_UPLOADS_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function saveQuickDropPendingUploads(data) {
    localStorage.setItem(QUICKDROP_PENDING_UPLOADS_KEY, JSON.stringify(data));
}

function buildQuickDropPendingKey(file, receiverDeviceId) {
    return [
        receiverDeviceId,
        file.name,
        file.size,
        file.lastModified
    ].join('|');
}

function loadQuickDropTaskLinks() {
    try {
        const parsed = JSON.parse(localStorage.getItem(QUICKDROP_TASK_LINKS_KEY) || '{}');
        return {
            relayByTransferId: parsed?.relayByTransferId && typeof parsed.relayByTransferId === 'object'
                ? parsed.relayByTransferId
                : {}
        };
    } catch (error) {
        return { relayByTransferId: {} };
    }
}

function saveQuickDropTaskLinks(data) {
    localStorage.setItem(QUICKDROP_TASK_LINKS_KEY, JSON.stringify({
        relayByTransferId: data?.relayByTransferId || {}
    }));
}

function buildQuickDropTaskKey(file, peerDeviceId, direction = 'outgoing') {
    return [
        direction,
        peerDeviceId || '-',
        file?.name || '',
        Number(file?.size || 0),
        Number(file?.lastModified || 0)
    ].join('|');
}

function setQuickDropRelayTaskKey(transferId, taskKey) {
    if (!transferId || !taskKey) {
        return;
    }
    const links = loadQuickDropTaskLinks();
    links.relayByTransferId[String(transferId)] = taskKey;
    saveQuickDropTaskLinks(links);
}

function getQuickDropRelayTaskKey(transferId) {
    const links = loadQuickDropTaskLinks();
    return links.relayByTransferId[String(transferId)] || '';
}

function removeQuickDropRelayTaskKey(transferId) {
    if (!transferId) {
        return;
    }
    const links = loadQuickDropTaskLinks();
    delete links.relayByTransferId[String(transferId)];
    saveQuickDropTaskLinks(links);
}

function formatQuickDropStatus(status) {
    switch (status) {
        case 'waiting_accept':
            return quickDropText('quickDropDirectWaitingAccept', 'Waiting for peer resume map');
        case 'negotiating':
            return quickDropText('quickDropLifecycleNegotiating', 'Negotiating');
        case 'pending_upload':
            return quickDropText('quickDropStatusPending', 'Pending Upload');
        case 'uploading':
            return quickDropText('quickDropStatusUploading', 'Uploading');
        case 'sending':
            return quickDropText('quickDropDirectSending', 'Sending directly');
        case 'waiting_complete':
            return quickDropText('quickDropDirectWaitingComplete', 'Waiting for peer to finish storage');
        case 'receiving':
            return quickDropText('quickDropDirectReceiving', 'Receiving');
        case 'relay_fallback':
            return quickDropText('quickDropDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay');
        case 'ready':
            return quickDropText('quickDropStatusReady', 'Ready to Download');
        case 'completed':
            return quickDropText('quickDropStatusCompleted', 'Completed');
        case 'failed':
            return quickDropText('quickDropLifecycleFailed', 'Failed');
        case 'cancelled':
            return quickDropText('quickDropStatusCancelled', 'Cancelled');
        default:
            return status || '-';
    }
}

function formatQuickDropTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    const locale = typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'en' ? 'en-US' : 'zh-CN';
    return date.toLocaleString(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatQuickDropSize(bytes) {
    return typeof formatFileSize === 'function' ? formatFileSize(bytes || 0) : `${bytes || 0} B`;
}

function getQuickDropDeviceName(deviceId) {
    const target = quickDropState.devices.find(item => item.deviceId === deviceId);
    return target?.deviceName || deviceId;
}

function getQuickDropDeviceIcon(deviceType) {
    const normalized = String(deviceType || '').toLowerCase();
    if (normalized.includes('iphone') || normalized.includes('android')) {
        return 'fa-mobile-screen-button';
    }
    if (normalized.includes('ipad') || normalized.includes('tablet')) {
        return 'fa-tablet-screen-button';
    }
    if (normalized.includes('mac') || normalized.includes('windows') || normalized.includes('linux')) {
        return 'fa-laptop';
    }
    return 'fa-display';
}

function quickDropTransferModeLabel(mode) {
    if (mode === 'hybrid') {
        return quickDropText('quickDropTransferModeHybrid', 'Direct -> Relay');
    }
    return mode === 'direct'
        ? quickDropText('quickDropTransferModeDirect', 'Direct')
        : quickDropText('quickDropTransferModeRelay', 'Relay');
}

function deriveQuickDropAttemptStatus(stage) {
    switch (stage) {
        case 'waiting_accept':
        case 'pending_upload':
        case 'ready':
        case 'waiting_complete':
            return 'waiting';
        case 'negotiating':
            return 'negotiating';
        case 'sending':
        case 'receiving':
        case 'uploading':
            return 'transferring';
        case 'relay_fallback':
            return 'relay_fallback';
        case 'failed':
            return 'failed';
        case 'completed':
            return 'completed';
        case 'cancelled':
            return 'cancelled';
        default:
            return stage || 'waiting';
    }
}

function formatQuickDropAttemptStatus(status) {
    switch (status) {
        case 'waiting':
            return quickDropText('quickDropLifecycleWaiting', 'Waiting');
        case 'negotiating':
            return quickDropText('quickDropLifecycleNegotiating', 'Negotiating');
        case 'transferring':
            return quickDropText('quickDropLifecycleTransferring', 'Transferring');
        case 'relay_fallback':
            return quickDropText('quickDropLifecycleFallback', 'Relay Fallback');
        case 'failed':
            return quickDropText('quickDropLifecycleFailed', 'Failed');
        case 'completed':
            return quickDropText('quickDropLifecycleCompleted', 'Completed');
        case 'cancelled':
            return quickDropText('quickDropLifecycleCancelled', 'Cancelled');
        default:
            return formatQuickDropStatus(status);
    }
}

function formatQuickDropLifecycleReason(reason) {
    switch (reason) {
        case 'relay_transfer_created':
            return quickDropText('quickDropReasonRelayTransferCreated', 'Server relay transfer started');
        case 'same_account_direct':
            return quickDropText('quickDropReasonSameAccountDirect', 'Same-account direct session');
        case 'pair_session_direct':
            return quickDropText('quickDropReasonPairSessionDirect', 'Paired direct session');
        case 'saved_to_netdisk':
            return quickDropText('quickDropReasonSavedToNetdisk', 'Saved to netdisk');
        case 'downloaded':
            return quickDropText('quickDropReasonDownloaded', 'Downloaded');
        case 'peer_confirmed':
            return quickDropText('quickDropReasonPeerConfirmed', 'Peer confirmed completion');
        case 'relay_fallback':
            return quickDropText('quickDropReasonRelayFallback', 'Switched to server relay');
        case 'cancelled':
            return quickDropText('quickDropReasonCancelled', 'Cancelled');
        case 'direct_link_unavailable':
            return quickDropText('quickDropReasonDirectLinkUnavailable', 'Direct link was not ready');
        case 'direct_ready_timeout':
            return quickDropText('quickDropReasonDirectReadyTimeout', 'Direct readiness timed out and fell back to relay');
        case 'ice_connection_failed':
            return quickDropText('quickDropReasonIceConnectionFailed', 'ICE connection failed');
        case 'no_relay_candidate':
            return quickDropText('quickDropReasonNoRelayCandidate', 'No usable TURN relay candidate was gathered');
        case 'signaling_unavailable':
            return quickDropText('quickDropReasonSignalingUnavailable', 'Signaling is currently unavailable');
        case 'peer_mismatch':
            return quickDropText('quickDropReasonPeerMismatch', 'Direct link pointed to another device');
        case 'accept_timeout':
            return quickDropText('quickDropReasonAcceptTimeout', 'Peer did not respond in time');
        case 'peer_missed_offer':
            return quickDropText('quickDropReasonPeerMissedOffer', 'Peer missed the transfer offer');
        case 'peer_reported_error':
            return quickDropText('quickDropReasonPeerReportedError', 'Peer reported an error');
        case 'direct_transfer_interrupted':
            return quickDropText('quickDropReasonDirectTransferInterrupted', 'Direct transfer was interrupted');
        case 'direct_transfer_failed':
            return quickDropText('quickDropReasonDirectTransferFailed', 'Direct transfer failed');
        default:
            return reason ? String(reason).replace(/_/g, ' ') : quickDropText('quickDropNotYet', 'Not yet');
    }
}

function formatQuickDropCandidateCounts(counts) {
    const target = counts || {};
    return ['host', 'srflx', 'relay', 'prflx']
        .map(key => `${key}:${Number(target[key] || 0)}`)
        .join(', ');
}

function buildQuickDropDirectDiagnosticsLines() {
    const signalState = quickDropSignalState();
    const diagnostics = signalState.directDiagnostics || {};
    if (!signalState.directState && !diagnostics.connectionState && !diagnostics.selectedCandidatePair) {
        return [];
    }
    const lines = [
        `${quickDropText('quickDropDirectSignalStateLabel', 'Direct State')}: ${signalState.directState || quickDropText('quickDropNotYet', 'Not yet')}`,
        `${quickDropText('quickDropDirectIceStateLabel', 'ICE State')}: ${diagnostics.iceConnectionState || diagnostics.connectionState || quickDropText('quickDropNotYet', 'Not yet')}`,
        `${quickDropText('quickDropDirectCandidateStatsLabel', 'Candidate Stats')}: local(${formatQuickDropCandidateCounts(diagnostics.localCandidateTypes)}) / remote(${formatQuickDropCandidateCounts(diagnostics.remoteCandidateTypes)})`
    ];
    if (diagnostics.selectedCandidatePair) {
        const pair = diagnostics.selectedCandidatePair;
        lines.push(`${quickDropText('quickDropDirectSelectedPairLabel', 'Selected Candidate Pair')}: ${pair.localCandidateType || '-'} -> ${pair.remoteCandidateType || '-'} (${pair.localProtocol || pair.remoteProtocol || '-'})`);
    }
    if (diagnostics.lastReadyAt) {
        lines.push(`${quickDropText('quickDropDirectLastReadyLabel', 'Last Direct Ready')}: ${formatQuickDropTime(diagnostics.lastReadyAt)}`);
    }
    return lines;
}

function getLatestQuickDropAttemptTime(attempts, field, lifecycleStatus) {
    return [...(attempts || [])]
        .map(attempt => {
            if (attempt?.[field]) {
                return attempt[field];
            }
            if (lifecycleStatus && (attempt?.attemptStatus || deriveQuickDropAttemptStatus(attempt?.stage || '')) === lifecycleStatus) {
                return attempt?.updateTime || '';
            }
            return '';
        })
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || '';
}

function normalizeQuickDropTaskAttempt(attempt, fallback = {}) {
    const stage = attempt?.stage || fallback.stage || '';
    return {
        transferMode: attempt?.transferMode || fallback.transferMode || 'relay',
        transferId: attempt?.transferId != null ? String(attempt.transferId) : (fallback.transferId || ''),
        stage,
        attemptStatus: attempt?.attemptStatus || fallback.attemptStatus || deriveQuickDropAttemptStatus(stage),
        startReason: attempt?.startReason || fallback.startReason || '',
        endReason: attempt?.endReason || fallback.endReason || '',
        failureReason: attempt?.failureReason || fallback.failureReason || '',
        completedChunks: Number(attempt?.completedChunks ?? fallback.completedChunks ?? 0),
        totalChunks: Number(attempt?.totalChunks ?? fallback.totalChunks ?? 0),
        startTime: attempt?.startTime || fallback.startTime || attempt?.updateTime || fallback.updateTime || '',
        updateTime: attempt?.updateTime || fallback.updateTime || '',
        completedAt: attempt?.completedAt || fallback.completedAt || '',
        failedAt: attempt?.failedAt || fallback.failedAt || '',
        fallbackAt: attempt?.fallbackAt || fallback.fallbackAt || '',
        savedToNetdiskAt: attempt?.savedToNetdiskAt || fallback.savedToNetdiskAt || '',
        downloadedAt: attempt?.downloadedAt || fallback.downloadedAt || ''
    };
}

function buildQuickDropAttemptSummary(attempts, fallback = {}) {
    const normalizedAttempts = [...(attempts || [])]
        .filter(Boolean)
        .sort((left, right) => new Date(right?.updateTime || 0).getTime() - new Date(left?.updateTime || 0).getTime());
    const current = normalizedAttempts[0] || {};
    return {
        attemptStatus: current.attemptStatus || fallback.attemptStatus || deriveQuickDropAttemptStatus(current.stage || fallback.stage || ''),
        startReason: current.startReason || fallback.startReason || '',
        endReason: current.endReason || fallback.endReason || '',
        failureReason: current.failureReason
            || normalizedAttempts.find(attempt => attempt.failureReason)?.failureReason
            || fallback.failureReason
            || '',
        startTime: current.startTime || fallback.startTime || current.updateTime || fallback.updateTime || '',
        completedAt: fallback.completedAt || getLatestQuickDropAttemptTime(normalizedAttempts, 'completedAt', 'completed'),
        failedAt: fallback.failedAt || getLatestQuickDropAttemptTime(normalizedAttempts, 'failedAt', 'failed'),
        fallbackAt: fallback.fallbackAt || getLatestQuickDropAttemptTime(normalizedAttempts, 'fallbackAt', 'relay_fallback'),
        savedToNetdiskAt: fallback.savedToNetdiskAt || getLatestQuickDropAttemptTime(normalizedAttempts, 'savedToNetdiskAt'),
        downloadedAt: fallback.downloadedAt || getLatestQuickDropAttemptTime(normalizedAttempts, 'downloadedAt')
    };
}

function getQuickDropTransferCompletedChunks(transfer, directionHint) {
    const direction = transfer?.direction || directionHint || 'outgoing';
    if (transfer?.transferMode === 'direct') {
        return direction === 'incoming'
            ? Number(transfer.receivedChunks || 0)
            : Number(transfer.acknowledgedChunks || transfer.sentChunks || 0);
    }
    return Number(transfer?.uploadedChunks || 0);
}

function buildQuickDropTaskAttemptFromTransfer(transfer, directionHint) {
    const direction = transfer?.direction || directionHint || 'outgoing';
    const transferMode = transfer?.transferMode || 'relay';
    return normalizeQuickDropTaskAttempt({
        transferMode,
        transferId: transfer?.id != null ? String(transfer.id) : '',
        stage: transfer?.status || '',
        attemptStatus: transfer?.attemptStatus || '',
        startReason: transfer?.startReason || (transferMode === 'direct' ? 'same_account_direct' : 'relay_transfer_created'),
        endReason: transfer?.endReason || '',
        failureReason: transfer?.failureReason || '',
        completedChunks: getQuickDropTransferCompletedChunks(transfer, direction),
        totalChunks: Number(transfer?.totalChunks || 0),
        startTime: transfer?.startTime || transfer?.createTime || transfer?.updateTime || '',
        updateTime: transfer?.updateTime || '',
        completedAt: transfer?.completedAt || '',
        failedAt: transfer?.failedAt || '',
        fallbackAt: transfer?.fallbackAt || '',
        savedToNetdiskAt: transfer?.savedToNetdiskAt || '',
        downloadedAt: transfer?.downloadedAt || ''
    });
}

function buildQuickDropTaskFromTransfer(transfer, directionHint) {
    const baseTask = transfer?.task && typeof transfer.task === 'object' ? transfer.task : {};
    const direction = baseTask.direction || transfer?.direction || directionHint || 'outgoing';
    const transferMode = baseTask.transferMode || transfer?.transferMode || 'relay';
    const currentTransferMode = baseTask.currentTransferMode || transferMode;
    const peerDeviceId = baseTask.peerDeviceId
        || transfer?.peerDeviceId
        || (direction === 'incoming' ? transfer?.senderDeviceId : transfer?.receiverDeviceId)
        || '';
    const peerLabel = baseTask.peerLabel
        || transfer?.peerLabel
        || getQuickDropDeviceName(peerDeviceId)
        || peerDeviceId
        || '-';
    const completedChunks = Number(baseTask.completedChunks ?? getQuickDropTransferCompletedChunks({
        ...transfer,
        direction,
        transferMode
    }, direction));
    const totalChunks = Number(baseTask.totalChunks ?? transfer?.totalChunks ?? 0);
    const attempts = Array.isArray(baseTask.attempts) && baseTask.attempts.length
        ? baseTask.attempts
            .map(attempt => normalizeQuickDropTaskAttempt(attempt, {
                transferMode: attempt?.transferMode || transferMode,
                stage: attempt?.stage || transfer?.status || '',
                completedChunks,
                totalChunks,
                updateTime: attempt?.updateTime || transfer?.updateTime || '',
                startReason: baseTask.startReason || (transferMode === 'direct' ? 'same_account_direct' : 'relay_transfer_created'),
                completedAt: baseTask.completedAt || transfer?.completedAt || '',
                failedAt: baseTask.failedAt || transfer?.failedAt || '',
                fallbackAt: baseTask.fallbackAt || transfer?.fallbackAt || '',
                savedToNetdiskAt: baseTask.savedToNetdiskAt || transfer?.savedToNetdiskAt || '',
                downloadedAt: baseTask.downloadedAt || transfer?.downloadedAt || ''
            }))
            .filter(attempt => attempt.transferMode || attempt.transferId || attempt.stage)
        : [buildQuickDropTaskAttemptFromTransfer({
            ...transfer,
            direction,
            transferMode
        }, direction)];
    const attemptSummary = buildQuickDropAttemptSummary(attempts, {
        stage: baseTask.stage || transfer?.status || '',
        attemptStatus: baseTask.attemptStatus || '',
        startReason: baseTask.startReason || (transferMode === 'direct' ? 'same_account_direct' : 'relay_transfer_created'),
        endReason: baseTask.endReason || transfer?.endReason || '',
        failureReason: baseTask.failureReason || transfer?.failureReason || '',
        startTime: baseTask.startTime || transfer?.startTime || transfer?.createTime || transfer?.updateTime || '',
        completedAt: baseTask.completedAt || transfer?.completedAt || '',
        failedAt: baseTask.failedAt || transfer?.failedAt || '',
        fallbackAt: baseTask.fallbackAt || transfer?.fallbackAt || '',
        savedToNetdiskAt: baseTask.savedToNetdiskAt || transfer?.savedToNetdiskAt || '',
        downloadedAt: baseTask.downloadedAt || transfer?.downloadedAt || ''
    });

    return {
        id: baseTask.id || transfer?.id || null,
        taskId: baseTask.id || transfer?.taskId || null,
        taskKey: baseTask.taskKey || transfer?.taskKey || '',
        direction,
        transferMode,
        currentTransferMode,
        stage: baseTask.stage || transfer?.status || '',
        attemptStatus: baseTask.attemptStatus || attemptSummary.attemptStatus,
        startReason: baseTask.startReason || attemptSummary.startReason,
        endReason: baseTask.endReason || attemptSummary.endReason,
        failureReason: baseTask.failureReason || attemptSummary.failureReason,
        fileName: baseTask.fileName || transfer?.fileName || '',
        fileSize: Number(baseTask.fileSize ?? transfer?.fileSize ?? 0),
        contentType: baseTask.contentType || transfer?.contentType || 'application/octet-stream',
        senderDeviceId: baseTask.senderDeviceId || transfer?.senderDeviceId || '',
        receiverDeviceId: baseTask.receiverDeviceId || transfer?.receiverDeviceId || '',
        peerDeviceId,
        peerLabel,
        completedChunks,
        totalChunks,
        createTime: baseTask.createTime || transfer?.createTime || '',
        updateTime: baseTask.updateTime || transfer?.updateTime || '',
        expireTime: baseTask.expireTime || transfer?.expireTime || '',
        startTime: baseTask.startTime || attemptSummary.startTime,
        completedAt: baseTask.completedAt || attemptSummary.completedAt || transfer?.completedAt || '',
        failedAt: baseTask.failedAt || attemptSummary.failedAt || transfer?.failedAt || '',
        fallbackAt: baseTask.fallbackAt || attemptSummary.fallbackAt || transfer?.fallbackAt || '',
        savedToNetdiskAt: baseTask.savedToNetdiskAt || attemptSummary.savedToNetdiskAt || transfer?.savedToNetdiskAt || '',
        downloadedAt: baseTask.downloadedAt || attemptSummary.downloadedAt || transfer?.downloadedAt || '',
        attempts
    };
}

function getQuickDropLatestTaskAttemptId(task, transferMode) {
    return (task?.attempts || [])
        .filter(attempt => attempt.transferMode === transferMode && attempt.transferId)
        .sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0]?.transferId || '';
}

function normalizeQuickDropServerTaskItem(task, direction) {
    const normalizedTask = buildQuickDropTaskFromTransfer({
        task,
        taskId: task?.id || null,
        direction,
        transferMode: task?.transferMode || 'relay',
        status: task?.stage || task?.status || ''
    }, direction);
    return {
        id: normalizedTask.id,
        taskId: normalizedTask.taskId,
        taskKey: normalizedTask.taskKey,
        direction,
        transferMode: normalizedTask.transferMode,
        status: normalizedTask.stage,
        fileName: normalizedTask.fileName,
        fileSize: normalizedTask.fileSize,
        senderDeviceId: normalizedTask.senderDeviceId,
        receiverDeviceId: normalizedTask.receiverDeviceId,
        peerDeviceId: normalizedTask.peerDeviceId,
        peerLabel: normalizedTask.peerLabel,
        relayTransferId: getQuickDropLatestTaskAttemptId(normalizedTask, 'relay'),
        directTransferId: getQuickDropLatestTaskAttemptId(normalizedTask, 'direct'),
        task: normalizedTask
    };
}

function normalizeQuickDropTransferItem(transfer, direction, defaultMode) {
    const normalized = {
        ...transfer,
        direction: transfer?.direction || direction,
        transferMode: transfer?.transferMode || defaultMode,
        taskKey: transfer?.taskKey
            || transfer?.task?.taskKey
            || (defaultMode === 'relay' ? getQuickDropRelayTaskKey(transfer?.id) : '')
    };
    normalized.task = buildQuickDropTaskFromTransfer(normalized, direction);
    return normalized;
}

function getSelectedQuickDropDevice() {
    return quickDropState.devices.find(item => item.deviceId === quickDropState.selectedReceiverDeviceId) || null;
}

function renderQuickDropTargetStage() {
    const selected = document.getElementById('quickDropSelectedDevice');
    const selectedMeta = document.getElementById('quickDropSelectedDeviceMeta');
    const sendLabel = document.getElementById('quickDropSendBtnLabel');
    const targetChip = document.querySelector('.device-target-chip');
    const selectedDevice = getSelectedQuickDropDevice();

    if (selected) {
        selected.textContent = selectedDevice ? selectedDevice.deviceName : '-';
    }

    if (selectedMeta) {
        selectedMeta.textContent = selectedDevice
            ? `${selectedDevice.online ? quickDropText('quickDropOnline', 'Online') : quickDropText('quickDropOffline', 'Offline')} · ${selectedDevice.deviceType || detectQuickDropDeviceType()}`
            : quickDropText('quickDropSelectTargetHint', 'Tap a device below');
    }

    if (sendLabel) {
        sendLabel.textContent = selectedDevice
            ? quickDropText('quickDropSendNowWithDevice', 'Send to {name}').replace('{name}', selectedDevice.deviceName)
            : quickDropText('quickDropSendNow', 'Send now');
    }
    if (targetChip) {
        targetChip.classList.toggle('selected', Boolean(selectedDevice));
    }
}

function quickDropSignalState() {
    return window.QuickDropSignalManager && typeof QuickDropSignalManager.getState === 'function'
        ? QuickDropSignalManager.getState()
        : {};
}

function quickDropDirectDiagnostics() {
    return quickDropSignalState().directDiagnostics || {};
}

function getQuickDropDirectReadyWaitMs(baseMs) {
    if (window.QuickDropSignalManager && typeof QuickDropSignalManager.getRecommendedDirectWaitMs === 'function') {
        return QuickDropSignalManager.getRecommendedDirectWaitMs(baseMs);
    }
    const diagnostics = quickDropDirectDiagnostics();
    if (diagnostics.rtcHasTurn) {
        return Math.max(Number(baseMs) || 0, 4500);
    }
    return Number(baseMs) || 0;
}

function waitQuickDropMs(delayMs) {
    return new Promise(resolve => {
        window.setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
}

function isQuickDropRetryableDirectRouteError(error) {
    const message = String(error?.message || '').trim();
    if (!message) {
        return false;
    }
    const normalizedMessage = message.toLowerCase();
    return message.includes('直连信令')
        || normalizedMessage.includes('signaling offline')
        || normalizedMessage.includes('signaling is still offline')
        || normalizedMessage.includes('direct session failed');
}

function resolveQuickDropDirectFallbackReason(receiverDeviceId) {
    const signalState = quickDropSignalState();
    const diagnostics = signalState.directDiagnostics || {};
    if (!signalState.connected) {
        return 'signaling_unavailable';
    }
    if (signalState.latestPeerDeviceId && receiverDeviceId && signalState.latestPeerDeviceId !== receiverDeviceId) {
        return 'peer_mismatch';
    }
    if (diagnostics.connectionState === 'failed' || diagnostics.iceConnectionState === 'failed') {
        return 'ice_connection_failed';
    }
    if (signalState.directState === 'negotiating') {
        return 'direct_ready_timeout';
    }
    if (diagnostics.rtcHasTurn
        && Number(diagnostics.localCandidateTypes?.relay || 0) === 0
        && Number(diagnostics.remoteCandidateTypes?.relay || 0) === 0) {
        return 'no_relay_candidate';
    }
    return 'direct_link_unavailable';
}

function quickDropDirectMatchesSelectedDevice() {
    const signalState = quickDropSignalState();
    return signalState.latestPeerDeviceId
        && signalState.latestPeerDeviceId === quickDropState.selectedReceiverDeviceId;
}

function summarizeQuickDropSelectedFiles() {
    const items = quickDropState.selectedFiles || [];
    if (!items.length) {
        return {
            title: quickDropText('quickDropNoFileSelected', 'No file selected'),
            meta: ''
        };
    }
    if (items.length === 1) {
        return {
            title: items[0].label,
            meta: formatQuickDropSize(items[0].size)
        };
    }
    const totalSize = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
    return {
        title: quickDropText('quickDropBatchSelectedSummary', '{count} items selected').replace('{count}', String(items.length)),
        meta: `${formatQuickDropSize(totalSize)} · ${items.slice(0, 3).map(item => item.label).join(' · ')}${items.length > 3 ? ' ...' : ''}`
    };
}

async function maybeEnsureSelectedDeviceDirectRoute(options = {}) {
    const targetDevice = getSelectedQuickDropDevice();
    if (!targetDevice || !targetDevice.online) {
        return false;
    }
    if (!window.QuickDropSignalManager || typeof QuickDropSignalManager.ensurePairWithDevice !== 'function') {
        return false;
    }

    const now = Date.now();
    const force = Boolean(options.force);
    const canReuseAttempt = !force
        && quickDropState.directSessionTargetDeviceId === targetDevice.deviceId
        && now - quickDropState.directSessionLastAttemptAt < 12000;
    if (!canReuseAttempt || !quickDropDirectMatchesSelectedDevice()) {
        quickDropState.directSessionTargetDeviceId = targetDevice.deviceId;
        quickDropState.directSessionLastAttemptAt = now;
        const pairRetryCount = Math.max(0, Number(options.pairRetryCount) || 0);
        const pairRetryDelayMs = Math.max(0, Number(options.pairRetryDelayMs) || 0);
        for (let attemptIndex = 0; attemptIndex <= pairRetryCount; attemptIndex += 1) {
            try {
                await QuickDropSignalManager.ensurePairWithDevice(targetDevice.deviceId, { force });
                break;
            } catch (error) {
                const retryable = attemptIndex < pairRetryCount
                    && isQuickDropRetryableDirectRouteError(error);
                if (retryable) {
                    await waitQuickDropMs(pairRetryDelayMs * (attemptIndex + 1));
                    continue;
                }
                if (!options.silent) {
                    showToast(error.message, 'warning');
                }
                return false;
            }
        }
    }

    if (typeof QuickDropSignalManager.waitForDirectReady === 'function') {
        const waitMs = getQuickDropDirectReadyWaitMs(Number(options.waitForReadyMs) || 0);
        if (waitMs > 0) {
            let ready = await QuickDropSignalManager.waitForDirectReady(targetDevice.deviceId, waitMs);
            if (!ready) {
                const signalState = quickDropSignalState();
                const settleWaitMs = Number(options.settleWaitMs) || 0;
                const stillNegotiatingSamePeer = signalState.directState === 'negotiating'
                    && signalState.latestPeerDeviceId === targetDevice.deviceId;
                if (stillNegotiatingSamePeer && settleWaitMs > 0) {
                    ready = await QuickDropSignalManager.waitForDirectReady(targetDevice.deviceId, settleWaitMs);
                }
            }
            if (!ready && options.forceOnUnavailable) {
                const signalState = quickDropSignalState();
                if (signalState.directState === 'unavailable') {
                    try {
                        await QuickDropSignalManager.ensurePairWithDevice(targetDevice.deviceId, { force: true });
                    } catch (error) {
                        if (!options.silent) {
                            showToast(error.message, 'warning');
                        }
                        return false;
                    }
                    ready = await QuickDropSignalManager.waitForDirectReady(targetDevice.deviceId, getQuickDropDirectReadyWaitMs(waitMs));
                }
            }
            return ready;
        }
    }
    return quickDropDirectMatchesSelectedDevice()
        && typeof QuickDropSignalManager.isDirectReady === 'function'
        && QuickDropSignalManager.isDirectReady();
}

function refreshQuickDropDirectTransfers() {
    if (!window.QuickDropDirectTransfer || typeof QuickDropDirectTransfer.getTransfers !== 'function') {
        quickDropState.directIncomingTransfers = [];
        quickDropState.directOutgoingTransfers = [];
        return;
    }
    quickDropState.directIncomingTransfers = QuickDropDirectTransfer.getTransfers('incoming') || [];
    quickDropState.directOutgoingTransfers = QuickDropDirectTransfer.getTransfers('outgoing') || [];
}

function mergeQuickDropTransferGroup(items, direction) {
    const relayItems = items.filter(item => item.transferMode === 'relay');
    const directItems = items.filter(item => item.transferMode === 'direct');
    const latestRelay = relayItems.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0] || null;
    const latestDirect = directItems.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0] || null;
    const primary = latestRelay || latestDirect || items[0];
    const latestUpdateTime = items
        .map(item => item.updateTime)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || primary.updateTime;
    const primaryTask = buildQuickDropTaskFromTransfer(primary, direction);
    const latestRelayTask = latestRelay ? buildQuickDropTaskFromTransfer(latestRelay, direction) : null;
    const latestDirectTask = latestDirect ? buildQuickDropTaskFromTransfer(latestDirect, direction) : null;
    const fallbackPeerLabel = primary.transferMode === 'relay'
        ? (direction === 'incoming'
            ? getQuickDropDeviceName(primary.senderDeviceId)
            : getQuickDropDeviceName(primary.receiverDeviceId))
        : primary.peerLabel;
    const attempts = [];
    const seenAttempts = new Set();
    items.forEach(item => {
        buildQuickDropTaskFromTransfer(item, direction).attempts.forEach(attempt => {
            const key = `${attempt.transferMode}:${attempt.transferId || attempt.updateTime || attempt.stage || 'attempt'}`;
            if (seenAttempts.has(key)) {
                return;
            }
            seenAttempts.add(key);
            attempts.push(attempt);
        });
    });
    attempts.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime());
    const attemptSummary = buildQuickDropAttemptSummary(attempts, primaryTask);
    const mergedTask = {
        ...primaryTask,
        taskKey: primaryTask.taskKey || latestRelayTask?.taskKey || latestDirectTask?.taskKey || '',
        direction,
        transferMode: latestRelay && latestDirect ? 'hybrid' : primaryTask.transferMode,
        currentTransferMode: primaryTask.currentTransferMode || primaryTask.transferMode,
        stage: primaryTask.stage || primary.status || '',
        fileName: primaryTask.fileName || primary.fileName || '',
        fileSize: Number(primaryTask.fileSize ?? primary.fileSize ?? 0),
        peerDeviceId: primaryTask.peerDeviceId || primary.peerDeviceId || '',
        peerLabel: primaryTask.peerLabel || fallbackPeerLabel || '-',
        completedChunks: Number(primaryTask.completedChunks ?? getQuickDropTransferCompletedChunks(primary, direction)),
        totalChunks: Number(primaryTask.totalChunks ?? primary.totalChunks ?? 0),
        updateTime: latestUpdateTime || primaryTask.updateTime || primary.updateTime || '',
        attemptStatus: attemptSummary.attemptStatus || primaryTask.attemptStatus,
        startReason: attemptSummary.startReason || primaryTask.startReason,
        endReason: attemptSummary.endReason || primaryTask.endReason,
        failureReason: attemptSummary.failureReason || primaryTask.failureReason,
        startTime: attemptSummary.startTime || primaryTask.startTime,
        completedAt: primaryTask.completedAt || attemptSummary.completedAt,
        failedAt: attemptSummary.failedAt || primaryTask.failedAt,
        fallbackAt: attemptSummary.fallbackAt || primaryTask.fallbackAt,
        savedToNetdiskAt: primaryTask.savedToNetdiskAt || attemptSummary.savedToNetdiskAt,
        attempts
    };

    return {
        ...primary,
        updateTime: latestUpdateTime,
        transferMode: mergedTask.transferMode,
        relayTransferId: latestRelay?.id || '',
        directTransferId: latestDirect?.id || '',
        taskKey: mergedTask.taskKey,
        direction: mergedTask.direction,
        status: mergedTask.stage,
        fileName: mergedTask.fileName,
        fileSize: mergedTask.fileSize,
        peerDeviceId: mergedTask.peerDeviceId,
        peerLabel: mergedTask.peerLabel,
        task: mergedTask
    };
}

function buildQuickDropFallbackSignature(transfer, direction) {
    if (direction !== 'outgoing') {
        return '';
    }
    const peerIdentity = transfer.transferMode === 'direct'
        ? (transfer.peerDeviceId || transfer.peerLabel || '')
        : (transfer.receiverDeviceId || getQuickDropDeviceName(transfer.receiverDeviceId) || '');
    return [
        transfer.fileName || '',
        Number(transfer.fileSize || 0),
        peerIdentity
    ].join('|');
}

function buildQuickDropDisplayTransfers(direction) {
    const taskSource = direction === 'incoming'
        ? quickDropState.incomingTasks
        : quickDropState.outgoingTasks;
    if (Array.isArray(taskSource)) {
        return taskSource
            .map(task => normalizeQuickDropServerTaskItem(task, direction))
            .sort((left, right) => new Date(right.task?.updateTime || right.updateTime || 0).getTime() - new Date(left.task?.updateTime || left.updateTime || 0).getTime());
    }

    const combined = [
        ...(direction === 'incoming' ? quickDropState.incomingTransfers : quickDropState.outgoingTransfers).map(transfer =>
            normalizeQuickDropTransferItem(transfer, direction, 'relay')
        ),
        ...(direction === 'incoming' ? quickDropState.directIncomingTransfers : quickDropState.directOutgoingTransfers).map(transfer =>
            normalizeQuickDropTransferItem(transfer, direction, 'direct')
        )
    ];

    const directFallbackSignatures = new Set(
        combined
            .filter(transfer => direction === 'outgoing' && transfer.transferMode === 'direct' && transfer.status === 'relay_fallback')
            .map(transfer => buildQuickDropFallbackSignature(transfer, direction))
            .filter(Boolean)
    );

    const groups = new Map();
    combined.forEach(transfer => {
        const fallbackSignature = buildQuickDropFallbackSignature(transfer, direction);
        const groupKey = transfer.taskKey
            || (direction === 'outgoing'
                && ((transfer.transferMode === 'direct' && transfer.status === 'relay_fallback')
                    || (transfer.transferMode === 'relay' && directFallbackSignatures.has(fallbackSignature)))
                && fallbackSignature
                ? `fallback:${fallbackSignature}`
                : `${transfer.transferMode}:${transfer.id}`);
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(transfer);
    });

    return Array.from(groups.values())
        .map(items => mergeQuickDropTransferGroup(items, direction))
        .sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime());
}

function updateQuickDropCurrentDeviceCard() {
    const typeEl = document.getElementById('quickDropCurrentDeviceType');
    const statusEl = document.getElementById('quickDropCurrentDeviceStatus');
    const nameInput = document.getElementById('quickDropDeviceName');
    const nameDisplay = document.getElementById('quickDropCurrentDeviceNameDisplay');
    const iconWrap = document.getElementById('quickDropCurrentDeviceIcon');
    const currentType = quickDropState.currentDevice?.deviceType || detectQuickDropDeviceType();
    const currentName = quickDropState.currentDevice?.deviceName || getStoredQuickDropDeviceName();

    if (typeEl) {
        typeEl.textContent = currentType;
    }

    if (statusEl) {
        const online = quickDropState.currentDevice?.online !== false;
        statusEl.className = `status-pill ${online ? 'online' : 'offline'}`;
        statusEl.innerHTML = `<i class="fa-solid fa-circle"></i><span>${online ? quickDropText('quickDropOnline', 'Online') : quickDropText('quickDropOffline', 'Offline')}</span>`;
    }

    if (nameDisplay) {
        nameDisplay.textContent = currentName;
    }

    if (iconWrap) {
        iconWrap.innerHTML = `<i class="fa-solid ${getQuickDropDeviceIcon(currentType)}"></i>`;
    }

    if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = getStoredQuickDropDeviceName();
    }
}

function renderQuickDropDevices() {
    const list = document.getElementById('quickDropDeviceList');
    const empty = document.getElementById('quickDropDeviceEmpty');
    if (!list || !empty) {
        return;
    }

    const availableDevices = quickDropState.devices.filter(device => !device.current);
    const hasSelectedDevice = availableDevices.some(device => device.deviceId === quickDropState.selectedReceiverDeviceId);
    if (!hasSelectedDevice && availableDevices.length > 0) {
        const preferred = availableDevices.find(device => device.online) || availableDevices[0];
        quickDropState.selectedReceiverDeviceId = preferred.deviceId;
    }

    if (!availableDevices.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        quickDropState.selectedReceiverDeviceId = '';
        renderQuickDropTargetStage();
        return;
    }

    empty.classList.add('hidden');
    list.innerHTML = availableDevices.map(device => `
        <article class="device-card ${quickDropState.selectedReceiverDeviceId === device.deviceId ? 'selected' : ''}" data-quickdrop-device="${device.deviceId}">
            <span class="device-card-visual">
                <i class="fa-solid ${getQuickDropDeviceIcon(device.deviceType)}"></i>
            </span>
            <div class="device-card-copy">
                <h3>${device.deviceName}</h3>
                <p class="device-meta">
                    ${device.online ? quickDropText('quickDropOnline', 'Online') : quickDropText('quickDropOffline', 'Offline')}
                    · ${device.deviceType || detectQuickDropDeviceType()}
                </p>
            </div>
            <span class="device-card-state">${quickDropState.selectedReceiverDeviceId === device.deviceId
                ? quickDropText('quickDropDeviceSelected', 'Selected')
                : quickDropText('quickDropTapToChoose', 'Tap to choose')}</span>
        </article>
    `).join('');

    renderQuickDropTargetStage();
}

function renderQuickDropFolderSelect() {
    const select = document.getElementById('quickDropSaveFolderSelect');
    if (!select) {
        return;
    }

    const options = [
        { id: 0, label: quickDropText('quickDropRootFolder', 'Root') },
        ...quickDropState.folders.map(folder => ({
            id: folder.id,
            label: folder.name || folder.originalName || folder.fileName || `Folder ${folder.id}`
        }))
    ];

    const currentValue = select.value || '0';
    select.innerHTML = options.map(option => `
        <option value="${option.id}">${option.label}</option>
    `).join('');

    if (options.some(option => String(option.id) === currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '0';
    }
}

function renderQuickDropActiveUpload() {
    const wrap = document.getElementById('quickDropActiveUpload');
    const title = document.getElementById('quickDropActiveUploadTitle');
    const bar = document.getElementById('quickDropActiveUploadBar');
    const meta = document.getElementById('quickDropActiveUploadMeta');
    const sendBtn = document.getElementById('quickDropSendBtn');
    const selectedFile = document.getElementById('quickDropSelectedFile');

    if (!wrap || !title || !bar || !meta || !sendBtn || !selectedFile) {
        return;
    }

    renderQuickDropTargetStage();

    if (quickDropState.selectedFiles.length) {
        const summary = summarizeQuickDropSelectedFiles();
        selectedFile.innerHTML = `
            <span>${summary.title}</span>
            <span>${summary.meta || '-'}</span>
        `;
    } else {
        selectedFile.innerHTML = `<span>${quickDropText('quickDropNoFileSelected', 'No file selected')}</span>`;
    }

    if (!quickDropState.activeUpload) {
        wrap.classList.add('hidden');
    } else {
        wrap.classList.remove('hidden');
        title.textContent = quickDropState.activeUpload.fileName;
        bar.style.width = `${quickDropState.activeUpload.progress}%`;
        meta.textContent = `${quickDropState.activeUpload.progress}% · ${quickDropState.activeUpload.statusText}`;
    }

    sendBtn.disabled = quickDropState.sending || !quickDropState.selectedFiles.length || !quickDropState.selectedReceiverDeviceId;
}

function renderQuickDropTransfers() {
    quickDropState.displayIncomingTransfers = buildQuickDropDisplayTransfers('incoming');
    quickDropState.displayOutgoingTransfers = buildQuickDropDisplayTransfers('outgoing');
    renderQuickDropTransferList(
        quickDropState.displayIncomingTransfers,
        document.getElementById('quickDropIncomingList'),
        document.getElementById('quickDropIncomingEmpty'),
        'incoming'
    );
    renderQuickDropTransferList(
        quickDropState.displayOutgoingTransfers,
        document.getElementById('quickDropOutgoingList'),
        document.getElementById('quickDropOutgoingEmpty'),
        'outgoing'
    );
}

function renderQuickDropTransferList(transfers, container, empty, direction) {
    if (!container || !empty) {
        return;
    }

    if (!transfers.length) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = transfers.map((transfer, index) => {
        const task = buildQuickDropTaskFromTransfer(transfer, direction);
        const isDirect = task.transferMode === 'direct';
        const isHybrid = task.transferMode === 'hybrid';
        const relayAttemptId = transfer.relayTransferId || getQuickDropLatestTaskAttemptId(task, 'relay');
        const directAttemptId = transfer.directTransferId || getQuickDropLatestTaskAttemptId(task, 'direct');
        const chunkProgress = Number(task.completedChunks || 0);
        const progress = task.totalChunks > 0
            ? Math.round((chunkProgress / task.totalChunks) * 100)
            : 0;
        const peerName = task.peerLabel || quickDropText('quickDropDirectPeerFallback', 'Paired device');
        const peerLabel = direction === 'incoming'
            ? `${quickDropText('quickDropSender', 'Sender')}: ${peerName}`
            : `${quickDropText('quickDropReceiver', 'Receiver')}: ${peerName}`;

        const readyForDownload = task.stage === 'ready' || task.stage === 'completed';
        const primaryAction = readyForDownload
            ? `<button class="btn btn-primary" type="button" ${
                isDirect
                    ? `data-quickdrop-direct-download="${directAttemptId || ''}"`
                    : isHybrid && relayAttemptId
                        ? `data-quickdrop-download="${relayAttemptId}"`
                        : isHybrid && directAttemptId
                            ? `data-quickdrop-direct-download="${directAttemptId}"`
                            : `data-quickdrop-download="${transfer.id}"`
            }>
                    <i class="fa-solid fa-download"></i>
                    <span>${quickDropText('quickDropDownload', 'Download')}</span>
               </button>`
            : '';

        const saveAction = direction === 'incoming' && readyForDownload
            ? `<button class="btn btn-secondary" type="button" ${
                isDirect
                    ? `data-quickdrop-direct-save="${directAttemptId || ''}"`
                    : isHybrid && relayAttemptId
                        ? `data-quickdrop-save="${relayAttemptId}"`
                        : isHybrid && directAttemptId
                            ? `data-quickdrop-direct-save="${directAttemptId}"`
                            : `data-quickdrop-save="${transfer.id}"`
            }>
                    <i class="fa-solid fa-hard-drive"></i>
                    <span>${quickDropText('quickDropSaveToNetdisk', 'Save to Netdisk')}</span>
               </button>`
            : '';

        const deleteAttrs = task.taskId
            ? `data-quickdrop-task-delete="${direction}:${index}"`
            : isDirect
            ? `data-quickdrop-direct-delete="${directAttemptId || transfer.id}"`
            : isHybrid
                ? `${relayAttemptId ? `data-quickdrop-delete-relay="${relayAttemptId}" ` : ''}${directAttemptId ? `data-quickdrop-delete-direct="${directAttemptId}"` : ''}`.trim()
                : `data-quickdrop-delete="${transfer.id}"`;

        return `
            <article class="transfer-card">
                <div class="transfer-card-head">
                    <div class="transfer-card-title">
                        <h3>${task.fileName}</h3>
                        <p class="transfer-meta">${formatQuickDropSize(task.fileSize)} · ${peerLabel} · ${quickDropTransferModeLabel(task.transferMode)}</p>
                    </div>
                    <span class="device-pill">${formatQuickDropStatus(task.stage)}</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" style="width:${progress}%"></div>
                </div>
                <p class="transfer-meta">
                    ${quickDropText('quickDropChunkProgress', 'Chunks')}: ${chunkProgress} / ${task.totalChunks || 0}
                    · ${quickDropText('quickDropUpdatedAt', 'Updated')}: ${formatQuickDropTime(task.updateTime)}
                </p>
                <div class="actions">
                    ${primaryAction}
                    ${saveAction}
                    <button class="btn btn-secondary" type="button" data-quickdrop-detail="${direction}:${index}">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>${quickDropText('quickDropTaskDetails', 'Details')}</span>
                    </button>
                    <button class="btn btn-secondary" type="button" ${deleteAttrs}>
                        <i class="fa-solid fa-trash"></i>
                        <span>${quickDropText('quickDropDelete', 'Delete')}</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function collectQuickDropTaskAttemptIds(task, transferMode) {
    return Array.from(new Set(
        (task?.attempts || [])
            .filter(attempt => attempt.transferMode === transferMode && attempt.transferId)
            .map(attempt => String(attempt.transferId))
    ));
}

function formatQuickDropTaskAttemptLine(attempt) {
    const bits = [
        `- ${quickDropTransferModeLabel(attempt.transferMode)}`,
        formatQuickDropStatus(attempt.stage),
        `${quickDropText('quickDropChunkProgress', 'Chunks')}: ${Number(attempt.completedChunks || 0)} / ${Number(attempt.totalChunks || 0)}`,
        `${quickDropText('quickDropLifecycleLabel', 'Lifecycle')}: ${formatQuickDropAttemptStatus(attempt.attemptStatus || deriveQuickDropAttemptStatus(attempt.stage || ''))}`
    ];
    const idLabel = attempt.transferMode === 'relay'
        ? quickDropText('quickDropRelayTransferIdLabel', 'Relay Transfer ID')
        : quickDropText('quickDropDirectTransferIdLabel', 'Direct Transfer ID');
    bits.push(`${idLabel}: ${attempt.transferId || '-'}`);
    if (attempt.startReason) {
        bits.push(`${quickDropText('quickDropStartReasonLabel', 'Start Reason')}: ${formatQuickDropLifecycleReason(attempt.startReason)}`);
    }
    if (attempt.endReason) {
        bits.push(`${quickDropText('quickDropEndReasonLabel', 'End Reason')}: ${formatQuickDropLifecycleReason(attempt.endReason)}`);
    }
    if (attempt.failureReason) {
        bits.push(`${quickDropText('quickDropFailureReasonLabel', 'Failure Reason')}: ${formatQuickDropLifecycleReason(attempt.failureReason)}`);
    }
    if (attempt.startTime) {
        bits.push(`${quickDropText('quickDropStartedAtLabel', 'Started')}: ${formatQuickDropTime(attempt.startTime)}`);
    }
    if (attempt.fallbackAt) {
        bits.push(`${quickDropText('quickDropFallbackAtLabel', 'Fallback At')}: ${formatQuickDropTime(attempt.fallbackAt)}`);
    }
    if (attempt.failedAt) {
        bits.push(`${quickDropText('quickDropFailedAtLabel', 'Failed At')}: ${formatQuickDropTime(attempt.failedAt)}`);
    }
    if (attempt.completedAt) {
        bits.push(`${quickDropText('quickDropCompletedAtLabel', 'Completed At')}: ${formatQuickDropTime(attempt.completedAt)}`);
    }
    bits.push(`${quickDropText('quickDropUpdatedAt', 'Updated')}: ${formatQuickDropTime(attempt.updateTime)}`);
    return bits.join(' · ');
}

function formatQuickDropTaskCurrentStage(task) {
    const currentMode = task?.currentTransferMode || task?.transferMode || 'relay';
    return `${quickDropTransferModeLabel(currentMode)} · ${formatQuickDropStatus(task?.stage || '')}`;
}

function buildQuickDropTransferDetailValue(transfer, direction) {
    const task = buildQuickDropTaskFromTransfer(transfer, direction);
    const relayIds = collectQuickDropTaskAttemptIds(task, 'relay');
    const directIds = collectQuickDropTaskAttemptIds(task, 'direct');
    const lines = [
        `${quickDropText('quickDropTaskKeyLabel', 'Task Key')}: ${task.taskKey || '-'}`,
        `${quickDropText('quickDropTaskModeLabel', 'Mode')}: ${quickDropTransferModeLabel(task.transferMode)}`,
        `${quickDropText('quickDropTaskStatusLabel', 'Status')}: ${formatQuickDropStatus(task.stage)}`,
        `${quickDropText('quickDropLifecycleLabel', 'Lifecycle')}: ${formatQuickDropAttemptStatus(task.attemptStatus || deriveQuickDropAttemptStatus(task.stage || ''))}`,
        `${quickDropText('quickDropTaskCurrentStageLabel', 'Current Step')}: ${formatQuickDropTaskCurrentStage(task)}`,
        `${quickDropText('quickDropTaskDirectionLabel', 'Direction')}: ${task.direction === 'incoming'
            ? quickDropText('quickDropIncoming', 'Inbox')
            : quickDropText('quickDropOutgoing', 'Outgoing')}`,
        `${quickDropText('quickDropTaskFileLabel', 'File')}: ${task.fileName || '-'}`,
        `${quickDropText('quickDropTaskSizeLabel', 'Size')}: ${formatQuickDropSize(task.fileSize)}`,
        `${quickDropText('quickDropTaskPeerLabel', 'Peer')}: ${task.peerLabel || '-'}`,
        `${quickDropText('quickDropChunkProgress', 'Chunks')}: ${Number(task.completedChunks || 0)} / ${task.totalChunks || 0}`,
        `${quickDropText('quickDropStartedAtLabel', 'Started')}: ${task.startTime ? formatQuickDropTime(task.startTime) : quickDropText('quickDropNotYet', 'Not yet')}`,
        `${quickDropText('quickDropCompletedAtLabel', 'Completed At')}: ${task.completedAt ? formatQuickDropTime(task.completedAt) : quickDropText('quickDropNotYet', 'Not yet')}`,
        `${quickDropText('quickDropSavedAtLabel', 'Saved To Netdisk')}: ${task.savedToNetdiskAt ? formatQuickDropTime(task.savedToNetdiskAt) : quickDropText('quickDropNotYet', 'Not yet')}`,
        `${quickDropText('quickDropUpdatedAt', 'Updated')}: ${formatQuickDropTime(task.updateTime)}`
    ];
    if (task.startReason) {
        lines.push(`${quickDropText('quickDropStartReasonLabel', 'Start Reason')}: ${formatQuickDropLifecycleReason(task.startReason)}`);
    }
    if (task.endReason) {
        lines.push(`${quickDropText('quickDropEndReasonLabel', 'End Reason')}: ${formatQuickDropLifecycleReason(task.endReason)}`);
    }
    if (task.failureReason) {
        lines.push(`${quickDropText('quickDropFailureReasonLabel', 'Failure Reason')}: ${formatQuickDropLifecycleReason(task.failureReason)}`);
    }
    if (task.fallbackAt) {
        lines.push(`${quickDropText('quickDropFallbackAtLabel', 'Fallback At')}: ${formatQuickDropTime(task.fallbackAt)}`);
    }
    if (task.failedAt) {
        lines.push(`${quickDropText('quickDropFailedAtLabel', 'Failed At')}: ${formatQuickDropTime(task.failedAt)}`);
    }

    if (relayIds.length) {
        lines.push(`${quickDropText('quickDropRelayTransferIdLabel', 'Relay Transfer ID')}: ${relayIds.join(', ')}`);
    }
    if (directIds.length) {
        lines.push(`${quickDropText('quickDropDirectTransferIdLabel', 'Direct Transfer ID')}: ${directIds.join(', ')}`);
    }
    if (task.attempts.length) {
        lines.push(`${quickDropText('quickDropTaskAttemptsLabel', 'Attempts')}:`);
        task.attempts.forEach(attempt => lines.push(formatQuickDropTaskAttemptLine(attempt)));
    }
    lines.push(...buildQuickDropDirectDiagnosticsLines());

    return lines.join('\n');
}

async function showQuickDropTransferDetails(direction, index) {
    const transfers = direction === 'incoming'
        ? quickDropState.displayIncomingTransfers
        : quickDropState.displayOutgoingTransfers;
    const transfer = transfers[Number(index)];
    if (!transfer) {
        return;
    }

    const message = quickDropText('quickDropTaskDetailsHint', 'Task detail snapshot. Use copy if you need to compare ids or keys across devices.');
    const value = buildQuickDropTransferDetailValue(transfer, direction);

    if (typeof showAppCopyDialog === 'function') {
        await showAppCopyDialog(message, value, {
            title: quickDropText('quickDropTaskDetailsTitle', 'Task Details'),
            icon: 'fa-circle-info',
            multiline: true,
            confirmText: quickDropText('quickDropClose', 'Close')
        });
        return;
    }

    await showAppAlert(value, {
        title: quickDropText('quickDropTaskDetailsTitle', 'Task Details'),
        icon: 'fa-circle-info'
    });
}

function renderQuickDropPage() {
    updateQuickDropCurrentDeviceCard();
    renderQuickDropDevices();
    renderQuickDropTargetStage();
    renderQuickDropPickerMenu();
    renderQuickDropFolderSelect();
    renderQuickDropActiveUpload();
    renderQuickDropTransfers();
    setQuickDropMode(quickDropState.currentMode);
    renderQuickDropSubpage();
    renderQuickDropDisclosure();
}

async function syncQuickDrop(silent = false) {
    if (!(typeof isLoggedIn === 'function' && isLoggedIn())) {
        quickDropState.currentDevice = null;
        quickDropState.devices = [];
        quickDropState.folders = [];
        quickDropState.incomingTasks = null;
        quickDropState.outgoingTasks = null;
        quickDropState.incomingTransfers = [];
        quickDropState.outgoingTransfers = [];
        quickDropState.selectedReceiverDeviceId = '';
        setQuickDropAccountMode(false);
        renderQuickDropPage();
        return;
    }

    try {
        const [data, folders] = await Promise.all([
            quickDropRequest('/quickdrop/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: getQuickDropDeviceId(),
                    deviceName: getStoredQuickDropDeviceName(),
                    deviceType: detectQuickDropDeviceType()
                })
            }),
            quickDropRequest('/folders/all')
        ]);

        quickDropState.currentDevice = data.currentDevice;
        quickDropState.devices = data.devices || [];
        quickDropState.folders = folders || [];
        quickDropState.incomingTasks = Array.isArray(data.incomingTasks) ? data.incomingTasks : null;
        quickDropState.outgoingTasks = Array.isArray(data.outgoingTasks) ? data.outgoingTasks : null;
        quickDropState.incomingTransfers = data.incomingTransfers || [];
        quickDropState.outgoingTransfers = data.outgoingTransfers || [];
        quickDropState.recommendedChunkSize = data.recommendedChunkSize || quickDropState.recommendedChunkSize;
        setQuickDropAccountMode(true);
        refreshQuickDropDirectTransfers();
        quickDropState.currentSubpage = getQuickDropSubpageFromLocation();
        renderQuickDropPage();
        maybeEnsureSelectedDeviceDirectRoute({ silent: true, waitForReadyMs: 1200 }).catch(() => {});
    } catch (error) {
        if (!silent) {
            showToast(error.message, 'error');
        }
    }
}

async function saveQuickDropDeviceName() {
    const input = document.getElementById('quickDropDeviceName');
    if (!input) {
        return;
    }

    const value = input.value.trim();
    if (!value) {
        showToast(quickDropText('quickDropDeviceNameRequired', 'Device name is required'), 'error');
        return;
    }

    setStoredQuickDropDeviceName(value);
    await syncQuickDrop();
    quickDropState.deviceSettingsExpanded = false;
    renderQuickDropDisclosure();
    showToast(quickDropText('quickDropDeviceNameSaved', 'Device name updated'), 'success');
}

function openQuickDropFilePicker() {
    if (!quickDropState.selectedReceiverDeviceId) {
        showToast(quickDropText('quickDropChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    closeQuickDropPickerMenu();

    const input = document.getElementById('quickDropFileInput');
    if (input) {
        input.click();
    }
}

function openQuickDropFolderPicker() {
    if (!quickDropState.selectedReceiverDeviceId) {
        showToast(quickDropText('quickDropChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    closeQuickDropPickerMenu();

    const input = document.getElementById('quickDropFolderInput');
    if (input) {
        input.click();
    }
}

function handleQuickDropFileChange(event) {
    setQuickDropSelectedFiles(Array.from(event.target.files || []));
    closeQuickDropPickerMenu();
    renderQuickDropActiveUpload();
}

function findQuickDropTaskByKey(taskKey) {
    if (!taskKey) {
        return null;
    }
    const tasks = [
        ...(Array.isArray(quickDropState.incomingTasks) ? quickDropState.incomingTasks : []),
        ...(Array.isArray(quickDropState.outgoingTasks) ? quickDropState.outgoingTasks : [])
    ];
    return tasks.find(task => task?.taskKey === taskKey) || null;
}

async function resolveQuickDropTransferSession(file, receiverDeviceId) {
    let taskKey = arguments.length > 2 ? arguments[2] : '';
    let taskId = arguments.length > 3 ? arguments[3] : null;
    const pendingUploads = loadQuickDropPendingUploads();
    const pendingKey = buildQuickDropPendingKey(file, receiverDeviceId);
    const pending = pendingUploads[pendingKey];
    const currentDeviceId = getQuickDropDeviceId();

    if (pending && pending.transferId) {
        try {
            const session = await quickDropRequest(`/quickdrop/transfers/${pending.transferId}?deviceId=${encodeURIComponent(currentDeviceId)}`);
            if (session.fileName === file.name
                && Number(session.fileSize) === Number(file.size)
                && session.receiverDeviceId === receiverDeviceId
                && session.status !== 'ready'
                && session.status !== 'completed') {
                taskId = taskId || session.taskId || pending?.taskId || null;
                if (taskKey || pending?.taskKey) {
                    setQuickDropRelayTaskKey(session.id, taskKey || pending.taskKey);
                }
                return session;
            }
        } catch (error) {
            delete pendingUploads[pendingKey];
            saveQuickDropPendingUploads(pendingUploads);
        }
    }

    const created = await quickDropRequest('/quickdrop/transfers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            taskId,
            deviceId: currentDeviceId,
            receiverDeviceId,
            taskKey,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
            chunkSize: quickDropState.recommendedChunkSize
        })
    });

    pendingUploads[pendingKey] = {
        transferId: created.id,
        receiverDeviceId,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        taskKey: taskKey || pending?.taskKey || '',
        taskId: created.taskId || taskId || pending?.taskId || null
    };
    saveQuickDropPendingUploads(pendingUploads);
    if (taskKey || pending?.taskKey) {
        setQuickDropRelayTaskKey(created.id, taskKey || pending.taskKey);
    }
    return created;
}

function clearQuickDropPendingSession(file, receiverDeviceId) {
    const pendingUploads = loadQuickDropPendingUploads();
    delete pendingUploads[buildQuickDropPendingKey(file, receiverDeviceId)];
    saveQuickDropPendingUploads(pendingUploads);
}

async function deleteQuickDropTransferGroup(relayTransferId, directTransferId) {
    const confirmed = await showAppConfirm(quickDropText('quickDropDeleteConfirm', 'Delete this transfer record?'), {
        title: quickDropText('quickDropDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: quickDropText('quickDropDelete', 'Delete')
    });
    if (!confirmed) {
        return;
    }

    if (relayTransferId) {
        await quickDropRequest(`/quickdrop/transfers/${relayTransferId}?deviceId=${encodeURIComponent(getQuickDropDeviceId())}`, {
            method: 'DELETE'
        });
        removeQuickDropRelayTaskKey(relayTransferId);
    }
    if (directTransferId && window.QuickDropDirectTransfer?.deleteTransfer) {
        await QuickDropDirectTransfer.deleteTransfer(directTransferId, { skipConfirm: true });
    }
    await syncQuickDrop();
}

async function deleteQuickDropTask(direction, index) {
    const transfers = direction === 'incoming'
        ? quickDropState.displayIncomingTransfers
        : quickDropState.displayOutgoingTransfers;
    const transfer = transfers[Number(index)];
    if (!transfer) {
        return;
    }

    const task = buildQuickDropTaskFromTransfer(transfer, direction);
    if (!task.taskId) {
        await deleteQuickDropTransferGroup(transfer.relayTransferId, transfer.directTransferId);
        return;
    }

    const confirmed = await showAppConfirm(quickDropText('quickDropDeleteConfirm', 'Delete this transfer record?'), {
        title: quickDropText('quickDropDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: quickDropText('quickDropDelete', 'Delete')
    });
    if (!confirmed) {
        return;
    }

    await quickDropRequest(`/quickdrop/tasks/${task.taskId}?deviceId=${encodeURIComponent(getQuickDropDeviceId())}`, {
        method: 'DELETE'
    });
    (collectQuickDropTaskAttemptIds(task, 'direct')).forEach(transferId => {
        if (window.QuickDropDirectTransfer?.deleteTransfer) {
            QuickDropDirectTransfer.deleteTransfer(transferId, {
                skipConfirm: true,
                skipServerSync: true
            }).catch(error => console.warn('Failed to delete local direct transfer:', error));
        }
    });
    await syncQuickDrop();
}

async function sendSingleQuickDropFile(selectedItem, batchIndex, batchTotal) {
    const file = selectedItem.file;
    const receiverDeviceId = quickDropState.selectedReceiverDeviceId;
    const taskKey = buildQuickDropTaskKey(file, receiverDeviceId, 'outgoing');
    try {
        let directInterrupted = false;
        let directTaskId = findQuickDropTaskByKey(taskKey)?.id || null;
        const directReady = await maybeEnsureSelectedDeviceDirectRoute({
            silent: true,
            waitForReadyMs: 1800,
            settleWaitMs: 4200,
            forceOnUnavailable: true,
            pairRetryCount: 2,
            pairRetryDelayMs: 450
        });
        if (directReady
            && window.QuickDropDirectTransfer
            && typeof QuickDropDirectTransfer.canSendToPeerDevice === 'function'
            && typeof QuickDropDirectTransfer.sendFile === 'function'
            && QuickDropDirectTransfer.canSendToPeerDevice(receiverDeviceId)) {
            try {
                await QuickDropDirectTransfer.sendFile(file, {
                    expectedPeerDeviceId: receiverDeviceId,
                    silentError: true,
                    taskKey
                });
                clearQuickDropSelectedFile();
                quickDropState.activeUpload = null;
                renderQuickDropActiveUpload();
                showToast(quickDropText('quickDropDirectPreferred', 'Direct link is handling this transfer'), 'success');
                return;
            } catch (directError) {
                directInterrupted = true;
                directTaskId = directError?.quickDropDirectContext?.taskId || directTaskId;
                if (typeof QuickDropDirectTransfer.markFallbackToRelay === 'function') {
                    QuickDropDirectTransfer.markFallbackToRelay(directError.quickDropDirectContext || {});
                }
                showToast(quickDropText('quickDropDirectInterruptedRelay', 'Direct transfer was interrupted, switching to server relay'), 'warning');
            }
        }

        if (!directInterrupted && getSelectedQuickDropDevice()?.online) {
            if (window.QuickDropDirectTransfer?.recordSameAccountRelayFallbackAttempt) {
                const currentDeviceId = getQuickDropDeviceId();
                const failureReason = resolveQuickDropDirectFallbackReason(receiverDeviceId);
                QuickDropDirectTransfer.recordSameAccountRelayFallbackAttempt({
                    taskId: directTaskId,
                    taskKey,
                    fileName: file.name,
                    fileSize: file.size,
                    contentType: file.type || 'application/octet-stream',
                    senderDeviceId: currentDeviceId,
                    receiverDeviceId,
                    failureReason
                }).catch(error => console.warn('Failed to record same-account direct fallback attempt:', error));
            }
            showToast(quickDropText('quickDropRelayFallback', 'Direct link is not ready yet, falling back to server relay'), 'warning');
        }

        let session = await resolveQuickDropTransferSession(file, receiverDeviceId, taskKey, directTaskId);
        const uploadedIndexes = new Set(session.uploadedChunkIndexes || []);
        const totalChunks = session.totalChunks || Math.max(1, Math.ceil(file.size / session.chunkSize));
        const batchLabel = batchTotal > 1 ? `${batchIndex + 1}/${batchTotal} · ` : '';

        quickDropState.activeUpload = {
            fileName: `${batchLabel}${selectedItem.label}`,
            progress: Math.round((uploadedIndexes.size / totalChunks) * 100),
            statusText: quickDropText('quickDropResumeHint', 'Interrupted uploads can continue from missing chunks')
        };
        renderQuickDropActiveUpload();

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadedIndexes.has(chunkIndex)) {
                continue;
            }

            const start = chunkIndex * session.chunkSize;
            const end = Math.min(file.size, start + session.chunkSize);
            const chunk = file.slice(start, end);

            const response = await fetch(`${API_BASE}/quickdrop/transfers/${session.id}/chunks/${chunkIndex}?deviceId=${encodeURIComponent(getQuickDropDeviceId())}`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/octet-stream'
                },
                body: chunk
            });

            const text = await response.text();
            const result = text ? JSON.parse(text) : null;
            if (!response.ok || !result || result.code !== 200) {
                throw new Error(result?.message || 'QuickDrop chunk upload failed');
            }

            session = result.data;
            uploadedIndexes.add(chunkIndex);
            quickDropState.activeUpload = {
                fileName: `${batchLabel}${selectedItem.label}`,
                progress: Math.round(((session.uploadedChunks || uploadedIndexes.size) / totalChunks) * 100),
                statusText: `${session.uploadedChunks || uploadedIndexes.size}/${totalChunks} ${quickDropText('quickDropChunkProgress', 'chunks')}`
            };
            renderQuickDropActiveUpload();
        }

        clearQuickDropPendingSession(file, receiverDeviceId);
        quickDropState.activeUpload = {
            fileName: `${batchLabel}${selectedItem.label}`,
            progress: 100,
            statusText: quickDropText('quickDropStatusReady', 'Ready to Download')
        };
        renderQuickDropActiveUpload();
        await syncQuickDrop();
        showToast(quickDropText('quickDropSendSuccess', 'File is ready on the target device'), 'success');
    } catch (error) {
        showToast(error.message, 'error');
        quickDropState.activeUpload = {
            fileName: selectedItem.label,
            progress: quickDropState.activeUpload?.progress || 0,
            statusText: quickDropText('quickDropResumeHint', 'Re-select the same file to continue missing chunks')
        };
        renderQuickDropActiveUpload();
        throw error;
    }
}

async function sendQuickDropFile() {
    if (quickDropState.sending || !quickDropState.selectedFiles.length || !quickDropState.selectedReceiverDeviceId) {
        return;
    }

    quickDropState.sending = true;
    const selectedItems = [...quickDropState.selectedFiles];

    try {
        for (let index = 0; index < selectedItems.length; index++) {
            await sendSingleQuickDropFile(selectedItems[index], index, selectedItems.length);
        }
        clearQuickDropSelectedFile();
        quickDropState.activeUpload = null;
        renderQuickDropActiveUpload();
    } finally {
        quickDropState.sending = false;
        renderQuickDropActiveUpload();
    }
}

async function deleteQuickDropTransfer(transferId) {
    const confirmed = await showAppConfirm(quickDropText('quickDropDeleteConfirm', 'Delete this transfer record?'), {
        title: quickDropText('quickDropDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: quickDropText('quickDropDelete', 'Delete')
    });

    if (!confirmed) {
        return;
    }

    await quickDropRequest(`/quickdrop/transfers/${transferId}?deviceId=${encodeURIComponent(getQuickDropDeviceId())}`, {
        method: 'DELETE'
    });
    removeQuickDropRelayTaskKey(transferId);
    await syncQuickDrop();
}

async function saveQuickDropTransferToNetdisk(transferId) {
    const folderId = Number(document.getElementById('quickDropSaveFolderSelect')?.value || 0);
    const response = await quickDropRequest(`/quickdrop/transfers/${transferId}/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deviceId: getQuickDropDeviceId(),
            folderId
        })
    });
    await syncQuickDrop();
    showToast(quickDropText('quickDropSavedToNetdisk', 'Saved to your netdisk'), 'success');
    return response;
}

function downloadQuickDropTransfer(transferId) {
    window.location.href = `${API_BASE}/quickdrop/transfers/${transferId}/download?deviceId=${encodeURIComponent(getQuickDropDeviceId())}`;
    setTimeout(() => {
        syncQuickDrop(true);
    }, 1200);
}

function bindQuickDropEvents() {
    const fileInput = document.getElementById('quickDropFileInput');
    const folderInput = document.getElementById('quickDropFolderInput');
    const modeSwitch = document.getElementById('quickDropModeSwitch');
    const directHistoryToggle = document.getElementById('quickDropDirectHistoryToggle');
    const accountHistoryToggle = document.getElementById('quickDropAccountHistoryToggle');
    const deviceSettingsToggle = document.getElementById('quickDropDeviceSettingsToggle');
    const historyBackBtn = document.getElementById('quickDropHistoryBackBtn');
    const deviceList = document.getElementById('quickDropDeviceList');
    const incomingList = document.getElementById('quickDropIncomingList');
    const outgoingList = document.getElementById('quickDropOutgoingList');

    if (fileInput) {
        fileInput.addEventListener('change', handleQuickDropFileChange);
    }
    if (folderInput) {
        folderInput.addEventListener('change', handleQuickDropFileChange);
    }
    if (modeSwitch) {
        modeSwitch.addEventListener('click', event => {
            const button = event.target.closest('[data-quickdrop-mode]');
            if (!button) {
                return;
            }
            closeQuickDropHistoryDrawer();
            setQuickDropMode(button.getAttribute('data-quickdrop-mode'));
            renderQuickDropDisclosure();
        });
    }
    if (directHistoryToggle) {
        directHistoryToggle.addEventListener('click', () => {
            openQuickDropHistoryPage('temporaryHistory');
        });
    }
    if (accountHistoryToggle) {
        accountHistoryToggle.addEventListener('click', () => {
            openQuickDropHistoryPage('accountHistory');
        });
    }
    if (deviceSettingsToggle) {
        deviceSettingsToggle.addEventListener('click', () => {
            quickDropState.deviceSettingsExpanded = !quickDropState.deviceSettingsExpanded;
            renderQuickDropDisclosure();
        });
    }
    if (historyBackBtn) {
        historyBackBtn.addEventListener('click', closeQuickDropHistoryDrawer);
    }

    if (deviceList) {
        deviceList.addEventListener('click', event => {
            const card = event.target.closest('[data-quickdrop-device]');
            if (!card) {
                return;
            }
            quickDropState.selectedReceiverDeviceId = card.getAttribute('data-quickdrop-device') || '';
            quickDropState.directSessionTargetDeviceId = '';
            renderQuickDropDevices();
            renderQuickDropActiveUpload();
            maybeEnsureSelectedDeviceDirectRoute({ silent: true, waitForReadyMs: 1200, force: true }).catch(() => {});
        });
    }

    document.addEventListener('click', event => {
        if (!event.target.closest('#quickDropPickerShell')) {
            closeQuickDropPickerMenu();
        }
    });

    [incomingList, outgoingList].forEach(container => {
        if (!container) {
            return;
        }
        container.addEventListener('click', event => {
            const downloadButton = event.target.closest('[data-quickdrop-download]');
            if (downloadButton) {
                downloadQuickDropTransfer(downloadButton.getAttribute('data-quickdrop-download'));
                return;
            }

            const saveButton = event.target.closest('[data-quickdrop-save]');
            if (saveButton) {
                saveQuickDropTransferToNetdisk(saveButton.getAttribute('data-quickdrop-save'));
                return;
            }

            const detailButton = event.target.closest('[data-quickdrop-detail]');
            if (detailButton) {
                const [directionKey, index] = String(detailButton.getAttribute('data-quickdrop-detail') || '').split(':');
                showQuickDropTransferDetails(directionKey, index);
                return;
            }

            const taskDeleteButton = event.target.closest('[data-quickdrop-task-delete]');
            if (taskDeleteButton) {
                const [directionKey, index] = String(taskDeleteButton.getAttribute('data-quickdrop-task-delete') || '').split(':');
                deleteQuickDropTask(directionKey, index);
                return;
            }

            const directDownloadButton = event.target.closest('[data-quickdrop-direct-download]');
            if (directDownloadButton && window.QuickDropDirectTransfer?.downloadTransfer) {
                QuickDropDirectTransfer.downloadTransfer(directDownloadButton.getAttribute('data-quickdrop-direct-download'));
                return;
            }

            const directSaveButton = event.target.closest('[data-quickdrop-direct-save]');
            if (directSaveButton && window.QuickDropDirectTransfer?.saveTransferToNetdisk) {
                const folderId = Number(document.getElementById('quickDropSaveFolderSelect')?.value || 0);
                QuickDropDirectTransfer.saveTransferToNetdisk(directSaveButton.getAttribute('data-quickdrop-direct-save'), folderId)
                    .catch(error => showToast(error.message, 'error'));
                return;
            }

            const deleteButton = event.target.closest('[data-quickdrop-delete]');
            if (deleteButton) {
                deleteQuickDropTransfer(deleteButton.getAttribute('data-quickdrop-delete'));
                return;
            }

            const groupedDeleteButton = event.target.closest('[data-quickdrop-delete-relay], [data-quickdrop-delete-direct]');
            if (groupedDeleteButton && (groupedDeleteButton.getAttribute('data-quickdrop-delete-relay') || groupedDeleteButton.getAttribute('data-quickdrop-delete-direct'))) {
                deleteQuickDropTransferGroup(
                    groupedDeleteButton.getAttribute('data-quickdrop-delete-relay'),
                    groupedDeleteButton.getAttribute('data-quickdrop-delete-direct')
                );
                return;
            }

            const directDeleteButton = event.target.closest('[data-quickdrop-direct-delete]');
            if (directDeleteButton && window.QuickDropDirectTransfer?.deleteTransfer) {
                QuickDropDirectTransfer.deleteTransfer(directDeleteButton.getAttribute('data-quickdrop-direct-delete'));
            }
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            syncQuickDrop(true);
        }
    });

    document.addEventListener('quickshare:languagechange', () => {
        renderQuickDropPage();
    });

    window.addEventListener('hashchange', () => {
        applyQuickDropSubpageFromLocation();
    });

    window.addEventListener('popstate', () => {
        applyQuickDropSubpageFromLocation();
    });

    document.addEventListener('quickdrop:direct-statechange', () => {
        renderQuickDropActiveUpload();
        renderQuickDropDisclosure();
    });

    document.addEventListener('quickdrop:direct-transfer-storechange', () => {
        refreshQuickDropDirectTransfers();
        syncQuickDrop(true);
    });
}

async function initQuickDropPage() {
    bindQuickDropEvents();
    setQuickDropAccountMode(typeof isLoggedIn === 'function' && isLoggedIn());
    quickDropState.currentMode = quickDropState.accountMode ? 'account' : 'temporary';
    quickDropState.currentSubpage = getQuickDropSubpageFromLocation();

    if (quickDropState.accountMode) {
        try {
            quickDropState.profile = window.QuickShareSession && typeof window.QuickShareSession.fetchProfile === 'function'
                ? await window.QuickShareSession.fetchProfile()
                : getStoredAuthUser();
        } catch (error) {
            quickDropState.profile = getStoredAuthUser();
        }

        const nameInput = document.getElementById('quickDropDeviceName');
        if (nameInput) {
            nameInput.value = getStoredQuickDropDeviceName();
        }

        await syncQuickDrop();

        if (quickDropState.syncTimer) {
            clearInterval(quickDropState.syncTimer);
        }
        quickDropState.syncTimer = window.setInterval(() => {
            syncQuickDrop(true);
        }, QUICKDROP_SYNC_INTERVAL_MS);
        return;
    }

    renderQuickDropPage();
}

window.syncQuickDrop = syncQuickDrop;
window.saveQuickDropDeviceName = saveQuickDropDeviceName;
window.toggleQuickDropPickerMenu = toggleQuickDropPickerMenu;
window.openQuickDropFilePicker = openQuickDropFilePicker;
window.openQuickDropFolderPicker = openQuickDropFolderPicker;
window.sendQuickDropFile = sendQuickDropFile;
window.showQuickDropTransferDetails = showQuickDropTransferDetails;
window.quickDropState = quickDropState;

document.addEventListener('DOMContentLoaded', initQuickDropPage);
