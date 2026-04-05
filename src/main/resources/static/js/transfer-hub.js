const TRANSFER_DEVICE_ID_KEY = 'transfer-device-id';
const TRANSFER_DEVICE_NAME_KEY = 'transfer-device-name';
const TRANSFER_PENDING_UPLOADS_KEY = 'transfer-pending-uploads';
const TRANSFER_TASK_LINKS_KEY = 'transfer-task-links';
const TRANSFER_SYNC_INTERVAL_MS = 5000;
const TRANSFER_HASH_TEMPORARY_HISTORY = '#temporary-history';
const TRANSFER_HASH_ACCOUNT_HISTORY = '#account-history';
const TRANSFER_ROUTE_VIEW_KEY = 'view';
const TRANSFER_ROUTE_TEMPORARY_HISTORY = 'temporary-history';
const TRANSFER_ROUTE_ACCOUNT_HISTORY = 'account-history';
const TRANSFER_TEXT_PREVIEW_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'yaml', 'yml',
    'properties', 'ini', 'conf', 'sql', 'sh', 'bat', 'java', 'js', 'ts',
    'tsx', 'jsx', 'css', 'html', 'htm'
]);
const TRANSFER_TEXT_PREVIEW_MIME_TYPES = new Set([
    'application/json', 'application/xml', 'application/javascript', 'application/x-javascript',
    'application/yaml', 'application/x-yaml', 'application/sql'
]);
const TRANSFER_OFFICE_PREVIEW_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const TRANSFER_OFFICE_PREVIEW_MIME_TYPES = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
]);

const transferState = {
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
    incomingNoticeCache: new Map(),
    accountMode: false,
    currentMode: 'temporary',
    currentSubpage: 'main',
    directHistoryExpanded: false,
    accountHistoryExpanded: false,
    deviceSettingsExpanded: false,
    pickerMenuExpanded: false
};

function transferText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function normalizeTransferPreviewExtension(fileName) {
    const rawName = String(fileName || '').trim().toLowerCase();
    const dotIndex = rawName.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === rawName.length - 1) {
        return '';
    }
    return rawName.slice(dotIndex + 1);
}

function normalizeTransferPreviewContentType(contentType) {
    const value = String(contentType || '').trim().toLowerCase();
    if (!value) {
        return '';
    }
    const semicolonIndex = value.indexOf(';');
    return semicolonIndex >= 0 ? value.slice(0, semicolonIndex).trim() : value;
}

function getTransferPreviewKind(fileName, contentType) {
    const extension = normalizeTransferPreviewExtension(fileName);
    const normalizedContentType = normalizeTransferPreviewContentType(contentType);

    if (normalizedContentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
        return 'image';
    }
    if (normalizedContentType.startsWith('video/')) {
        return 'video';
    }
    if (normalizedContentType.startsWith('audio/')) {
        return 'audio';
    }
    if (normalizedContentType === 'application/pdf' || extension === 'pdf') {
        return 'pdf';
    }
    if (normalizedContentType.startsWith('text/') || TRANSFER_TEXT_PREVIEW_MIME_TYPES.has(normalizedContentType) || TRANSFER_TEXT_PREVIEW_EXTENSIONS.has(extension)) {
        return 'text';
    }
    if (TRANSFER_OFFICE_PREVIEW_MIME_TYPES.has(normalizedContentType) || TRANSFER_OFFICE_PREVIEW_EXTENSIONS.has(extension)) {
        return 'office';
    }
    return null;
}

function transferRequest(path, options = {}) {
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
            throw new Error(result?.message || 'Transfer request failed');
        }
        return result.data;
    });
}

function getTransferDeviceId() {
    let deviceId = localStorage.getItem(TRANSFER_DEVICE_ID_KEY);
    if (deviceId) {
        return deviceId;
    }

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        deviceId = window.crypto.randomUUID();
    } else {
        deviceId = `qd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    localStorage.setItem(TRANSFER_DEVICE_ID_KEY, deviceId);
    return deviceId;
}

function detectTransferDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/android/i.test(ua)) return 'Android';
    if (/macintosh|mac os x/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Browser';
}

function defaultTransferDeviceName() {
    const profile = transferState.profile;
    const owner = profile?.nickname || profile?.username || 'QuickShare';
    return `${owner} · ${detectTransferDeviceType()}`;
}

function getTransferFileDisplayName(file) {
    return file?.webkitRelativePath || file?.name || '';
}

function normalizeTransferBatchFileName(file) {
    const displayName = getTransferFileDisplayName(file);
    const normalized = String(displayName || file?.name || '')
        .replace(/[\\/]+/g, '__')
        .trim();
    return normalized || `transfer-${Date.now()}`;
}

function buildTransferSelectionItem(file) {
    const displayName = getTransferFileDisplayName(file) || file.name || 'transfer-file';
    const normalizedName = normalizeTransferBatchFileName(file);
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

function setTransferSelectedFiles(files) {
    const items = Array.from(files || [])
        .filter(item => item instanceof File)
        .map(buildTransferSelectionItem);
    transferState.selectedFiles = items;
    transferState.selectedFile = items[0]?.file || null;
}

function clearTransferSelectedFile() {
    transferState.selectedFiles = [];
    transferState.selectedFile = null;
    closeTransferPickerMenu();
    const fileInput = document.getElementById('transferFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    const folderInput = document.getElementById('transferFolderInput');
    if (folderInput) {
        folderInput.value = '';
    }
}

function setTransferAccountMode(enabled) {
    transferState.accountMode = Boolean(enabled);
    const accountPanels = document.getElementById('transferAccountPanels');
    const accountModeBtn = document.getElementById('transferAccountModeBtn');
    if (accountPanels) {
        accountPanels.classList.toggle('hidden', !transferState.accountMode);
    }
    if (accountModeBtn) {
        accountModeBtn.classList.toggle('hidden', !transferState.accountMode);
    }
    if (!transferState.accountMode) {
        transferState.incomingNoticeCache.clear();
        transferState.deviceSettingsExpanded = false;
        transferState.pickerMenuExpanded = false;
        transferState.currentSubpage = 'main';
        setTransferMode('temporary');
    }
}

function setTransferMode(mode) {
    const normalizedMode = mode === 'account' && transferState.accountMode ? 'account' : 'temporary';
    transferState.currentMode = normalizedMode;
    transferState.pickerMenuExpanded = false;

    const temporaryIds = ['transferTemporaryTransferCard'];
    const accountIds = ['transferAccountPanels'];
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

    const temporaryBtn = document.getElementById('transferTemporaryModeBtn');
    const accountBtn = document.getElementById('transferAccountModeBtn');
    if (temporaryBtn) {
        temporaryBtn.classList.toggle('active', normalizedMode === 'temporary');
    }
    if (accountBtn) {
        accountBtn.classList.toggle('active', normalizedMode === 'account');
        accountBtn.disabled = !transferState.accountMode;
    }
}

function renderTransferSubpage() {
    const hero = document.getElementById('transferHeroSection');
    const mainLayout = document.getElementById('transferMainLayout');
    const historyPage = document.getElementById('transferHistoryPage');
    const historyPageTitle = document.getElementById('transferHistoryPageTitle');
    const showingHistory = transferState.currentSubpage !== 'main';

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
        historyPageTitle.textContent = transferState.currentSubpage === 'temporaryHistory'
            ? transferText('transferDirectInboxTitle', 'Transfer History')
            : transferText('transferActivityTitle', 'History');
    }
}

function getTransferHistoryRouteValue(target) {
    if (target === 'temporaryHistory') {
        return TRANSFER_ROUTE_TEMPORARY_HISTORY;
    }
    if (target === 'accountHistory') {
        return TRANSFER_ROUTE_ACCOUNT_HISTORY;
    }
    return '';
}

function getTransferSubpageFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const routeView = params.get(TRANSFER_ROUTE_VIEW_KEY) || '';
    if (routeView === TRANSFER_ROUTE_TEMPORARY_HISTORY) {
        return 'temporaryHistory';
    }
    if (routeView === TRANSFER_ROUTE_ACCOUNT_HISTORY && transferState.accountMode) {
        return 'accountHistory';
    }
    const currentHash = window.location.hash || '';
    if (currentHash === TRANSFER_HASH_TEMPORARY_HISTORY) {
        return 'temporaryHistory';
    }
    if (currentHash === TRANSFER_HASH_ACCOUNT_HISTORY && transferState.accountMode) {
        return 'accountHistory';
    }
    return 'main';
}

function buildTransferHistoryUrl(target) {
    const url = new URL(window.location.href);
    const routeValue = getTransferHistoryRouteValue(target);
    if (routeValue) {
        url.searchParams.set(TRANSFER_ROUTE_VIEW_KEY, routeValue);
    } else {
        url.searchParams.delete(TRANSFER_ROUTE_VIEW_KEY);
    }
    url.hash = '';
    return `${url.pathname}${url.search}`;
}

function syncTransferHistoryLocation(target, options = {}) {
    const desiredUrl = buildTransferHistoryUrl(target);
    const replace = Boolean(options.replace);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === desiredUrl) {
        applyTransferSubpageFromLocation();
        return;
    }
    if (replace) {
        window.history.replaceState(null, '', desiredUrl);
        applyTransferSubpageFromLocation();
        return;
    }
    window.history.pushState(null, '', desiredUrl);
    applyTransferSubpageFromLocation();
}

function applyTransferSubpageFromLocation() {
    const nextSubpage = getTransferSubpageFromLocation();
    const expectedUrl = buildTransferHistoryUrl(nextSubpage);
    if (`${window.location.pathname}${window.location.search}` !== expectedUrl || window.location.hash) {
        syncTransferHistoryLocation(nextSubpage, { replace: true });
        return;
    }
    transferState.currentSubpage = nextSubpage;
    transferState.directHistoryExpanded = nextSubpage === 'temporaryHistory';
    transferState.accountHistoryExpanded = nextSubpage === 'accountHistory';
    renderTransferSubpage();
    renderTransferDisclosure();
}

function renderTransferDisclosure() {
    const signalStatus = document.getElementById('transferSignalStatus');
    const temporaryStatusRow = document.getElementById('transferTemporaryStatusRow');
    const pairingMeta = document.getElementById('transferPairingMeta');
    const directHistoryPanel = document.getElementById('transferDirectHistoryPanel');
    const directHistoryToggle = document.getElementById('transferDirectHistoryToggle');
    const accountHistoryPanel = document.getElementById('transferAccountHistoryPanel');
    const accountHistoryToggle = document.getElementById('transferAccountHistoryToggle');
    const deviceSettingsPanel = document.getElementById('transferDeviceSettingsPanel');
    const deviceSettingsToggle = document.getElementById('transferDeviceSettingsToggle');
    const showTemporaryStatus = transferState.currentMode === 'temporary'
        && !!(window.TransferSignalManager?.getState?.().pairSessionId || window.TransferSignalManager?.isDirectReady?.());
    const subpageMode = transferState.currentSubpage === 'temporaryHistory'
        ? 'temporary'
        : transferState.currentSubpage === 'accountHistory'
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
        directHistoryToggle.querySelector('span').textContent = transferState.currentSubpage === 'temporaryHistory'
            ? transferText('transferHideTemporaryHistory', '收起互传记录')
            : transferText('transferShowTemporaryHistory', '查看互传记录');
    }
    if (accountHistoryPanel) {
        accountHistoryPanel.classList.toggle('hidden', subpageMode !== 'account');
    }
    if (accountHistoryToggle) {
        accountHistoryToggle.querySelector('span').textContent = transferState.currentSubpage === 'accountHistory'
            ? transferText('transferHideAccountHistory', '收起收发记录')
            : transferText('transferShowAccountHistory', '查看收发记录');
    }
    if (deviceSettingsPanel) {
        deviceSettingsPanel.classList.toggle('hidden', !transferState.deviceSettingsExpanded);
    }
    if (deviceSettingsToggle) {
        deviceSettingsToggle.querySelector('span').textContent = transferState.deviceSettingsExpanded
            ? transferText('transferHideDeviceSettings', '收起设备名')
            : transferText('transferShowDeviceSettings', '改设备名');
    }
}

function renderTransferPickerMenu() {
    const pickerMenu = document.getElementById('transferPickerMenu');
    if (!pickerMenu) {
        return;
    }
    pickerMenu.classList.toggle('hidden', !transferState.pickerMenuExpanded);
}

function toggleTransferPickerMenu() {
    if (!transferState.selectedReceiverDeviceId) {
        showToast(transferText('transferChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    transferState.pickerMenuExpanded = !transferState.pickerMenuExpanded;
    renderTransferPickerMenu();
}

function closeTransferPickerMenu() {
    if (!transferState.pickerMenuExpanded) {
        return;
    }
    transferState.pickerMenuExpanded = false;
    renderTransferPickerMenu();
}

function closeTransferHistoryDrawer() {
    syncTransferHistoryLocation('main');
}

function openTransferHistoryPage(target) {
    const normalizedTarget = target === 'temporaryHistory' ? 'temporaryHistory' : 'accountHistory';
    if (normalizedTarget === 'accountHistory' && !transferState.accountMode) {
        return;
    }
    syncTransferHistoryLocation(normalizedTarget);
}

function getStoredTransferDeviceName() {
    return localStorage.getItem(TRANSFER_DEVICE_NAME_KEY) || defaultTransferDeviceName();
}

function setStoredTransferDeviceName(name) {
    localStorage.setItem(TRANSFER_DEVICE_NAME_KEY, name);
}

function loadTransferPendingUploads() {
    try {
        return JSON.parse(localStorage.getItem(TRANSFER_PENDING_UPLOADS_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function saveTransferPendingUploads(data) {
    localStorage.setItem(TRANSFER_PENDING_UPLOADS_KEY, JSON.stringify(data));
}

function buildTransferPendingKey(file, receiverDeviceId) {
    return [
        receiverDeviceId,
        file.name,
        file.size,
        file.lastModified
    ].join('|');
}

function loadTransferTaskLinks() {
    try {
        const parsed = JSON.parse(localStorage.getItem(TRANSFER_TASK_LINKS_KEY) || '{}');
        return {
            relayByTransferId: parsed?.relayByTransferId && typeof parsed.relayByTransferId === 'object'
                ? parsed.relayByTransferId
                : {}
        };
    } catch (error) {
        return { relayByTransferId: {} };
    }
}

function saveTransferTaskLinks(data) {
    localStorage.setItem(TRANSFER_TASK_LINKS_KEY, JSON.stringify({
        relayByTransferId: data?.relayByTransferId || {}
    }));
}

function buildTransferTaskKey(file, peerDeviceId, direction = 'outgoing') {
    return [
        direction,
        peerDeviceId || '-',
        file?.name || '',
        Number(file?.size || 0),
        Number(file?.lastModified || 0)
    ].join('|');
}

function setTransferRelayTaskKey(transferId, taskKey) {
    if (!transferId || !taskKey) {
        return;
    }
    const links = loadTransferTaskLinks();
    links.relayByTransferId[String(transferId)] = taskKey;
    saveTransferTaskLinks(links);
}

function getTransferRelayTaskKey(transferId) {
    const links = loadTransferTaskLinks();
    return links.relayByTransferId[String(transferId)] || '';
}

function removeTransferRelayTaskKey(transferId) {
    if (!transferId) {
        return;
    }
    const links = loadTransferTaskLinks();
    delete links.relayByTransferId[String(transferId)];
    saveTransferTaskLinks(links);
}

function formatTransferStatus(status) {
    switch (status) {
        case 'waiting_accept':
            return transferText('transferDirectWaitingAccept', 'Waiting for peer resume map');
        case 'negotiating':
            return transferText('transferLifecycleNegotiating', 'Negotiating');
        case 'pending_upload':
            return transferText('transferStatusPending', 'Pending Upload');
        case 'uploading':
            return transferText('transferStatusUploading', 'Uploading');
        case 'sending':
            return transferText('transferDirectSending', 'Sending directly');
        case 'waiting_complete':
            return transferText('transferDirectWaitingComplete', 'Waiting for peer to finish storage');
        case 'receiving':
            return transferText('transferDirectReceiving', 'Receiving');
        case 'relay_fallback':
            return transferText('transferDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay');
        case 'ready':
            return transferText('transferStatusReady', 'Ready to Download');
        case 'completed':
            return transferText('transferStatusCompleted', 'Completed');
        case 'failed':
            return transferText('transferLifecycleFailed', 'Failed');
        case 'cancelled':
            return transferText('transferStatusCancelled', 'Cancelled');
        default:
            return status || '-';
    }
}

function formatTransferTime(value) {
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

function formatTransferSize(bytes) {
    return typeof formatFileSize === 'function' ? formatFileSize(bytes || 0) : `${bytes || 0} B`;
}

function getTransferDeviceName(deviceId) {
    const target = transferState.devices.find(item => item.deviceId === deviceId);
    return target?.deviceName || deviceId;
}

function getTransferDeviceIcon(deviceType) {
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

function transferTransferModeLabel(mode) {
    if (mode === 'hybrid') {
        return transferText('transferTransferModeHybrid', 'Direct -> Relay');
    }
    return mode === 'direct'
        ? transferText('transferTransferModeDirect', 'Direct')
        : transferText('transferTransferModeRelay', 'Relay');
}

function deriveTransferAttemptStatus(stage) {
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

function formatTransferAttemptStatus(status) {
    switch (status) {
        case 'waiting':
            return transferText('transferLifecycleWaiting', 'Waiting');
        case 'negotiating':
            return transferText('transferLifecycleNegotiating', 'Negotiating');
        case 'transferring':
            return transferText('transferLifecycleTransferring', 'Transferring');
        case 'relay_fallback':
            return transferText('transferLifecycleFallback', 'Relay Fallback');
        case 'failed':
            return transferText('transferLifecycleFailed', 'Failed');
        case 'completed':
            return transferText('transferLifecycleCompleted', 'Completed');
        case 'cancelled':
            return transferText('transferLifecycleCancelled', 'Cancelled');
        default:
            return formatTransferStatus(status);
    }
}

function formatTransferLifecycleReason(reason) {
    switch (reason) {
        case 'relay_transfer_created':
            return transferText('transferReasonRelayTransferCreated', 'Server relay transfer started');
        case 'same_account_direct':
            return transferText('transferReasonSameAccountDirect', 'Same-account direct session');
        case 'pair_session_direct':
            return transferText('transferReasonPairSessionDirect', 'Paired direct session');
        case 'saved_to_netdisk':
            return transferText('transferReasonSavedToNetdisk', 'Saved to netdisk');
        case 'downloaded':
            return transferText('transferReasonDownloaded', 'Downloaded');
        case 'peer_confirmed':
            return transferText('transferReasonPeerConfirmed', 'Peer confirmed completion');
        case 'relay_fallback':
            return transferText('transferReasonRelayFallback', 'Switched to server relay');
        case 'cancelled':
            return transferText('transferReasonCancelled', 'Cancelled');
        case 'direct_link_unavailable':
            return transferText('transferReasonDirectLinkUnavailable', 'Direct link was not ready');
        case 'direct_ready_timeout':
            return transferText('transferReasonDirectReadyTimeout', 'Direct readiness timed out and fell back to relay');
        case 'ice_connection_failed':
            return transferText('transferReasonIceConnectionFailed', 'ICE connection failed');
        case 'no_relay_candidate':
            return transferText('transferReasonNoRelayCandidate', 'No usable TURN relay candidate was gathered');
        case 'signaling_unavailable':
            return transferText('transferReasonSignalingUnavailable', 'Signaling is currently unavailable');
        case 'peer_mismatch':
            return transferText('transferReasonPeerMismatch', 'Direct link pointed to another device');
        case 'accept_timeout':
            return transferText('transferReasonAcceptTimeout', 'Peer did not respond in time');
        case 'peer_missed_offer':
            return transferText('transferReasonPeerMissedOffer', 'Peer missed the transfer offer');
        case 'peer_reported_error':
            return transferText('transferReasonPeerReportedError', 'Peer reported an error');
        case 'direct_transfer_interrupted':
            return transferText('transferReasonDirectTransferInterrupted', 'Direct transfer was interrupted');
        case 'direct_transfer_failed':
            return transferText('transferReasonDirectTransferFailed', 'Direct transfer failed');
        default:
            return reason ? String(reason).replace(/_/g, ' ') : transferText('transferNotYet', 'Not yet');
    }
}

function formatTransferCandidateCounts(counts) {
    const target = counts || {};
    return ['host', 'srflx', 'relay', 'prflx']
        .map(key => `${key}:${Number(target[key] || 0)}`)
        .join(', ');
}

function buildTransferDirectDiagnosticsLines() {
    const signalState = transferSignalState();
    const diagnostics = signalState.directDiagnostics || {};
    if (!signalState.directState && !diagnostics.connectionState && !diagnostics.selectedCandidatePair) {
        return [];
    }
    const lines = [
        `${transferText('transferDirectSignalStateLabel', 'Direct State')}: ${signalState.directState || transferText('transferNotYet', 'Not yet')}`,
        `${transferText('transferDirectIceStateLabel', 'ICE State')}: ${diagnostics.iceConnectionState || diagnostics.connectionState || transferText('transferNotYet', 'Not yet')}`,
        `${transferText('transferDirectCandidateStatsLabel', 'Candidate Stats')}: local(${formatTransferCandidateCounts(diagnostics.localCandidateTypes)}) / remote(${formatTransferCandidateCounts(diagnostics.remoteCandidateTypes)})`
    ];
    if (diagnostics.selectedCandidatePair) {
        const pair = diagnostics.selectedCandidatePair;
        lines.push(`${transferText('transferDirectSelectedPairLabel', 'Selected Candidate Pair')}: ${pair.localCandidateType || '-'} -> ${pair.remoteCandidateType || '-'} (${pair.localProtocol || pair.remoteProtocol || '-'})`);
    }
    if (diagnostics.lastReadyAt) {
        lines.push(`${transferText('transferDirectLastReadyLabel', 'Last Direct Ready')}: ${formatTransferTime(diagnostics.lastReadyAt)}`);
    }
    return lines;
}

function getLatestTransferAttemptTime(attempts, field, lifecycleStatus) {
    return [...(attempts || [])]
        .map(attempt => {
            if (attempt?.[field]) {
                return attempt[field];
            }
            if (lifecycleStatus && (attempt?.attemptStatus || deriveTransferAttemptStatus(attempt?.stage || '')) === lifecycleStatus) {
                return attempt?.updateTime || '';
            }
            return '';
        })
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || '';
}

function normalizeTransferTaskAttempt(attempt, fallback = {}) {
    const stage = attempt?.stage || fallback.stage || '';
    return {
        transferMode: attempt?.transferMode || fallback.transferMode || 'relay',
        transferId: attempt?.transferId != null ? String(attempt.transferId) : (fallback.transferId || ''),
        stage,
        attemptStatus: attempt?.attemptStatus || fallback.attemptStatus || deriveTransferAttemptStatus(stage),
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

function buildTransferAttemptSummary(attempts, fallback = {}) {
    const normalizedAttempts = [...(attempts || [])]
        .filter(Boolean)
        .sort((left, right) => new Date(right?.updateTime || 0).getTime() - new Date(left?.updateTime || 0).getTime());
    const current = normalizedAttempts[0] || {};
    return {
        attemptStatus: current.attemptStatus || fallback.attemptStatus || deriveTransferAttemptStatus(current.stage || fallback.stage || ''),
        startReason: current.startReason || fallback.startReason || '',
        endReason: current.endReason || fallback.endReason || '',
        failureReason: current.failureReason
            || normalizedAttempts.find(attempt => attempt.failureReason)?.failureReason
            || fallback.failureReason
            || '',
        startTime: current.startTime || fallback.startTime || current.updateTime || fallback.updateTime || '',
        completedAt: fallback.completedAt || getLatestTransferAttemptTime(normalizedAttempts, 'completedAt', 'completed'),
        failedAt: fallback.failedAt || getLatestTransferAttemptTime(normalizedAttempts, 'failedAt', 'failed'),
        fallbackAt: fallback.fallbackAt || getLatestTransferAttemptTime(normalizedAttempts, 'fallbackAt', 'relay_fallback'),
        savedToNetdiskAt: fallback.savedToNetdiskAt || getLatestTransferAttemptTime(normalizedAttempts, 'savedToNetdiskAt'),
        downloadedAt: fallback.downloadedAt || getLatestTransferAttemptTime(normalizedAttempts, 'downloadedAt')
    };
}

function getTransferTransferCompletedChunks(transfer, directionHint) {
    const direction = transfer?.direction || directionHint || 'outgoing';
    if (transfer?.transferMode === 'direct') {
        return direction === 'incoming'
            ? Number(transfer.receivedChunks || 0)
            : Number(transfer.acknowledgedChunks || transfer.sentChunks || 0);
    }
    return Number(transfer?.uploadedChunks || 0);
}

function buildTransferTaskAttemptFromTransfer(transfer, directionHint) {
    const direction = transfer?.direction || directionHint || 'outgoing';
    const transferMode = transfer?.transferMode || 'relay';
    return normalizeTransferTaskAttempt({
        transferMode,
        transferId: transfer?.id != null ? String(transfer.id) : '',
        stage: transfer?.status || '',
        attemptStatus: transfer?.attemptStatus || '',
        startReason: transfer?.startReason || (transferMode === 'direct' ? 'same_account_direct' : 'relay_transfer_created'),
        endReason: transfer?.endReason || '',
        failureReason: transfer?.failureReason || '',
        completedChunks: getTransferTransferCompletedChunks(transfer, direction),
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

function buildTransferTaskFromTransfer(transfer, directionHint) {
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
        || getTransferDeviceName(peerDeviceId)
        || peerDeviceId
        || '-';
    const completedChunks = Number(baseTask.completedChunks ?? getTransferTransferCompletedChunks({
        ...transfer,
        direction,
        transferMode
    }, direction));
    const totalChunks = Number(baseTask.totalChunks ?? transfer?.totalChunks ?? 0);
    const attempts = Array.isArray(baseTask.attempts) && baseTask.attempts.length
        ? baseTask.attempts
            .map(attempt => normalizeTransferTaskAttempt(attempt, {
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
        : [buildTransferTaskAttemptFromTransfer({
            ...transfer,
            direction,
            transferMode
        }, direction)];
    const attemptSummary = buildTransferAttemptSummary(attempts, {
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

function getTransferLatestTaskAttemptId(task, transferMode) {
    return (task?.attempts || [])
        .filter(attempt => attempt.transferMode === transferMode && attempt.transferId)
        .sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0]?.transferId || '';
}

function normalizeTransferServerTaskItem(task, direction) {
    const normalizedTask = buildTransferTaskFromTransfer({
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
        relayTransferId: getTransferLatestTaskAttemptId(normalizedTask, 'relay'),
        directTransferId: getTransferLatestTaskAttemptId(normalizedTask, 'direct'),
        task: normalizedTask
    };
}

function normalizeTransferTransferItem(transfer, direction, defaultMode) {
    const normalized = {
        ...transfer,
        direction: transfer?.direction || direction,
        transferMode: transfer?.transferMode || defaultMode,
        taskKey: transfer?.taskKey
            || transfer?.task?.taskKey
            || (defaultMode === 'relay' ? getTransferRelayTaskKey(transfer?.id) : '')
    };
    normalized.task = buildTransferTaskFromTransfer(normalized, direction);
    return normalized;
}

function getSelectedTransferDevice() {
    return transferState.devices.find(item => item.deviceId === transferState.selectedReceiverDeviceId) || null;
}

function renderTransferTargetStage() {
    const selected = document.getElementById('transferSelectedDevice');
    const selectedMeta = document.getElementById('transferSelectedDeviceMeta');
    const sendLabel = document.getElementById('transferSendBtnLabel');
    const targetChip = document.querySelector('.device-target-chip');
    const selectedDevice = getSelectedTransferDevice();

    if (selected) {
        selected.textContent = selectedDevice ? selectedDevice.deviceName : '-';
    }

    if (selectedMeta) {
        selectedMeta.textContent = selectedDevice
            ? `${selectedDevice.online ? transferText('transferOnline', 'Online') : transferText('transferOffline', 'Offline')} · ${selectedDevice.deviceType || detectTransferDeviceType()}`
            : transferText('transferSelectTargetHint', 'Tap a device below');
    }

    if (sendLabel) {
        sendLabel.textContent = selectedDevice
            ? transferText('transferSendNowWithDevice', 'Send to {name}').replace('{name}', selectedDevice.deviceName)
            : transferText('transferSendNow', 'Send now');
    }
    if (targetChip) {
        targetChip.classList.toggle('selected', Boolean(selectedDevice));
    }
}

function transferSignalState() {
    return window.TransferSignalManager && typeof TransferSignalManager.getState === 'function'
        ? TransferSignalManager.getState()
        : {};
}

function transferDirectDiagnostics() {
    return transferSignalState().directDiagnostics || {};
}

function getTransferDirectReadyWaitMs(baseMs) {
    if (window.TransferSignalManager && typeof TransferSignalManager.getRecommendedDirectWaitMs === 'function') {
        return TransferSignalManager.getRecommendedDirectWaitMs(baseMs);
    }
    const diagnostics = transferDirectDiagnostics();
    if (diagnostics.rtcHasTurn) {
        return Math.max(Number(baseMs) || 0, 4500);
    }
    return Number(baseMs) || 0;
}

function waitTransferMs(delayMs) {
    return new Promise(resolve => {
        window.setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
}

function isTransferRetryableDirectRouteError(error) {
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

function resolveTransferDirectFallbackReason(receiverDeviceId) {
    const signalState = transferSignalState();
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

function transferDirectMatchesSelectedDevice() {
    const signalState = transferSignalState();
    return signalState.latestPeerDeviceId
        && signalState.latestPeerDeviceId === transferState.selectedReceiverDeviceId;
}

function summarizeTransferSelectedFiles() {
    const items = transferState.selectedFiles || [];
    if (!items.length) {
        return {
            title: transferText('transferNoFileSelected', 'No file selected'),
            meta: ''
        };
    }
    if (items.length === 1) {
        return {
            title: items[0].label,
            meta: formatTransferSize(items[0].size)
        };
    }
    const totalSize = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
    return {
        title: transferText('transferBatchSelectedSummary', '{count} items selected').replace('{count}', String(items.length)),
        meta: `${formatTransferSize(totalSize)} · ${items.slice(0, 3).map(item => item.label).join(' · ')}${items.length > 3 ? ' ...' : ''}`
    };
}

async function maybeEnsureSelectedDeviceDirectRoute(options = {}) {
    const targetDevice = getSelectedTransferDevice();
    if (!targetDevice || !targetDevice.online) {
        return false;
    }
    if (!window.TransferSignalManager || typeof TransferSignalManager.ensurePairWithDevice !== 'function') {
        return false;
    }

    const now = Date.now();
    const force = Boolean(options.force);
    const canReuseAttempt = !force
        && transferState.directSessionTargetDeviceId === targetDevice.deviceId
        && now - transferState.directSessionLastAttemptAt < 12000;
    if (!canReuseAttempt || !transferDirectMatchesSelectedDevice()) {
        transferState.directSessionTargetDeviceId = targetDevice.deviceId;
        transferState.directSessionLastAttemptAt = now;
        const pairRetryCount = Math.max(0, Number(options.pairRetryCount) || 0);
        const pairRetryDelayMs = Math.max(0, Number(options.pairRetryDelayMs) || 0);
        for (let attemptIndex = 0; attemptIndex <= pairRetryCount; attemptIndex += 1) {
            try {
                await TransferSignalManager.ensurePairWithDevice(targetDevice.deviceId, { force });
                break;
            } catch (error) {
                const retryable = attemptIndex < pairRetryCount
                    && isTransferRetryableDirectRouteError(error);
                if (retryable) {
                    await waitTransferMs(pairRetryDelayMs * (attemptIndex + 1));
                    continue;
                }
                if (!options.silent) {
                    showToast(error.message, 'warning');
                }
                return false;
            }
        }
    }

    if (typeof TransferSignalManager.waitForDirectReady === 'function') {
        const waitMs = getTransferDirectReadyWaitMs(Number(options.waitForReadyMs) || 0);
        if (waitMs > 0) {
            let ready = await TransferSignalManager.waitForDirectReady(targetDevice.deviceId, waitMs);
            if (!ready) {
                const signalState = transferSignalState();
                const settleWaitMs = Number(options.settleWaitMs) || 0;
                const stillNegotiatingSamePeer = signalState.directState === 'negotiating'
                    && signalState.latestPeerDeviceId === targetDevice.deviceId;
                if (stillNegotiatingSamePeer && settleWaitMs > 0) {
                    ready = await TransferSignalManager.waitForDirectReady(targetDevice.deviceId, settleWaitMs);
                }
            }
            if (!ready && options.forceOnUnavailable) {
                const signalState = transferSignalState();
                if (signalState.directState === 'unavailable') {
                    try {
                        await TransferSignalManager.ensurePairWithDevice(targetDevice.deviceId, { force: true });
                    } catch (error) {
                        if (!options.silent) {
                            showToast(error.message, 'warning');
                        }
                        return false;
                    }
                    ready = await TransferSignalManager.waitForDirectReady(targetDevice.deviceId, getTransferDirectReadyWaitMs(waitMs));
                }
            }
            return ready;
        }
    }
    return transferDirectMatchesSelectedDevice()
        && typeof TransferSignalManager.isDirectReady === 'function'
        && TransferSignalManager.isDirectReady();
}

function refreshTransferDirectTransfers() {
    if (!window.TransferDirectTransfer || typeof TransferDirectTransfer.getTransfers !== 'function') {
        transferState.directIncomingTransfers = [];
        transferState.directOutgoingTransfers = [];
        return;
    }
    transferState.directIncomingTransfers = TransferDirectTransfer.getTransfers('incoming') || [];
    transferState.directOutgoingTransfers = TransferDirectTransfer.getTransfers('outgoing') || [];
}

function mergeTransferTransferGroup(items, direction) {
    const relayItems = items.filter(item => item.transferMode === 'relay');
    const directItems = items.filter(item => item.transferMode === 'direct');
    const latestRelay = relayItems.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0] || null;
    const latestDirect = directItems.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime())[0] || null;
    const primary = latestRelay || latestDirect || items[0];
    const latestUpdateTime = items
        .map(item => item.updateTime)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || primary.updateTime;
    const primaryTask = buildTransferTaskFromTransfer(primary, direction);
    const latestRelayTask = latestRelay ? buildTransferTaskFromTransfer(latestRelay, direction) : null;
    const latestDirectTask = latestDirect ? buildTransferTaskFromTransfer(latestDirect, direction) : null;
    const fallbackPeerLabel = primary.transferMode === 'relay'
        ? (direction === 'incoming'
            ? getTransferDeviceName(primary.senderDeviceId)
            : getTransferDeviceName(primary.receiverDeviceId))
        : primary.peerLabel;
    const attempts = [];
    const seenAttempts = new Set();
    items.forEach(item => {
        buildTransferTaskFromTransfer(item, direction).attempts.forEach(attempt => {
            const key = `${attempt.transferMode}:${attempt.transferId || attempt.updateTime || attempt.stage || 'attempt'}`;
            if (seenAttempts.has(key)) {
                return;
            }
            seenAttempts.add(key);
            attempts.push(attempt);
        });
    });
    attempts.sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime());
    const attemptSummary = buildTransferAttemptSummary(attempts, primaryTask);
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
        completedChunks: Number(primaryTask.completedChunks ?? getTransferTransferCompletedChunks(primary, direction)),
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

function buildTransferFallbackSignature(transfer, direction) {
    if (direction !== 'outgoing') {
        return '';
    }
    const peerIdentity = transfer.transferMode === 'direct'
        ? (transfer.peerDeviceId || transfer.peerLabel || '')
        : (transfer.receiverDeviceId || getTransferDeviceName(transfer.receiverDeviceId) || '');
    return [
        transfer.fileName || '',
        Number(transfer.fileSize || 0),
        peerIdentity
    ].join('|');
}

function buildTransferDisplayTransfers(direction) {
    const taskSource = direction === 'incoming'
        ? transferState.incomingTasks
        : transferState.outgoingTasks;
    if (Array.isArray(taskSource)) {
        return taskSource
            .map(task => normalizeTransferServerTaskItem(task, direction))
            .sort((left, right) => new Date(right.task?.updateTime || right.updateTime || 0).getTime() - new Date(left.task?.updateTime || left.updateTime || 0).getTime());
    }

    const combined = [
        ...(direction === 'incoming' ? transferState.incomingTransfers : transferState.outgoingTransfers).map(transfer =>
            normalizeTransferTransferItem(transfer, direction, 'relay')
        ),
        ...(direction === 'incoming' ? transferState.directIncomingTransfers : transferState.directOutgoingTransfers).map(transfer =>
            normalizeTransferTransferItem(transfer, direction, 'direct')
        )
    ];

    const directFallbackSignatures = new Set(
        combined
            .filter(transfer => direction === 'outgoing' && transfer.transferMode === 'direct' && transfer.status === 'relay_fallback')
            .map(transfer => buildTransferFallbackSignature(transfer, direction))
            .filter(Boolean)
    );

    const groups = new Map();
    combined.forEach(transfer => {
        const fallbackSignature = buildTransferFallbackSignature(transfer, direction);
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
        .map(items => mergeTransferTransferGroup(items, direction))
        .sort((left, right) => new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime());
}

function updateTransferCurrentDeviceCard() {
    const typeEl = document.getElementById('transferCurrentDeviceType');
    const statusEl = document.getElementById('transferCurrentDeviceStatus');
    const nameInput = document.getElementById('transferDeviceName');
    const nameDisplay = document.getElementById('transferCurrentDeviceNameDisplay');
    const iconWrap = document.getElementById('transferCurrentDeviceIcon');
    const currentType = transferState.currentDevice?.deviceType || detectTransferDeviceType();
    const currentName = transferState.currentDevice?.deviceName || getStoredTransferDeviceName();

    if (typeEl) {
        typeEl.textContent = currentType;
    }

    if (statusEl) {
        const online = transferState.currentDevice?.online !== false;
        statusEl.className = `status-pill ${online ? 'online' : 'offline'}`;
        statusEl.innerHTML = `<i class="fa-solid fa-circle"></i><span>${online ? transferText('transferOnline', 'Online') : transferText('transferOffline', 'Offline')}</span>`;
    }

    if (nameDisplay) {
        nameDisplay.textContent = currentName;
    }

    if (iconWrap) {
        iconWrap.innerHTML = `<i class="fa-solid ${getTransferDeviceIcon(currentType)}"></i>`;
    }

    if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = getStoredTransferDeviceName();
    }
}

function renderTransferDevices() {
    const list = document.getElementById('transferDeviceList');
    const empty = document.getElementById('transferDeviceEmpty');
    if (!list || !empty) {
        return;
    }

    const availableDevices = transferState.devices.filter(device => !device.current);
    const hasSelectedDevice = availableDevices.some(device => device.deviceId === transferState.selectedReceiverDeviceId);
    if (!hasSelectedDevice && availableDevices.length > 0) {
        const preferred = availableDevices.find(device => device.online) || availableDevices[0];
        transferState.selectedReceiverDeviceId = preferred.deviceId;
    }

    if (!availableDevices.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        transferState.selectedReceiverDeviceId = '';
        renderTransferTargetStage();
        return;
    }

    empty.classList.add('hidden');
    list.innerHTML = availableDevices.map(device => `
        <article class="device-card ${transferState.selectedReceiverDeviceId === device.deviceId ? 'selected' : ''}" data-transfer-device="${device.deviceId}">
            <span class="device-card-visual">
                <i class="fa-solid ${getTransferDeviceIcon(device.deviceType)}"></i>
            </span>
            <div class="device-card-copy">
                <h3>${device.deviceName}</h3>
                <p class="device-meta">
                    ${device.online ? transferText('transferOnline', 'Online') : transferText('transferOffline', 'Offline')}
                    · ${device.deviceType || detectTransferDeviceType()}
                </p>
            </div>
            <span class="device-card-state">${transferState.selectedReceiverDeviceId === device.deviceId
                ? transferText('transferDeviceSelected', 'Selected')
                : transferText('transferTapToChoose', 'Tap to choose')}</span>
        </article>
    `).join('');

    renderTransferTargetStage();
}

function renderTransferFolderSelect() {
    const select = document.getElementById('transferSaveFolderSelect');
    if (!select) {
        return;
    }

    const options = [
        { id: 0, label: transferText('transferRootFolder', 'Root') },
        ...transferState.folders.map(folder => ({
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

function renderTransferActiveUpload() {
    const wrap = document.getElementById('transferActiveUpload');
    const title = document.getElementById('transferActiveUploadTitle');
    const bar = document.getElementById('transferActiveUploadBar');
    const meta = document.getElementById('transferActiveUploadMeta');
    const sendBtn = document.getElementById('transferSendBtn');
    const selectedFile = document.getElementById('transferSelectedFile');

    if (!wrap || !title || !bar || !meta || !sendBtn || !selectedFile) {
        return;
    }

    renderTransferTargetStage();

    if (transferState.selectedFiles.length) {
        const summary = summarizeTransferSelectedFiles();
        selectedFile.innerHTML = `
            <span>${summary.title}</span>
            <span>${summary.meta || '-'}</span>
        `;
    } else {
        selectedFile.innerHTML = `<span>${transferText('transferNoFileSelected', 'No file selected')}</span>`;
    }

    if (!transferState.activeUpload) {
        wrap.classList.add('hidden');
    } else {
        wrap.classList.remove('hidden');
        title.textContent = transferState.activeUpload.fileName;
        bar.style.width = `${transferState.activeUpload.progress}%`;
        meta.textContent = `${transferState.activeUpload.progress}% · ${transferState.activeUpload.statusText}`;
    }

    sendBtn.disabled = transferState.sending || !transferState.selectedFiles.length || !transferState.selectedReceiverDeviceId;
}

function getTransferIncomingNoticeItems() {
    const items = transferState.displayIncomingTransfers.length
        ? transferState.displayIncomingTransfers
        : buildTransferDisplayTransfers('incoming');
    return items
        .map(transfer => ({
            transfer,
            task: buildTransferTaskFromTransfer(transfer, 'incoming')
        }))
        .filter(item => item.task && !item.task.savedToNetdiskAt);
}

function renderTransferIncomingNotice() {
    const card = document.getElementById('transferIncomingNoticeCard');
    const title = document.getElementById('transferIncomingNoticeTitle');
    const meta = document.getElementById('transferIncomingNoticeMeta');
    const hint = document.getElementById('transferIncomingNoticeHint');
    const status = document.getElementById('transferIncomingNoticeStatus');
    const button = document.getElementById('transferIncomingNoticeOpenBtn');

    if (!card || !title || !meta || !hint || !status || !button) {
        return;
    }

    const items = getTransferIncomingNoticeItems();
    if (!transferState.accountMode || !items.length) {
        card.classList.add('hidden');
        return;
    }

    const primary = items[0].task;
    const primaryStage = primary.stage || '';
    const senderLabel = primary.peerLabel || transferText('transferSender', 'Sender');
    const ready = primaryStage === 'ready' || primaryStage === 'completed';

    card.classList.remove('hidden');
    title.textContent = items.length > 1
        ? transferText('transferIncomingNoticeMany', '{count} files arrived on this device').replace('{count}', String(items.length))
        : transferText('transferIncomingNoticeSingle', 'A file arrived on this device');
    meta.textContent = `${transferText('transferSender', 'Sender')}: ${senderLabel} · ${primary.fileName} · ${formatTransferSize(primary.fileSize)}`;
    hint.textContent = ready
        ? transferText('transferIncomingNoticeReadyHint', 'Open the inbox to download it or save it to netdisk.')
        : transferText('transferIncomingNoticePendingHint', 'The file is still arriving. Open the inbox to watch progress.');
    status.textContent = formatTransferStatus(primaryStage);
    button.innerHTML = `<i class="fa-solid fa-inbox"></i><span>${transferText('transferOpenInbox', 'Open Inbox')}</span>`;
}

function getTransferPreviewSource(transfer, task) {
    const previewKind = getTransferPreviewKind(task?.fileName, task?.contentType);
    if (!previewKind) {
        return null;
    }

    const directTransferId = transfer?.directTransferId || getTransferLatestTaskAttemptId(task, 'direct');
    const relayTransferId = transfer?.relayTransferId || getTransferLatestTaskAttemptId(task, 'relay') || transfer?.id;

    if (task?.transferMode === 'direct' && directTransferId) {
        if (previewKind === 'office') {
            return null;
        }
        return {
            source: 'direct',
            transferId: directTransferId,
            kind: previewKind
        };
    }

    if (task?.transferMode === 'relay' && relayTransferId) {
        return {
            source: 'relay',
            transferId: relayTransferId,
            kind: previewKind
        };
    }

    if (task?.transferMode === 'hybrid') {
        if (relayTransferId) {
            return {
                source: 'relay',
                transferId: relayTransferId,
                kind: previewKind
            };
        }
        if (directTransferId && previewKind !== 'office') {
            return {
                source: 'direct',
                transferId: directTransferId,
                kind: previewKind
            };
        }
    }

    return null;
}

function canTransferPreview(transfer, task) {
    return Boolean(getTransferPreviewSource(transfer, task));
}

function buildRelayTransferPreviewUrl(transferId) {
    return `${API_BASE}/transfer/transfers/${transferId}/preview?deviceId=${encodeURIComponent(getTransferDeviceId())}`;
}

function buildRelayTransferDownloadUrl(transferId) {
    return `${API_BASE}/transfer/transfers/${transferId}/download?deviceId=${encodeURIComponent(getTransferDeviceId())}`;
}

async function openTransferPreviewItem(transfer) {
    const task = buildTransferTaskFromTransfer(transfer, 'incoming');
    const previewSource = getTransferPreviewSource(transfer, task);
    if (!previewSource) {
        throw new Error(transferText('cannotPreview', 'This file type cannot be previewed'));
    }

    if (previewSource.source === 'direct') {
        if (!window.TransferDirectTransfer?.openPreviewWindow) {
            throw new Error(transferText('cannotPreview', 'This file type cannot be previewed'));
        }
        await TransferDirectTransfer.openPreviewWindow(previewSource.transferId);
        return;
    }

    const previewUrl = buildRelayTransferPreviewUrl(previewSource.transferId);
    const downloadUrl = buildRelayTransferDownloadUrl(previewSource.transferId);
    if (previewSource.kind === 'pdf' || previewSource.kind === 'office') {
        const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(previewUrl)}&download=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(task.fileName || 'preview')}&kind=${previewSource.kind === 'office' ? 'office' : 'pdf'}`;
        window.open(viewerUrl, '_blank', 'noopener');
        return;
    }
    window.open(previewUrl, '_blank', 'noopener');
}

function queueTransferIncomingPopup(transfer, task) {
    const ready = task.stage === 'ready' || task.stage === 'completed';
    const canPreview = ready && canTransferPreview(transfer, task);
    const message = [
        `${transferText('transferSender', 'Sender')}: ${task.peerLabel || '-'}`,
        `${transferText('transferTaskFileLabel', 'File')}: ${task.fileName || '-'}`,
        `${transferText('transferTaskSizeLabel', 'Size')}: ${formatTransferSize(task.fileSize)}`,
        `${transferText('transferTaskStatusLabel', 'Status')}: ${formatTransferStatus(task.stage || '')}`
    ].join('\n');

    if (typeof showAppConfirm === 'function') {
        showAppConfirm(message, {
            title: transferText('transferIncomingNoticeSingle', 'A file arrived on this device'),
            icon: 'fa-file-arrow-down',
            confirmText: canPreview
                ? transferText('previewBtn', 'Preview')
                : transferText('transferOpenInbox', 'Open Inbox'),
            cancelText: transferText('transferClose', 'Close')
        }).then(confirmed => {
            if (!confirmed) {
                return;
            }
            if (canPreview) {
                openTransferPreviewItem(transfer).catch(error => showToast(error.message, 'error'));
                return;
            }
            openTransferHistoryPage('accountHistory');
        }).catch(() => {});
        return;
    }

    showToast(
        transferText('transferIncomingToastReady', '{file} is ready on this device')
            .replace('{file}', task.fileName || transferText('transferSelectedFileLabel', 'file')),
        'success'
    );
}

function syncTransferIncomingAlerts() {
    if (!transferState.accountMode) {
        transferState.incomingNoticeCache.clear();
        return;
    }

    const nextCache = new Map();
    const incomingItems = buildTransferDisplayTransfers('incoming')
        .map(transfer => ({
            transfer,
            task: buildTransferTaskFromTransfer(transfer, 'incoming')
        }))
        .filter(item => item.task);

    incomingItems.forEach(item => {
        const task = item.task;
        const key = task.taskKey || `${task.transferMode}:${task.taskId || task.id || task.fileName}`;
        const stage = String(task.stage || '');
        const statusSignature = [
            stage,
            Number(task.completedChunks || 0),
            Number(task.totalChunks || 0),
            task.savedToNetdiskAt ? 'saved' : ''
        ].join('|');
        const previous = transferState.incomingNoticeCache.get(key);
        nextCache.set(key, statusSignature);

        const readyNow = stage === 'ready' || stage === 'completed';
        const readyBefore = previous ? previous.startsWith('ready|') || previous.startsWith('completed|') : false;
        if (!previous) {
            if (readyNow) {
                queueTransferIncomingPopup(item.transfer, task);
            } else {
                showToast(
                    transferText('transferIncomingToastArrived', '{name} sent {file} to this device')
                        .replace('{name}', task.peerLabel || transferText('transferSender', 'Sender'))
                        .replace('{file}', task.fileName || transferText('transferSelectedFileLabel', 'file')),
                    'success'
                );
            }
            return;
        }
        if (readyNow && !readyBefore) {
            showToast(
                transferText('transferIncomingToastReady', '{file} is ready on this device')
                    .replace('{file}', task.fileName || transferText('transferSelectedFileLabel', 'file')),
                'success'
            );
            queueTransferIncomingPopup(item.transfer, task);
        }
    });

    transferState.incomingNoticeCache = nextCache;
}

function renderTransferTransfers() {
    transferState.displayIncomingTransfers = buildTransferDisplayTransfers('incoming');
    transferState.displayOutgoingTransfers = buildTransferDisplayTransfers('outgoing');
    renderTransferTransferList(
        transferState.displayIncomingTransfers,
        document.getElementById('transferIncomingList'),
        document.getElementById('transferIncomingEmpty'),
        'incoming'
    );
    renderTransferTransferList(
        transferState.displayOutgoingTransfers,
        document.getElementById('transferOutgoingList'),
        document.getElementById('transferOutgoingEmpty'),
        'outgoing'
    );
}

function renderTransferTransferList(transfers, container, empty, direction) {
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
        const task = buildTransferTaskFromTransfer(transfer, direction);
        const isDirect = task.transferMode === 'direct';
        const isHybrid = task.transferMode === 'hybrid';
        const relayAttemptId = transfer.relayTransferId || getTransferLatestTaskAttemptId(task, 'relay');
        const directAttemptId = transfer.directTransferId || getTransferLatestTaskAttemptId(task, 'direct');
        const chunkProgress = Number(task.completedChunks || 0);
        const progress = task.totalChunks > 0
            ? Math.round((chunkProgress / task.totalChunks) * 100)
            : 0;
        const peerName = task.peerLabel || transferText('transferDirectPeerFallback', 'Paired device');
        const peerLabel = direction === 'incoming'
            ? `${transferText('transferSender', 'Sender')}: ${peerName}`
            : `${transferText('transferReceiver', 'Receiver')}: ${peerName}`;

        const readyForDownload = task.stage === 'ready' || task.stage === 'completed';
        const previewAction = direction === 'incoming' && readyForDownload && canTransferPreview(transfer, task)
            ? `<button class="btn btn-secondary" type="button" data-transfer-preview="${direction}:${index}">
                    <i class="fa-solid fa-eye"></i>
                    <span>${transferText('previewBtn', 'Preview')}</span>
               </button>`
            : '';
        const primaryAction = readyForDownload
            ? `<button class="btn btn-primary" type="button" ${
                isDirect
                    ? `data-transfer-direct-download="${directAttemptId || ''}"`
                    : isHybrid && relayAttemptId
                        ? `data-transfer-download="${relayAttemptId}"`
                        : isHybrid && directAttemptId
                            ? `data-transfer-direct-download="${directAttemptId}"`
                            : `data-transfer-download="${transfer.id}"`
            }>
                    <i class="fa-solid fa-download"></i>
                    <span>${transferText('transferDownload', 'Download')}</span>
               </button>`
            : '';

        const saveAction = direction === 'incoming' && readyForDownload
            ? task.savedToNetdiskAt
                ? `<span class="btn btn-secondary" style="opacity:0.7;cursor:default;">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>${transferText('transferSavedBadge', 'Saved to Netdisk')}</span>
                   </span>
                   <a class="btn btn-secondary" href="netdisk.html">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>${transferText('transferViewInNetdisk', 'View in Netdisk')}</span>
                   </a>`
                : `<button class="btn btn-secondary" type="button" ${
                    isDirect
                        ? `data-transfer-direct-save="${directAttemptId || ''}"`
                        : isHybrid && relayAttemptId
                            ? `data-transfer-save="${relayAttemptId}"`
                            : isHybrid && directAttemptId
                                ? `data-transfer-direct-save="${directAttemptId}"`
                                : `data-transfer-save="${transfer.id}"`
                }>
                        <i class="fa-solid fa-hard-drive"></i>
                        <span>${transferText('transferSaveToNetdisk', 'Save to Netdisk')}</span>
                   </button>`
            : '';

        const deleteAttrs = task.taskId
            ? `data-transfer-task-delete="${direction}:${index}"`
            : isDirect
            ? `data-transfer-direct-delete="${directAttemptId || transfer.id}"`
            : isHybrid
                ? `${relayAttemptId ? `data-transfer-delete-relay="${relayAttemptId}" ` : ''}${directAttemptId ? `data-transfer-delete-direct="${directAttemptId}"` : ''}`.trim()
                : `data-transfer-delete="${transfer.id}"`;

        return `
            <article class="transfer-card">
                <div class="transfer-card-head">
                    <div class="transfer-card-title">
                        <h3>${task.fileName}</h3>
                        <p class="transfer-meta">${formatTransferSize(task.fileSize)} · ${peerLabel} · ${transferTransferModeLabel(task.transferMode)}</p>
                    </div>
                    <span class="device-pill">${formatTransferStatus(task.stage)}</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" style="width:${progress}%"></div>
                </div>
                <p class="transfer-meta">
                    ${transferText('transferChunkProgress', 'Chunks')}: ${chunkProgress} / ${task.totalChunks || 0}
                    · ${transferText('transferUpdatedAt', 'Updated')}: ${formatTransferTime(task.updateTime)}
                </p>
                <div class="actions">
                    ${previewAction}
                    ${primaryAction}
                    ${saveAction}
                    <button class="btn btn-secondary" type="button" data-transfer-detail="${direction}:${index}">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>${transferText('transferTaskDetails', 'Details')}</span>
                    </button>
                    <button class="btn btn-secondary" type="button" ${deleteAttrs}>
                        <i class="fa-solid fa-trash"></i>
                        <span>${transferText('transferDelete', 'Delete')}</span>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function collectTransferTaskAttemptIds(task, transferMode) {
    return Array.from(new Set(
        (task?.attempts || [])
            .filter(attempt => attempt.transferMode === transferMode && attempt.transferId)
            .map(attempt => String(attempt.transferId))
    ));
}

function formatTransferTaskAttemptLine(attempt) {
    const bits = [
        `- ${transferTransferModeLabel(attempt.transferMode)}`,
        formatTransferStatus(attempt.stage),
        `${transferText('transferChunkProgress', 'Chunks')}: ${Number(attempt.completedChunks || 0)} / ${Number(attempt.totalChunks || 0)}`,
        `${transferText('transferLifecycleLabel', 'Lifecycle')}: ${formatTransferAttemptStatus(attempt.attemptStatus || deriveTransferAttemptStatus(attempt.stage || ''))}`
    ];
    const idLabel = attempt.transferMode === 'relay'
        ? transferText('transferRelayTransferIdLabel', 'Relay Transfer ID')
        : transferText('transferDirectTransferIdLabel', 'Direct Transfer ID');
    bits.push(`${idLabel}: ${attempt.transferId || '-'}`);
    if (attempt.startReason) {
        bits.push(`${transferText('transferStartReasonLabel', 'Start Reason')}: ${formatTransferLifecycleReason(attempt.startReason)}`);
    }
    if (attempt.endReason) {
        bits.push(`${transferText('transferEndReasonLabel', 'End Reason')}: ${formatTransferLifecycleReason(attempt.endReason)}`);
    }
    if (attempt.failureReason) {
        bits.push(`${transferText('transferFailureReasonLabel', 'Failure Reason')}: ${formatTransferLifecycleReason(attempt.failureReason)}`);
    }
    if (attempt.startTime) {
        bits.push(`${transferText('transferStartedAtLabel', 'Started')}: ${formatTransferTime(attempt.startTime)}`);
    }
    if (attempt.fallbackAt) {
        bits.push(`${transferText('transferFallbackAtLabel', 'Fallback At')}: ${formatTransferTime(attempt.fallbackAt)}`);
    }
    if (attempt.failedAt) {
        bits.push(`${transferText('transferFailedAtLabel', 'Failed At')}: ${formatTransferTime(attempt.failedAt)}`);
    }
    if (attempt.completedAt) {
        bits.push(`${transferText('transferCompletedAtLabel', 'Completed At')}: ${formatTransferTime(attempt.completedAt)}`);
    }
    bits.push(`${transferText('transferUpdatedAt', 'Updated')}: ${formatTransferTime(attempt.updateTime)}`);
    return bits.join(' · ');
}

function formatTransferTaskCurrentStage(task) {
    const currentMode = task?.currentTransferMode || task?.transferMode || 'relay';
    return `${transferTransferModeLabel(currentMode)} · ${formatTransferStatus(task?.stage || '')}`;
}

function buildTransferTransferDetailValue(transfer, direction) {
    const task = buildTransferTaskFromTransfer(transfer, direction);
    const relayIds = collectTransferTaskAttemptIds(task, 'relay');
    const directIds = collectTransferTaskAttemptIds(task, 'direct');
    const lines = [
        `${transferText('transferTaskKeyLabel', 'Task Key')}: ${task.taskKey || '-'}`,
        `${transferText('transferTaskModeLabel', 'Mode')}: ${transferTransferModeLabel(task.transferMode)}`,
        `${transferText('transferTaskStatusLabel', 'Status')}: ${formatTransferStatus(task.stage)}`,
        `${transferText('transferLifecycleLabel', 'Lifecycle')}: ${formatTransferAttemptStatus(task.attemptStatus || deriveTransferAttemptStatus(task.stage || ''))}`,
        `${transferText('transferTaskCurrentStageLabel', 'Current Step')}: ${formatTransferTaskCurrentStage(task)}`,
        `${transferText('transferTaskDirectionLabel', 'Direction')}: ${task.direction === 'incoming'
            ? transferText('transferIncoming', 'Inbox')
            : transferText('transferOutgoing', 'Outgoing')}`,
        `${transferText('transferTaskFileLabel', 'File')}: ${task.fileName || '-'}`,
        `${transferText('transferTaskSizeLabel', 'Size')}: ${formatTransferSize(task.fileSize)}`,
        `${transferText('transferTaskPeerLabel', 'Peer')}: ${task.peerLabel || '-'}`,
        `${transferText('transferChunkProgress', 'Chunks')}: ${Number(task.completedChunks || 0)} / ${task.totalChunks || 0}`,
        `${transferText('transferStartedAtLabel', 'Started')}: ${task.startTime ? formatTransferTime(task.startTime) : transferText('transferNotYet', 'Not yet')}`,
        `${transferText('transferCompletedAtLabel', 'Completed At')}: ${task.completedAt ? formatTransferTime(task.completedAt) : transferText('transferNotYet', 'Not yet')}`,
        `${transferText('transferSavedAtLabel', 'Saved To Netdisk')}: ${task.savedToNetdiskAt ? formatTransferTime(task.savedToNetdiskAt) : transferText('transferNotYet', 'Not yet')}`,
        `${transferText('transferUpdatedAt', 'Updated')}: ${formatTransferTime(task.updateTime)}`
    ];
    if (task.startReason) {
        lines.push(`${transferText('transferStartReasonLabel', 'Start Reason')}: ${formatTransferLifecycleReason(task.startReason)}`);
    }
    if (task.endReason) {
        lines.push(`${transferText('transferEndReasonLabel', 'End Reason')}: ${formatTransferLifecycleReason(task.endReason)}`);
    }
    if (task.failureReason) {
        lines.push(`${transferText('transferFailureReasonLabel', 'Failure Reason')}: ${formatTransferLifecycleReason(task.failureReason)}`);
    }
    if (task.fallbackAt) {
        lines.push(`${transferText('transferFallbackAtLabel', 'Fallback At')}: ${formatTransferTime(task.fallbackAt)}`);
    }
    if (task.failedAt) {
        lines.push(`${transferText('transferFailedAtLabel', 'Failed At')}: ${formatTransferTime(task.failedAt)}`);
    }

    if (relayIds.length) {
        lines.push(`${transferText('transferRelayTransferIdLabel', 'Relay Transfer ID')}: ${relayIds.join(', ')}`);
    }
    if (directIds.length) {
        lines.push(`${transferText('transferDirectTransferIdLabel', 'Direct Transfer ID')}: ${directIds.join(', ')}`);
    }
    if (task.attempts.length) {
        lines.push(`${transferText('transferTaskAttemptsLabel', 'Attempts')}:`);
        task.attempts.forEach(attempt => lines.push(formatTransferTaskAttemptLine(attempt)));
    }
    lines.push(...buildTransferDirectDiagnosticsLines());

    return lines.join('\n');
}

async function showTransferTransferDetails(direction, index) {
    const transfers = direction === 'incoming'
        ? transferState.displayIncomingTransfers
        : transferState.displayOutgoingTransfers;
    const transfer = transfers[Number(index)];
    if (!transfer) {
        return;
    }

    const message = transferText('transferTaskDetailsHint', 'Task detail snapshot. Use copy if you need to compare ids or keys across devices.');
    const value = buildTransferTransferDetailValue(transfer, direction);

    if (typeof showAppCopyDialog === 'function') {
        await showAppCopyDialog(message, value, {
            title: transferText('transferTaskDetailsTitle', 'Task Details'),
            icon: 'fa-circle-info',
            multiline: true,
            confirmText: transferText('transferClose', 'Close')
        });
        return;
    }

    await showAppAlert(value, {
        title: transferText('transferTaskDetailsTitle', 'Task Details'),
        icon: 'fa-circle-info'
    });
}

async function previewTransferItem(direction, index) {
    const transfers = direction === 'incoming'
        ? transferState.displayIncomingTransfers
        : transferState.displayOutgoingTransfers;
    const transfer = transfers[Number(index)];
    if (!transfer) {
        return;
    }
    await openTransferPreviewItem(transfer);
}

function renderTransferPage() {
    updateTransferCurrentDeviceCard();
    renderTransferDevices();
    renderTransferTargetStage();
    renderTransferPickerMenu();
    renderTransferFolderSelect();
    renderTransferActiveUpload();
    renderTransferTransfers();
    renderTransferIncomingNotice();
    setTransferMode(transferState.currentMode);
    renderTransferSubpage();
    renderTransferDisclosure();
}

async function syncTransfer(silent = false) {
    if (!(typeof isLoggedIn === 'function' && isLoggedIn())) {
        transferState.currentDevice = null;
        transferState.devices = [];
        transferState.folders = [];
        transferState.incomingTasks = null;
        transferState.outgoingTasks = null;
        transferState.incomingTransfers = [];
        transferState.outgoingTransfers = [];
        transferState.selectedReceiverDeviceId = '';
        setTransferAccountMode(false);
        renderTransferPage();
        return;
    }

    try {
        const [data, folders] = await Promise.all([
            transferRequest('/transfer/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: getTransferDeviceId(),
                    deviceName: getStoredTransferDeviceName(),
                    deviceType: detectTransferDeviceType()
                })
            }),
            transferRequest('/folders/all')
        ]);

        transferState.currentDevice = data.currentDevice;
        transferState.devices = data.devices || [];
        transferState.folders = folders || [];
        transferState.incomingTasks = Array.isArray(data.incomingTasks) ? data.incomingTasks : null;
        transferState.outgoingTasks = Array.isArray(data.outgoingTasks) ? data.outgoingTasks : null;
        transferState.incomingTransfers = data.incomingTransfers || [];
        transferState.outgoingTransfers = data.outgoingTransfers || [];
        transferState.recommendedChunkSize = data.recommendedChunkSize || transferState.recommendedChunkSize;
        setTransferAccountMode(true);
        refreshTransferDirectTransfers();
        syncTransferIncomingAlerts();
        transferState.currentSubpage = getTransferSubpageFromLocation();
        renderTransferPage();
        maybeEnsureSelectedDeviceDirectRoute({ silent: true, waitForReadyMs: 1200 }).catch(() => {});
    } catch (error) {
        if (!silent) {
            showToast(error.message, 'error');
        }
    }
}

async function saveTransferDeviceName() {
    const input = document.getElementById('transferDeviceName');
    if (!input) {
        return;
    }

    const value = input.value.trim();
    if (!value) {
        showToast(transferText('transferDeviceNameRequired', 'Device name is required'), 'error');
        return;
    }

    setStoredTransferDeviceName(value);
    await syncTransfer();
    transferState.deviceSettingsExpanded = false;
    renderTransferDisclosure();
    showToast(transferText('transferDeviceNameSaved', 'Device name updated'), 'success');
}

function openTransferFilePicker() {
    if (!transferState.selectedReceiverDeviceId) {
        showToast(transferText('transferChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    closeTransferPickerMenu();

    const input = document.getElementById('transferFileInput');
    if (input) {
        input.click();
    }
}

function openTransferFolderPicker() {
    if (!transferState.selectedReceiverDeviceId) {
        showToast(transferText('transferChooseDeviceFirst', 'Choose a target device first'), 'error');
        return;
    }
    closeTransferPickerMenu();

    const input = document.getElementById('transferFolderInput');
    if (input) {
        input.click();
    }
}

function handleTransferFileChange(event) {
    setTransferSelectedFiles(Array.from(event.target.files || []));
    closeTransferPickerMenu();
    renderTransferActiveUpload();
}

function findTransferTaskByKey(taskKey) {
    if (!taskKey) {
        return null;
    }
    const tasks = [
        ...(Array.isArray(transferState.incomingTasks) ? transferState.incomingTasks : []),
        ...(Array.isArray(transferState.outgoingTasks) ? transferState.outgoingTasks : [])
    ];
    return tasks.find(task => task?.taskKey === taskKey) || null;
}

async function resolveTransferTransferSession(file, receiverDeviceId) {
    let taskKey = arguments.length > 2 ? arguments[2] : '';
    let taskId = arguments.length > 3 ? arguments[3] : null;
    const pendingUploads = loadTransferPendingUploads();
    const pendingKey = buildTransferPendingKey(file, receiverDeviceId);
    const pending = pendingUploads[pendingKey];
    const currentDeviceId = getTransferDeviceId();

    if (pending && pending.transferId) {
        try {
            const session = await transferRequest(`/transfer/transfers/${pending.transferId}?deviceId=${encodeURIComponent(currentDeviceId)}`);
            if (session.fileName === file.name
                && Number(session.fileSize) === Number(file.size)
                && session.receiverDeviceId === receiverDeviceId
                && session.status !== 'ready'
                && session.status !== 'completed') {
                taskId = taskId || session.taskId || pending?.taskId || null;
                if (taskKey || pending?.taskKey) {
                    setTransferRelayTaskKey(session.id, taskKey || pending.taskKey);
                }
                return session;
            }
        } catch (error) {
            delete pendingUploads[pendingKey];
            saveTransferPendingUploads(pendingUploads);
        }
    }

    const created = await transferRequest('/transfer/transfers', {
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
            chunkSize: transferState.recommendedChunkSize
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
    saveTransferPendingUploads(pendingUploads);
    if (taskKey || pending?.taskKey) {
        setTransferRelayTaskKey(created.id, taskKey || pending.taskKey);
    }
    return created;
}

function clearTransferPendingSession(file, receiverDeviceId) {
    const pendingUploads = loadTransferPendingUploads();
    delete pendingUploads[buildTransferPendingKey(file, receiverDeviceId)];
    saveTransferPendingUploads(pendingUploads);
}

async function deleteTransferTransferGroup(relayTransferId, directTransferId) {
    const confirmed = await showAppConfirm(transferText('transferDeleteConfirm', 'Delete this transfer record?'), {
        title: transferText('transferDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: transferText('transferDelete', 'Delete')
    });
    if (!confirmed) {
        return;
    }

    if (relayTransferId) {
        await transferRequest(`/transfer/transfers/${relayTransferId}?deviceId=${encodeURIComponent(getTransferDeviceId())}`, {
            method: 'DELETE'
        });
        removeTransferRelayTaskKey(relayTransferId);
    }
    if (directTransferId && window.TransferDirectTransfer?.deleteTransfer) {
        await TransferDirectTransfer.deleteTransfer(directTransferId, { skipConfirm: true });
    }
    await syncTransfer();
}

async function deleteTransferTask(direction, index) {
    const transfers = direction === 'incoming'
        ? transferState.displayIncomingTransfers
        : transferState.displayOutgoingTransfers;
    const transfer = transfers[Number(index)];
    if (!transfer) {
        return;
    }

    const task = buildTransferTaskFromTransfer(transfer, direction);
    if (!task.taskId) {
        await deleteTransferTransferGroup(transfer.relayTransferId, transfer.directTransferId);
        return;
    }

    const confirmed = await showAppConfirm(transferText('transferDeleteConfirm', 'Delete this transfer record?'), {
        title: transferText('transferDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: transferText('transferDelete', 'Delete')
    });
    if (!confirmed) {
        return;
    }

    await transferRequest(`/transfer/tasks/${task.taskId}?deviceId=${encodeURIComponent(getTransferDeviceId())}`, {
        method: 'DELETE'
    });
    (collectTransferTaskAttemptIds(task, 'direct')).forEach(transferId => {
        if (window.TransferDirectTransfer?.deleteTransfer) {
            TransferDirectTransfer.deleteTransfer(transferId, {
                skipConfirm: true,
                skipServerSync: true
            }).catch(error => console.warn('Failed to delete local direct transfer:', error));
        }
    });
    await syncTransfer();
}

async function sendSingleTransferFile(selectedItem, batchIndex, batchTotal) {
    const file = selectedItem.file;
    const receiverDeviceId = transferState.selectedReceiverDeviceId;
    const taskKey = buildTransferTaskKey(file, receiverDeviceId, 'outgoing');
    try {
        let directInterrupted = false;
        let directTaskId = findTransferTaskByKey(taskKey)?.id || null;
        const directReady = await maybeEnsureSelectedDeviceDirectRoute({
            silent: true,
            waitForReadyMs: 1800,
            settleWaitMs: 4200,
            forceOnUnavailable: true,
            pairRetryCount: 2,
            pairRetryDelayMs: 450
        });
        if (directReady
            && window.TransferDirectTransfer
            && typeof TransferDirectTransfer.canSendToPeerDevice === 'function'
            && typeof TransferDirectTransfer.sendFile === 'function'
            && TransferDirectTransfer.canSendToPeerDevice(receiverDeviceId)) {
            try {
                await TransferDirectTransfer.sendFile(file, {
                    expectedPeerDeviceId: receiverDeviceId,
                    silentError: true,
                    taskKey
                });
                clearTransferSelectedFile();
                transferState.activeUpload = null;
                renderTransferActiveUpload();
                showToast(transferText('transferDirectPreferred', 'Direct link is handling this transfer'), 'success');
                return;
            } catch (directError) {
                directInterrupted = true;
                directTaskId = directError?.transferDirectContext?.taskId || directTaskId;
                if (typeof TransferDirectTransfer.markFallbackToRelay === 'function') {
                    TransferDirectTransfer.markFallbackToRelay(directError.transferDirectContext || {});
                }
                showToast(transferText('transferDirectInterruptedRelay', 'Direct transfer was interrupted, switching to server relay'), 'warning');
            }
        }

        if (!directInterrupted && getSelectedTransferDevice()?.online) {
            if (window.TransferDirectTransfer?.recordSameAccountRelayFallbackAttempt) {
                const currentDeviceId = getTransferDeviceId();
                const failureReason = resolveTransferDirectFallbackReason(receiverDeviceId);
                TransferDirectTransfer.recordSameAccountRelayFallbackAttempt({
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
            showToast(transferText('transferRelayFallback', 'Direct link is not ready yet, falling back to server relay'), 'warning');
        }

        let session = await resolveTransferTransferSession(file, receiverDeviceId, taskKey, directTaskId);
        const uploadedIndexes = new Set(session.uploadedChunkIndexes || []);
        const totalChunks = session.totalChunks || Math.max(1, Math.ceil(file.size / session.chunkSize));
        const batchLabel = batchTotal > 1 ? `${batchIndex + 1}/${batchTotal} · ` : '';

        transferState.activeUpload = {
            fileName: `${batchLabel}${selectedItem.label}`,
            progress: Math.round((uploadedIndexes.size / totalChunks) * 100),
            statusText: transferText('transferResumeHint', 'Interrupted uploads can continue from missing chunks')
        };
        renderTransferActiveUpload();

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadedIndexes.has(chunkIndex)) {
                continue;
            }

            const start = chunkIndex * session.chunkSize;
            const end = Math.min(file.size, start + session.chunkSize);
            const chunk = file.slice(start, end);

            const response = await fetch(`${API_BASE}/transfer/transfers/${session.id}/chunks/${chunkIndex}?deviceId=${encodeURIComponent(getTransferDeviceId())}`, {
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
                throw new Error(result?.message || 'Transfer chunk upload failed');
            }

            session = result.data;
            uploadedIndexes.add(chunkIndex);
            transferState.activeUpload = {
                fileName: `${batchLabel}${selectedItem.label}`,
                progress: Math.round(((session.uploadedChunks || uploadedIndexes.size) / totalChunks) * 100),
                statusText: `${session.uploadedChunks || uploadedIndexes.size}/${totalChunks} ${transferText('transferChunkProgress', 'chunks')}`
            };
            renderTransferActiveUpload();
        }

        clearTransferPendingSession(file, receiverDeviceId);
        transferState.activeUpload = {
            fileName: `${batchLabel}${selectedItem.label}`,
            progress: 100,
            statusText: transferText('transferStatusReady', 'Ready to Download')
        };
        renderTransferActiveUpload();
        await syncTransfer();
        showToast(transferText('transferSendSuccess', 'File is ready on the target device'), 'success');
    } catch (error) {
        showToast(error.message, 'error');
        transferState.activeUpload = {
            fileName: selectedItem.label,
            progress: transferState.activeUpload?.progress || 0,
            statusText: transferText('transferResumeHint', 'Re-select the same file to continue missing chunks')
        };
        renderTransferActiveUpload();
        throw error;
    }
}

async function sendTransferFile() {
    if (transferState.sending || !transferState.selectedFiles.length || !transferState.selectedReceiverDeviceId) {
        return;
    }

    transferState.sending = true;
    const selectedItems = [...transferState.selectedFiles];

    try {
        for (let index = 0; index < selectedItems.length; index++) {
            await sendSingleTransferFile(selectedItems[index], index, selectedItems.length);
        }
        clearTransferSelectedFile();
        transferState.activeUpload = null;
        renderTransferActiveUpload();
    } finally {
        transferState.sending = false;
        renderTransferActiveUpload();
    }
}

async function deleteTransferTransfer(transferId) {
    const confirmed = await showAppConfirm(transferText('transferDeleteConfirm', 'Delete this transfer record?'), {
        title: transferText('transferDelete', 'Delete'),
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: transferText('transferDelete', 'Delete')
    });

    if (!confirmed) {
        return;
    }

    await transferRequest(`/transfer/transfers/${transferId}?deviceId=${encodeURIComponent(getTransferDeviceId())}`, {
        method: 'DELETE'
    });
    removeTransferRelayTaskKey(transferId);
    await syncTransfer();
}

async function saveTransferToNetdisk(transferId) {
    const folderId = Number(document.getElementById('transferSaveFolderSelect')?.value || 0);
    const response = await transferRequest(`/transfer/transfers/${transferId}/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            deviceId: getTransferDeviceId(),
            folderId
        })
    });
    await syncTransfer();
    showToast(transferText('transferSavedToNetdisk', 'Saved to your netdisk'), 'success');
    return response;
}

function downloadTransfer(transferId) {
    window.location.href = `${API_BASE}/transfer/transfers/${transferId}/download?deviceId=${encodeURIComponent(getTransferDeviceId())}`;
    setTimeout(() => {
        syncTransfer(true);
    }, 1200);
}

function bindTransferEvents() {
    const fileInput = document.getElementById('transferFileInput');
    const folderInput = document.getElementById('transferFolderInput');
    const modeSwitch = document.getElementById('transferModeSwitch');
    const directHistoryToggle = document.getElementById('transferDirectHistoryToggle');
    const accountHistoryToggle = document.getElementById('transferAccountHistoryToggle');
    const deviceSettingsToggle = document.getElementById('transferDeviceSettingsToggle');
    const incomingNoticeOpenBtn = document.getElementById('transferIncomingNoticeOpenBtn');
    const historyBackBtn = document.getElementById('transferHistoryBackBtn');
    const deviceList = document.getElementById('transferDeviceList');
    const incomingList = document.getElementById('transferIncomingList');
    const outgoingList = document.getElementById('transferOutgoingList');

    if (fileInput) {
        fileInput.addEventListener('change', handleTransferFileChange);
    }
    if (folderInput) {
        folderInput.addEventListener('change', handleTransferFileChange);
    }
    if (modeSwitch) {
        modeSwitch.addEventListener('click', event => {
            const button = event.target.closest('[data-transfer-mode]');
            if (!button) {
                return;
            }
            closeTransferHistoryDrawer();
            setTransferMode(button.getAttribute('data-transfer-mode'));
            renderTransferDisclosure();
        });
    }
    if (directHistoryToggle) {
        directHistoryToggle.addEventListener('click', () => {
            openTransferHistoryPage('temporaryHistory');
        });
    }
    if (accountHistoryToggle) {
        accountHistoryToggle.addEventListener('click', () => {
            openTransferHistoryPage('accountHistory');
        });
    }
    if (deviceSettingsToggle) {
        deviceSettingsToggle.addEventListener('click', () => {
            transferState.deviceSettingsExpanded = !transferState.deviceSettingsExpanded;
            renderTransferDisclosure();
        });
    }
    if (incomingNoticeOpenBtn) {
        incomingNoticeOpenBtn.addEventListener('click', () => {
            openTransferHistoryPage('accountHistory');
        });
    }
    if (historyBackBtn) {
        historyBackBtn.addEventListener('click', closeTransferHistoryDrawer);
    }

    if (deviceList) {
        deviceList.addEventListener('click', event => {
            const card = event.target.closest('[data-transfer-device]');
            if (!card) {
                return;
            }
            transferState.selectedReceiverDeviceId = card.getAttribute('data-transfer-device') || '';
            transferState.directSessionTargetDeviceId = '';
            renderTransferDevices();
            renderTransferActiveUpload();
            maybeEnsureSelectedDeviceDirectRoute({ silent: true, waitForReadyMs: 1200, force: true }).catch(() => {});
        });
    }

    document.addEventListener('click', event => {
        if (!event.target.closest('#transferPickerShell')) {
            closeTransferPickerMenu();
        }
    });

    [incomingList, outgoingList].forEach(container => {
        if (!container) {
            return;
        }
        container.addEventListener('click', event => {
            const previewButton = event.target.closest('[data-transfer-preview]');
            if (previewButton) {
                const [directionKey, index] = String(previewButton.getAttribute('data-transfer-preview') || '').split(':');
                previewTransferItem(directionKey, index).catch(error => showToast(error.message, 'error'));
                return;
            }

            const downloadButton = event.target.closest('[data-transfer-download]');
            if (downloadButton) {
                downloadTransfer(downloadButton.getAttribute('data-transfer-download'));
                return;
            }

            const saveButton = event.target.closest('[data-transfer-save]');
            if (saveButton) {
                saveTransferToNetdisk(saveButton.getAttribute('data-transfer-save'));
                return;
            }

            const detailButton = event.target.closest('[data-transfer-detail]');
            if (detailButton) {
                const [directionKey, index] = String(detailButton.getAttribute('data-transfer-detail') || '').split(':');
                showTransferTransferDetails(directionKey, index);
                return;
            }

            const taskDeleteButton = event.target.closest('[data-transfer-task-delete]');
            if (taskDeleteButton) {
                const [directionKey, index] = String(taskDeleteButton.getAttribute('data-transfer-task-delete') || '').split(':');
                deleteTransferTask(directionKey, index);
                return;
            }

            const directDownloadButton = event.target.closest('[data-transfer-direct-download]');
            if (directDownloadButton && window.TransferDirectTransfer?.downloadTransfer) {
                TransferDirectTransfer.downloadTransfer(directDownloadButton.getAttribute('data-transfer-direct-download'));
                return;
            }

            const directSaveButton = event.target.closest('[data-transfer-direct-save]');
            if (directSaveButton && window.TransferDirectTransfer?.saveTransferToNetdisk) {
                const folderId = Number(document.getElementById('transferSaveFolderSelect')?.value || 0);
                TransferDirectTransfer.saveTransferToNetdisk(directSaveButton.getAttribute('data-transfer-direct-save'), folderId)
                    .catch(error => showToast(error.message, 'error'));
                return;
            }

            const deleteButton = event.target.closest('[data-transfer-delete]');
            if (deleteButton) {
                deleteTransferTransfer(deleteButton.getAttribute('data-transfer-delete'));
                return;
            }

            const groupedDeleteButton = event.target.closest('[data-transfer-delete-relay], [data-transfer-delete-direct]');
            if (groupedDeleteButton && (groupedDeleteButton.getAttribute('data-transfer-delete-relay') || groupedDeleteButton.getAttribute('data-transfer-delete-direct'))) {
                deleteTransferTransferGroup(
                    groupedDeleteButton.getAttribute('data-transfer-delete-relay'),
                    groupedDeleteButton.getAttribute('data-transfer-delete-direct')
                );
                return;
            }

            const directDeleteButton = event.target.closest('[data-transfer-direct-delete]');
            if (directDeleteButton && window.TransferDirectTransfer?.deleteTransfer) {
                TransferDirectTransfer.deleteTransfer(directDeleteButton.getAttribute('data-transfer-direct-delete'));
            }
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            syncTransfer(true);
        }
    });

    document.addEventListener('quickshare:languagechange', () => {
        renderTransferPage();
    });

    window.addEventListener('hashchange', () => {
        applyTransferSubpageFromLocation();
    });

    window.addEventListener('popstate', () => {
        applyTransferSubpageFromLocation();
    });

    document.addEventListener('transfer:direct-statechange', () => {
        renderTransferActiveUpload();
        renderTransferDisclosure();
    });

    document.addEventListener('transfer:direct-transfer-storechange', () => {
        refreshTransferDirectTransfers();
        syncTransfer(true);
    });
}

async function initTransferPage() {
    bindTransferEvents();
    setTransferAccountMode(typeof isLoggedIn === 'function' && isLoggedIn());
    transferState.currentMode = transferState.accountMode ? 'account' : 'temporary';
    transferState.currentSubpage = getTransferSubpageFromLocation();

    if (transferState.accountMode) {
        try {
            transferState.profile = window.QuickShareSession && typeof window.QuickShareSession.fetchProfile === 'function'
                ? await window.QuickShareSession.fetchProfile()
                : getStoredAuthUser();
        } catch (error) {
            transferState.profile = getStoredAuthUser();
        }

        const nameInput = document.getElementById('transferDeviceName');
        if (nameInput) {
            nameInput.value = getStoredTransferDeviceName();
        }

        await syncTransfer();

        if (transferState.syncTimer) {
            clearInterval(transferState.syncTimer);
        }
        transferState.syncTimer = window.setInterval(() => {
            syncTransfer(true);
        }, TRANSFER_SYNC_INTERVAL_MS);
        return;
    }

    renderTransferPage();
}

window.syncTransfer = syncTransfer;
window.saveTransferDeviceName = saveTransferDeviceName;
window.toggleTransferPickerMenu = toggleTransferPickerMenu;
window.openTransferFilePicker = openTransferFilePicker;
window.openTransferFolderPicker = openTransferFolderPicker;
window.sendTransferFile = sendTransferFile;
window.showTransferTransferDetails = showTransferTransferDetails;
window.transferState = transferState;

document.addEventListener('DOMContentLoaded', initTransferPage);
