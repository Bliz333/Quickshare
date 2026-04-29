const TRANSFER_DIRECT_DB_NAME = 'transfer-direct-v1';
const TRANSFER_DIRECT_TRANSFER_STORE = 'transfers';
const TRANSFER_DIRECT_CHUNK_STORE = 'chunks';
const TRANSFER_DIRECT_PENDING_KEY = 'transfer-direct-pending';
const TRANSFER_DIRECT_DEVICE_ID_KEY = 'transfer-device-id';
const TRANSFER_DIRECT_CHUNK_SIZE = 64 * 1024;
const TRANSFER_DIRECT_MAX_BUFFERED_AMOUNT = 512 * 1024;
const TRANSFER_DIRECT_ACCEPT_TIMEOUT_MS = 15000;
const TRANSFER_GUEST_RELAY_CHUNK_SIZE = 2 * 1024 * 1024;
const TRANSFER_DIRECT_COMPLETED_RETENTION_MS = (window.AppConfig?.TRANSFER_DIRECT_COMPLETED_RETENTION_DAYS || 7) * 24 * 60 * 60 * 1000;
const TRANSFER_DIRECT_SAVED_RETENTION_MS = (window.AppConfig?.TRANSFER_DIRECT_SAVED_RETENTION_HOURS || 24) * 60 * 60 * 1000;
const TRANSFER_DIRECT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const TRANSFER_DIRECT_PAIR_TASK_POLL_INTERVAL_MS = 5000;
const TRANSFER_DIRECT_TEXT_PREVIEW_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'yaml', 'yml',
    'properties', 'ini', 'conf', 'sql', 'sh', 'bat', 'java', 'js', 'ts',
    'tsx', 'jsx', 'css', 'html', 'htm'
]);
const TRANSFER_DIRECT_TEXT_PREVIEW_MIME_TYPES = new Set([
    'application/json', 'application/xml', 'application/javascript', 'application/x-javascript',
    'application/yaml', 'application/x-yaml', 'application/sql'
]);
const TRANSFER_DIRECT_OFFICE_PREVIEW_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const TRANSFER_DIRECT_OFFICE_PREVIEW_MIME_TYPES = new Set([
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

const TransferDirectTransfer = (() => {
    const memoryStore = {
        transfers: new Map(),
        chunks: new Map()
    };

    const state = {
        selectedFiles: [],
        selectedFile: null,
        batchSending: false,
        activeSend: null,
        incomingTransfers: [],
        outgoingTransfers: [],
        displayTransfers: [],
        pickerMenuOpen: false,
        serverPairTasks: [],
        pairTaskContextKey: '',
        pairTaskPollTimer: null,
        acceptWaiters: new Map(),
        receivingSessions: new Map(),
        receiveQueue: Promise.resolve(),
        announcedIncomingTransfers: new Set(),
        announcedRelayShares: new Set(),
        relayPeerKeyOffer: null,
        dbPromise: null
    };

    function text(key, fallback) {
        return typeof t === 'function' ? t(key) : fallback;
    }

    function directReady() {
        return window.TransferSignalManager && typeof TransferSignalManager.isDirectReady === 'function'
            ? TransferSignalManager.isDirectReady()
            : false;
    }

    function isSignedInTransferUser() {
        return typeof isLoggedIn === 'function' ? isLoggedIn() : false;
    }

    function getSignalState() {
        return window.TransferSignalManager && typeof TransferSignalManager.getState === 'function'
            ? TransferSignalManager.getState()
            : {};
    }

    async function announceRelayRecipientKey(pairSessionId) {
        if (!window.QuickShareE2EE?.prepareRelayRecipient || !window.TransferSignalManager?.sendSignal) {
            return;
        }
        const sessionId = String(pairSessionId || getSignalState().pairSessionId || '').trim();
        if (!sessionId) return;
        const offer = await window.QuickShareE2EE.prepareRelayRecipient(sessionId);
        TransferSignalManager.sendSignal('relay-e2ee-offer', offer);
    }

    async function completeIncomingRelayE2ee(e2ee) {
        if (!e2ee?.encrypted || !window.QuickShareE2EE?.completeRelayRecipientE2ee) {
            return e2ee;
        }
        return window.QuickShareE2EE.completeRelayRecipientE2ee(e2ee);
    }

    function extractDeviceId(channelId) {
        if (!channelId) {
            return '';
        }
        const marker = channelId.indexOf(':device:');
        if (marker < 0) {
            return '';
        }
        return channelId.slice(marker + ':device:'.length()).trim();
    }

    function buildSendContext() {
        return state.activeSend
            ? {
                transferId: state.activeSend.transferId,
                taskKey: state.activeSend.taskKey || '',
                fileName: state.activeSend.fileName,
                progress: state.activeSend.progress || 0,
                totalChunks: state.activeSend.totalChunks || 0,
                sentChunks: state.activeSend.sentChunks || 0,
                acknowledgedChunks: state.activeSend.acknowledgedChunks || 0,
                peerChannelId: state.activeSend.peerChannelId || '',
                peerDeviceId: state.activeSend.peerDeviceId || '',
                senderDeviceId: state.activeSend.senderDeviceId || '',
                receiverDeviceId: state.activeSend.receiverDeviceId || '',
                taskId: state.activeSend.taskId || null,
                pairTaskId: state.activeSend.pairTaskId || null,
                pairSessionId: state.activeSend.pairSessionId || '',
                selfChannelId: state.activeSend.selfChannelId || '',
                selfLabel: state.activeSend.selfLabel || ''
            }
            : null;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function getSelectionDisplayName(file) {
        return file?.webkitRelativePath || file?.name || '';
    }

    function transferPublicRequest(path, options = {}, withAuth = false) {
        const headers = {
            ...(options.headers || {})
        };
        if (withAuth && typeof getAuthHeaders === 'function') {
            Object.assign(headers, getAuthHeaders());
        }
        return fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        }).then(async response => {
            const textBody = await response.text();
            const result = textBody ? JSON.parse(textBody) : null;
            if (!response.ok || !result || result.code !== 200) {
                throw new Error(result?.message || 'Transfer public request failed');
            }
            return result.data;
        });
    }

    function normalizeBatchFileName(file) {
        const displayName = getSelectionDisplayName(file);
        const normalized = String(displayName || file?.name || '')
            .replace(/[\\/]+/g, '__')
            .trim();
        return normalized || `transfer-${Date.now()}`;
    }

    function buildSelectionItem(file) {
        const label = getSelectionDisplayName(file) || file.name || 'transfer-file';
        const normalizedName = normalizeBatchFileName(file);
        const transferFile = normalizedName === file.name
            ? file
            : new File([file], normalizedName, {
                type: file.type || 'application/octet-stream',
                lastModified: file.lastModified || Date.now()
            });
        return {
            id: `${normalizedName}:${file.size}:${file.lastModified || 0}`,
            label,
            file: transferFile,
            size: file.size || 0
        };
    }

    function setSelectedFiles(files) {
        const items = Array.from(files || [])
            .filter(item => item instanceof File)
            .map(buildSelectionItem);
        state.selectedFiles = items;
        state.selectedFile = items[0]?.file || null;
    }

    function emitStoreChange() {
        document.dispatchEvent(new CustomEvent('transfer:direct-transfer-storechange', {
            detail: {
                incomingTransfers: [...state.incomingTransfers],
                outgoingTransfers: [...state.outgoingTransfers]
            }
        }));
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
        });
    }

    function transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
        });
    }

    async function openDb() {
        if (state.dbPromise) {
            return state.dbPromise;
        }
        if (!window.indexedDB) {
            state.dbPromise = Promise.resolve(null);
            return state.dbPromise;
        }
        state.dbPromise = new Promise(resolve => {
            const request = window.indexedDB.open(TRANSFER_DIRECT_DB_NAME, 1);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(TRANSFER_DIRECT_TRANSFER_STORE)) {
                    db.createObjectStore(TRANSFER_DIRECT_TRANSFER_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(TRANSFER_DIRECT_CHUNK_STORE)) {
                    const chunkStore = db.createObjectStore(TRANSFER_DIRECT_CHUNK_STORE, { keyPath: 'key' });
                    chunkStore.createIndex('byTransferId', 'transferId', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        return state.dbPromise;
    }

    async function listStoredTransfers() {
        const db = await openDb();
        if (!db) {
            return Array.from(memoryStore.transfers.values());
        }
        const transaction = db.transaction([TRANSFER_DIRECT_TRANSFER_STORE], 'readonly');
        const request = transaction.objectStore(TRANSFER_DIRECT_TRANSFER_STORE).getAll();
        const result = await requestToPromise(request);
        await transactionDone(transaction);
        return result || [];
    }

    async function getStoredTransfer(transferId) {
        const db = await openDb();
        if (!db) {
            return memoryStore.transfers.get(transferId) || null;
        }
        const transaction = db.transaction([TRANSFER_DIRECT_TRANSFER_STORE], 'readonly');
        const request = transaction.objectStore(TRANSFER_DIRECT_TRANSFER_STORE).get(transferId);
        const result = await requestToPromise(request);
        await transactionDone(transaction);
        return result || null;
    }

    async function putStoredTransfer(transfer) {
        const normalized = {
            direction: 'incoming',
            status: 'receiving',
            receivedChunks: 0,
            createdAt: nowIso(),
            updateTime: nowIso(),
            ...transfer
        };
        const db = await openDb();
        if (!db) {
            memoryStore.transfers.set(normalized.id, normalized);
            return normalized;
        }
        const transaction = db.transaction([TRANSFER_DIRECT_TRANSFER_STORE], 'readwrite');
        transaction.objectStore(TRANSFER_DIRECT_TRANSFER_STORE).put(normalized);
        await transactionDone(transaction);
        return normalized;
    }

    async function putStoredChunk(transferId, chunkIndex, payload) {
        const db = await openDb();
        if (!db) {
            if (!memoryStore.chunks.has(transferId)) {
                memoryStore.chunks.set(transferId, new Map());
            }
            memoryStore.chunks.get(transferId).set(chunkIndex, payload);
            return;
        }
        const transaction = db.transaction([TRANSFER_DIRECT_CHUNK_STORE], 'readwrite');
        transaction.objectStore(TRANSFER_DIRECT_CHUNK_STORE).put({
            key: `${transferId}:${chunkIndex}`,
            transferId,
            chunkIndex,
            payload
        });
        await transactionDone(transaction);
    }

    async function listStoredChunkIndexes(transferId) {
        const db = await openDb();
        if (!db) {
            return Array.from(memoryStore.chunks.get(transferId)?.keys() || []);
        }
        const transaction = db.transaction([TRANSFER_DIRECT_CHUNK_STORE], 'readonly');
        const index = transaction.objectStore(TRANSFER_DIRECT_CHUNK_STORE).index('byTransferId');
        const request = index.getAll(transferId);
        const result = await requestToPromise(request);
        await transactionDone(transaction);
        return (result || []).map(item => Number(item.chunkIndex));
    }

    async function loadStoredChunks(transferId) {
        const db = await openDb();
        if (!db) {
            return Array.from(memoryStore.chunks.get(transferId)?.entries() || [])
                .sort((left, right) => left[0] - right[0])
                .map(entry => entry[1]);
        }
        const transaction = db.transaction([TRANSFER_DIRECT_CHUNK_STORE], 'readonly');
        const index = transaction.objectStore(TRANSFER_DIRECT_CHUNK_STORE).index('byTransferId');
        const request = index.getAll(transferId);
        const result = await requestToPromise(request);
        await transactionDone(transaction);
        return (result || [])
            .sort((left, right) => Number(left.chunkIndex) - Number(right.chunkIndex))
            .map(item => item.payload);
    }

    async function deleteStoredTransfer(transferId) {
        const db = await openDb();
        if (!db) {
            memoryStore.transfers.delete(transferId);
            memoryStore.chunks.delete(transferId);
            return;
        }

        const transferTx = db.transaction([TRANSFER_DIRECT_TRANSFER_STORE], 'readwrite');
        transferTx.objectStore(TRANSFER_DIRECT_TRANSFER_STORE).delete(transferId);
        await transactionDone(transferTx);

        const chunkTx = db.transaction([TRANSFER_DIRECT_CHUNK_STORE], 'readwrite');
        const chunkStore = chunkTx.objectStore(TRANSFER_DIRECT_CHUNK_STORE);
        const index = chunkStore.index('byTransferId');
        await new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(transferId));
            request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'));
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                chunkStore.delete(cursor.primaryKey);
                cursor.continue();
            };
        });
        await transactionDone(chunkTx);
    }

    function formatSize(bytes) {
        return typeof formatFileSize === 'function' ? formatFileSize(bytes || 0) : `${bytes || 0} B`;
    }

    function formatTime(value) {
        if (!value) {
            return '-';
        }
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

    function normalizePreviewExtension(fileName) {
        const rawName = String(fileName || '').trim().toLowerCase();
        const dotIndex = rawName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex === rawName.length - 1) {
            return '';
        }
        return rawName.slice(dotIndex + 1);
    }

    function normalizePreviewContentType(contentType) {
        const value = String(contentType || '').trim().toLowerCase();
        if (!value) {
            return '';
        }
        const semicolonIndex = value.indexOf(';');
        return semicolonIndex >= 0 ? value.slice(0, semicolonIndex).trim() : value;
    }

    function getTransferPreviewKind(transfer) {
        const fileName = transfer?.fileName || '';
        const extension = normalizePreviewExtension(fileName);
        const contentType = normalizePreviewContentType(transfer?.contentType || '');

        if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
            return 'image';
        }
        if (contentType.startsWith('video/')) {
            return 'video';
        }
        if (contentType.startsWith('audio/')) {
            return 'audio';
        }
        if (contentType === 'application/pdf' || extension === 'pdf') {
            return 'pdf';
        }
        if (contentType.startsWith('text/') || TRANSFER_DIRECT_TEXT_PREVIEW_MIME_TYPES.has(contentType) || TRANSFER_DIRECT_TEXT_PREVIEW_EXTENSIONS.has(extension)) {
            return 'text';
        }
        return null;
    }

    function getGuestRelayPreviewKind(fileName, contentType) {
        const extension = normalizePreviewExtension(fileName);
        const normalizedContentType = normalizePreviewContentType(contentType);

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
        if (normalizedContentType.startsWith('text/') || TRANSFER_DIRECT_TEXT_PREVIEW_MIME_TYPES.has(normalizedContentType) || TRANSFER_DIRECT_TEXT_PREVIEW_EXTENSIONS.has(extension)) {
            return 'text';
        }
        if (TRANSFER_DIRECT_OFFICE_PREVIEW_MIME_TYPES.has(normalizedContentType) || TRANSFER_DIRECT_OFFICE_PREVIEW_EXTENSIONS.has(extension)) {
            return 'office';
        }
        return null;
    }

    function pendingSessions() {
        try {
            return JSON.parse(localStorage.getItem(TRANSFER_DIRECT_PENDING_KEY) || '{}');
        } catch (error) {
            return {};
        }
    }

    function savePendingSessions(data) {
        localStorage.setItem(TRANSFER_DIRECT_PENDING_KEY, JSON.stringify(data));
    }

    function getCurrentDeviceId() {
        return localStorage.getItem(TRANSFER_DIRECT_DEVICE_ID_KEY) || '';
    }

    function canSyncTaskToServer(transfer) {
        return Boolean(
            transfer
            && typeof isLoggedIn === 'function'
            && isLoggedIn()
            && transfer.senderDeviceId
            && transfer.receiverDeviceId
            && transfer.id
            && getCurrentDeviceId()
        );
    }

    function getDirectSignalContext() {
        const signalState = getSignalState();
        return {
            pairSessionId: signalState.pairSessionId || '',
            selfChannelId: signalState.channelId || '',
            peerChannelId: signalState.latestPeerChannelId || '',
            peerLabel: signalState.latestPeerLabel || '',
            selfLabel: resolveLocalLabel()
        };
    }

    function getPairTaskListContext() {
        const context = getDirectSignalContext();
        if (!context.pairSessionId || !context.selfChannelId) {
            return null;
        }
        return context;
    }

    function buildPairTaskContextKey(context) {
        if (!context?.pairSessionId || !context?.selfChannelId) {
            return '';
        }
        return `${context.pairSessionId}:${context.selfChannelId}`;
    }

    function canSyncPublicPairTaskToServer(transfer) {
        const context = getDirectSignalContext();
        return Boolean(
            transfer
            && transfer.id
            && context.pairSessionId
            && context.selfChannelId
            && context.peerChannelId
        );
    }

    async function fetchPublicPairTasksFromServer(options = {}) {
        const context = options.context || getPairTaskListContext();
        const contextKey = buildPairTaskContextKey(context);
        if (!contextKey) {
            state.serverPairTasks = [];
            state.pairTaskContextKey = '';
            render();
            return [];
        }

        const response = await fetch(`${API_BASE}/public/transfer/pair-tasks?pairSessionId=${encodeURIComponent(context.pairSessionId)}&selfChannelId=${encodeURIComponent(context.selfChannelId)}`);
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'List public pair tasks failed');
        }

        if (buildPairTaskContextKey(getPairTaskListContext()) !== contextKey) {
            return state.serverPairTasks;
        }

        state.serverPairTasks = Array.isArray(result.data) ? result.data : [];
        state.pairTaskContextKey = contextKey;
        render();
        return state.serverPairTasks;
    }

    function syncPublicPairTaskPolling() {
        const context = getPairTaskListContext();
        const contextKey = buildPairTaskContextKey(context);
        if (!contextKey) {
            if (state.pairTaskPollTimer) {
                clearInterval(state.pairTaskPollTimer);
                state.pairTaskPollTimer = null;
            }
            if (state.serverPairTasks.length || state.pairTaskContextKey) {
                state.serverPairTasks = [];
                state.pairTaskContextKey = '';
                render();
            }
            return;
        }

        if (state.pairTaskPollTimer && state.pairTaskContextKey === contextKey) {
            return;
        }

        if (state.pairTaskPollTimer) {
            clearInterval(state.pairTaskPollTimer);
        }
        state.pairTaskContextKey = contextKey;
        fetchPublicPairTasksFromServer({ context }).catch(error => {
            console.warn('Failed to load public pair tasks from server:', error);
        });
        state.pairTaskPollTimer = window.setInterval(() => {
            fetchPublicPairTasksFromServer().catch(error => {
                console.warn('Failed to refresh public pair tasks from server:', error);
            });
        }, TRANSFER_DIRECT_PAIR_TASK_POLL_INTERVAL_MS);
    }

    async function syncDirectAttemptToServer(transfer, options = {}) {
        if (!canSyncTaskToServer(transfer)) {
            return null;
        }

        const response = await fetch(`${API_BASE}/transfer/tasks/direct-attempts`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taskId: transfer.taskId || null,
                taskKey: transfer.taskKey || '',
                deviceId: getCurrentDeviceId(),
                senderDeviceId: transfer.senderDeviceId,
                receiverDeviceId: transfer.receiverDeviceId,
                clientTransferId: transfer.id,
                fileName: transfer.fileName,
                fileSize: transfer.fileSize,
                contentType: transfer.contentType || 'application/octet-stream',
                totalChunks: transfer.totalChunks || 0,
                completedChunks: Number(
                    transfer.direction === 'incoming'
                        ? (transfer.receivedChunks || 0)
                        : (transfer.acknowledgedChunks || transfer.sentChunks || 0)
                ),
                status: transfer.status || 'sending',
                startReason: transfer.startReason || inferTransferStartReason(transfer),
                endReason: transfer.endReason || '',
                failureReason: transfer.failureReason || '',
                savedToNetdisk: Boolean(options.savedToNetdisk),
                downloaded: Boolean(options.downloaded)
            })
        });
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'Sync direct attempt failed');
        }
        return result.data || null;
    }

    async function recordSameAccountRelayFallbackAttempt(details = {}) {
        const syntheticTransfer = {
            id: details.clientTransferId || `direct-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            taskId: details.taskId || null,
            taskKey: details.taskKey || '',
            fileName: details.fileName || '',
            fileSize: Number(details.fileSize || 0),
            contentType: details.contentType || 'application/octet-stream',
            totalChunks: Number(details.totalChunks || 1),
            direction: 'outgoing',
            status: 'relay_fallback',
            startReason: 'same_account_direct',
            endReason: 'relay_fallback',
            failureReason: details.failureReason || 'direct_ready_timeout',
            sentChunks: 0,
            acknowledgedChunks: 0,
            senderDeviceId: details.senderDeviceId || getCurrentDeviceId(),
            receiverDeviceId: details.receiverDeviceId || '',
            peerDeviceId: details.receiverDeviceId || '',
            peerLabel: details.peerLabel || '',
            updateTime: nowIso()
        };
        return syncDirectAttemptToServer(syntheticTransfer);
    }

    async function syncPublicPairTaskToServer(transfer, options = {}) {
        if (!canSyncPublicPairTaskToServer(transfer)) {
            return null;
        }

        const context = getDirectSignalContext();
        const response = await fetch(`${API_BASE}/public/transfer/pair-tasks/direct-attempts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pairSessionId: transfer.pairSessionId || context.pairSessionId,
                selfChannelId: transfer.selfChannelId || context.selfChannelId,
                peerChannelId: transfer.peerChannelId || context.peerChannelId,
                selfLabel: transfer.selfLabel || context.selfLabel,
                peerLabel: transfer.peerLabel || context.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                clientTransferId: transfer.id,
                taskKey: transfer.taskKey || '',
                fileName: transfer.fileName,
                fileSize: transfer.fileSize,
                contentType: transfer.contentType || 'application/octet-stream',
                totalChunks: transfer.totalChunks || 0,
                completedChunks: Number(
                    transfer.direction === 'incoming'
                        ? (transfer.receivedChunks || 0)
                        : (transfer.acknowledgedChunks || transfer.sentChunks || 0)
                ),
                status: transfer.status || 'sending',
                startReason: transfer.startReason || inferTransferStartReason(transfer),
                endReason: transfer.endReason || '',
                failureReason: transfer.failureReason || '',
                savedToNetdisk: Boolean(options.savedToNetdisk),
                downloaded: Boolean(options.downloaded)
            })
        });
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'Sync public pair task failed');
        }
        return result.data || null;
    }

    async function deleteDirectAttemptFromServer(transfer) {
        if (!transfer?.taskId || !canSyncTaskToServer(transfer)) {
            return;
        }
        const response = await fetch(`${API_BASE}/transfer/tasks/${encodeURIComponent(transfer.taskId)}/direct-attempts/${encodeURIComponent(transfer.id)}?deviceId=${encodeURIComponent(getCurrentDeviceId())}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeaders()
            }
        });
        if (response.ok) {
            return;
        }
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        throw new Error(result?.message || 'Delete direct attempt failed');
    }

    async function deletePublicPairTaskAttemptFromServer(transfer) {
        if (!transfer?.pairTaskId || !canSyncPublicPairTaskToServer(transfer)) {
            return;
        }
        const context = getDirectSignalContext();
        const pairSessionId = transfer.pairSessionId || context.pairSessionId;
        const selfChannelId = transfer.selfChannelId || context.selfChannelId;
        const response = await fetch(`${API_BASE}/public/transfer/pair-tasks/${encodeURIComponent(transfer.pairTaskId)}/direct-attempts/${encodeURIComponent(transfer.id)}?pairSessionId=${encodeURIComponent(pairSessionId)}&selfChannelId=${encodeURIComponent(selfChannelId)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            return;
        }
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        throw new Error(result?.message || 'Delete public pair task attempt failed');
    }

    function buildPendingKey(file, peerChannelId) {
        return [
            peerChannelId || '-',
            file.name,
            file.size,
            file.lastModified
        ].join('|');
    }

    function resolveLocalLabel() {
        const explicitDeviceName = localStorage.getItem('transfer-device-name');
        if (explicitDeviceName) {
            return explicitDeviceName;
        }
        const publicSenderLabel = document.getElementById('transferPublicSenderLabel')?.value.trim();
        if (publicSenderLabel) {
            return publicSenderLabel;
        }
        if (typeof getStoredAuthUser === 'function') {
            const user = getStoredAuthUser();
            if (user?.nickname || user?.username) {
                return user.nickname || user.username;
            }
        }
        return 'Transfer';
    }

    function transferStatusLabel(status) {
        switch (status) {
            case 'waiting_accept':
                return text('transferDirectWaitingAccept', 'Waiting for peer resume map');
            case 'negotiating':
                return text('transferLifecycleNegotiating', 'Negotiating');
            case 'sending':
                return text('transferDirectSending', 'Sending directly');
            case 'waiting_complete':
                return text('transferDirectWaitingComplete', 'Waiting for peer to finish storage');
            case 'relay_fallback':
                return text('transferDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay');
            case 'ready':
                return text('transferStatusReady', 'Ready to Download');
            case 'completed':
                return text('transferStatusCompleted', 'Completed');
            case 'failed':
                return text('transferLifecycleFailed', 'Failed');
            case 'receiving':
                return text('transferDirectReceiving', 'Receiving');
            case 'cancelled':
                return text('transferStatusCancelled', 'Cancelled');
            default:
                return text('transferDirectPending', 'Pending');
        }
    }

    function deriveAttemptStatus(stage) {
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

    function attemptStatusLabel(status) {
        switch (status) {
            case 'waiting':
                return text('transferLifecycleWaiting', 'Waiting');
            case 'negotiating':
                return text('transferLifecycleNegotiating', 'Negotiating');
            case 'transferring':
                return text('transferLifecycleTransferring', 'Transferring');
            case 'relay_fallback':
                return text('transferLifecycleFallback', 'Relay Fallback');
            case 'failed':
                return text('transferLifecycleFailed', 'Failed');
            case 'completed':
                return text('transferLifecycleCompleted', 'Completed');
            case 'cancelled':
                return text('transferLifecycleCancelled', 'Cancelled');
            default:
                return transferStatusLabel(status);
        }
    }

    function lifecycleReasonLabel(reason) {
        switch (reason) {
            case 'relay_transfer_created':
                return text('transferReasonRelayTransferCreated', 'Server relay transfer started');
            case 'same_account_direct':
                return text('transferReasonSameAccountDirect', 'Same-account direct session');
            case 'pair_session_direct':
                return text('transferReasonPairSessionDirect', 'Paired direct session');
            case 'saved_to_netdisk':
                return text('transferReasonSavedToNetdisk', 'Saved to netdisk');
            case 'downloaded':
                return text('transferReasonDownloaded', 'Downloaded');
            case 'peer_confirmed':
                return text('transferReasonPeerConfirmed', 'Peer confirmed completion');
            case 'relay_fallback':
                return text('transferReasonRelayFallback', 'Switched to server relay');
            case 'cancelled':
                return text('transferReasonCancelled', 'Cancelled');
            case 'direct_link_unavailable':
                return text('transferReasonDirectLinkUnavailable', 'Direct link was not ready');
            case 'direct_ready_timeout':
                return text('transferReasonDirectReadyTimeout', 'Direct readiness timed out and fell back to relay');
            case 'ice_connection_failed':
                return text('transferReasonIceConnectionFailed', 'ICE connection failed');
            case 'no_relay_candidate':
                return text('transferReasonNoRelayCandidate', 'No usable TURN relay candidate was gathered');
            case 'signaling_unavailable':
                return text('transferReasonSignalingUnavailable', 'Signaling is currently unavailable');
            case 'peer_mismatch':
                return text('transferReasonPeerMismatch', 'Direct link pointed to another device');
            case 'accept_timeout':
                return text('transferReasonAcceptTimeout', 'Peer did not respond in time');
            case 'peer_missed_offer':
                return text('transferReasonPeerMissedOffer', 'Peer missed the transfer offer');
            case 'peer_reported_error':
                return text('transferReasonPeerReportedError', 'Peer reported an error');
            case 'direct_transfer_interrupted':
                return text('transferReasonDirectTransferInterrupted', 'Direct transfer was interrupted');
            case 'direct_transfer_failed':
                return text('transferReasonDirectTransferFailed', 'Direct transfer failed');
            default:
                return reason ? String(reason).replace(/_/g, ' ') : text('transferNotYet', 'Not yet');
        }
    }

    function formatCandidateCounts(counts) {
        const target = counts || {};
        return ['host', 'srflx', 'relay', 'prflx']
            .map(key => `${key}:${Number(target[key] || 0)}`)
            .join(', ');
    }

    function buildDirectDiagnosticsLines() {
        const signalState = getSignalState();
        const diagnostics = signalState.directDiagnostics || {};
        if (!signalState.directState && !diagnostics.connectionState && !diagnostics.selectedCandidatePair) {
            return [];
        }
        const lines = [
            `${text('transferDirectSignalStateLabel', 'Direct State')}: ${signalState.directState || text('transferNotYet', 'Not yet')}`,
            `${text('transferDirectIceStateLabel', 'ICE State')}: ${diagnostics.iceConnectionState || diagnostics.connectionState || text('transferNotYet', 'Not yet')}`,
            `${text('transferDirectCandidateStatsLabel', 'Candidate Stats')}: local(${formatCandidateCounts(diagnostics.localCandidateTypes)}) / remote(${formatCandidateCounts(diagnostics.remoteCandidateTypes)})`
        ];
        if (diagnostics.selectedCandidatePair) {
            const pair = diagnostics.selectedCandidatePair;
            lines.push(`${text('transferDirectSelectedPairLabel', 'Selected Candidate Pair')}: ${pair.localCandidateType || '-'} -> ${pair.remoteCandidateType || '-'} (${pair.localProtocol || pair.remoteProtocol || '-'})`);
        }
        if (diagnostics.lastReadyAt) {
            lines.push(`${text('transferDirectLastReadyLabel', 'Last Direct Ready')}: ${formatTime(diagnostics.lastReadyAt)}`);
        }
        return lines;
    }

    function getLatestAttemptTime(attempts, field, lifecycleStatus) {
        return [...(attempts || [])]
            .map(attempt => {
                if (attempt?.[field]) {
                    return attempt[field];
                }
                if (lifecycleStatus && (attempt?.attemptStatus || deriveAttemptStatus(attempt?.stage || '')) === lifecycleStatus) {
                    return attempt?.updateTime || '';
                }
                return '';
            })
            .filter(Boolean)
            .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || '';
    }

    function normalizeTaskAttempt(attempt, fallback = {}) {
        const stage = attempt?.stage || fallback.stage || '';
        return {
            transferMode: attempt?.transferMode || fallback.transferMode || 'direct',
            transferId: attempt?.transferId != null ? String(attempt.transferId) : (fallback.transferId || ''),
            stage,
            attemptStatus: attempt?.attemptStatus || fallback.attemptStatus || deriveAttemptStatus(stage),
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

    function summarizeTaskAttempts(attempts, fallback = {}) {
        const normalizedAttempts = [...(attempts || [])]
            .filter(Boolean)
            .sort((left, right) => new Date(right?.updateTime || 0).getTime() - new Date(left?.updateTime || 0).getTime());
        const current = normalizedAttempts[0] || {};
        return {
            attemptStatus: current.attemptStatus || fallback.attemptStatus || deriveAttemptStatus(current.stage || fallback.stage || ''),
            startReason: current.startReason || fallback.startReason || '',
            endReason: current.endReason || fallback.endReason || '',
            failureReason: current.failureReason
                || normalizedAttempts.find(attempt => attempt.failureReason)?.failureReason
                || fallback.failureReason
                || '',
            startTime: current.startTime || fallback.startTime || current.updateTime || fallback.updateTime || '',
            completedAt: fallback.completedAt || getLatestAttemptTime(normalizedAttempts, 'completedAt', 'completed'),
            failedAt: fallback.failedAt || getLatestAttemptTime(normalizedAttempts, 'failedAt', 'failed'),
            fallbackAt: fallback.fallbackAt || getLatestAttemptTime(normalizedAttempts, 'fallbackAt', 'relay_fallback'),
            savedToNetdiskAt: fallback.savedToNetdiskAt || getLatestAttemptTime(normalizedAttempts, 'savedToNetdiskAt'),
            downloadedAt: fallback.downloadedAt || getLatestAttemptTime(normalizedAttempts, 'downloadedAt')
        };
    }

    function inferTransferStartReason(transfer) {
        return transfer?.senderDeviceId && transfer?.receiverDeviceId
            ? 'same_account_direct'
            : 'pair_session_direct';
    }

    function createDirectError(reason, message) {
        const error = new Error(message);
        error.transferFailureReason = reason;
        return error;
    }

    function resolveDirectFailureStage(context) {
        return context?.expectedPeerDeviceId ? 'relay_fallback' : 'failed';
    }

    function directionLabel(direction) {
        return direction === 'outgoing'
            ? text('transferOutgoing', 'Outgoing')
            : text('transferIncoming', 'Inbox');
    }

    function compareByUpdateTimeDesc(left, right) {
        return new Date(right?.updateTime || 0).getTime() - new Date(left?.updateTime || 0).getTime();
    }

    function getTransferCompletedChunks(transfer) {
        if (!transfer) {
            return 0;
        }
        return transfer.direction === 'incoming'
            ? Number(transfer.receivedChunks || 0)
            : Number(transfer.acknowledgedChunks || transfer.sentChunks || 0);
    }

    function summarizeSelectedFiles() {
        if (!state.selectedFiles.length) {
            return {
                title: text('transferNoFileSelected', 'No file selected'),
                meta: ''
            };
        }
        if (state.selectedFiles.length === 1) {
            return {
                title: state.selectedFiles[0].label,
                meta: formatSize(state.selectedFiles[0].size)
            };
        }
        const totalSize = state.selectedFiles.reduce((sum, item) => sum + Number(item.size || 0), 0);
        return {
            title: text('transferBatchSelectedSummary', '{count} items selected').replace('{count}', String(state.selectedFiles.length)),
            meta: `${formatSize(totalSize)} · ${state.selectedFiles.slice(0, 3).map(item => item.label).join(' · ')}${state.selectedFiles.length > 3 ? ' ...' : ''}`
        };
    }

    function buildTaskAttemptsFromTransfer(transfer) {
        if (!transfer) {
            return [];
        }
        const startReason = transfer?.startReason
            || (transfer?.senderDeviceId && transfer?.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct');
        return [normalizeTaskAttempt({
            transferMode: 'direct',
            transferId: transfer.id != null ? String(transfer.id) : '',
            stage: transfer.status || '',
            attemptStatus: transfer.attemptStatus || '',
            startReason,
            endReason: transfer.endReason || '',
            failureReason: transfer.failureReason || '',
            completedChunks: getTransferCompletedChunks(transfer),
            totalChunks: Number(transfer.totalChunks || 0),
            startTime: transfer.startTime || transfer.createdAt || transfer.updateTime || '',
            updateTime: transfer.updateTime || '',
            completedAt: transfer.completedAt || '',
            failedAt: transfer.failedAt || '',
            fallbackAt: transfer.fallbackAt || '',
            savedToNetdiskAt: transfer.savedToNetdiskAt || '',
            downloadedAt: transfer.downloadedAt || ''
        })];
    }

    function sortTaskAttempts(attempts) {
        return [...(attempts || [])].sort((left, right) => new Date(right?.updateTime || 0).getTime() - new Date(left?.updateTime || 0).getTime());
    }

    function getPairTaskDirectTransferId(task) {
        return sortTaskAttempts(task?.attempts || [])
            .find(attempt => attempt?.transferMode === 'direct' && attempt?.transferId)?.transferId || '';
    }

    function getCurrentContextLocalTransfers() {
        const context = getPairTaskListContext();
        const transfers = [...state.incomingTransfers, ...state.outgoingTransfers];
        if (!context) {
            return transfers;
        }
        return transfers.filter(transfer => {
            const transferPairSessionId = String(transfer?.pairSessionId || '').trim();
            if (transferPairSessionId) {
                return transferPairSessionId === context.pairSessionId;
            }
            return String(transfer?.selfChannelId || '').trim() === context.selfChannelId
                && String(transfer?.peerChannelId || '').trim() === context.peerChannelId;
        });
    }

    function findLocalTransferForPairTask(task, localTransfers) {
        const pairTaskId = Number(task?.id || 0);
        const directTransferIds = new Set(
            sortTaskAttempts(task?.attempts || [])
                .filter(attempt => attempt?.transferMode === 'direct' && attempt?.transferId)
                .map(attempt => String(attempt.transferId))
        );
        const candidates = (localTransfers || []).filter(transfer => {
            if (pairTaskId && Number(transfer?.pairTaskId || 0) === pairTaskId) {
                return true;
            }
            if (task?.taskKey && transfer?.taskKey === task.taskKey) {
                return true;
            }
            return directTransferIds.has(String(transfer?.id || ''));
        });
        return candidates.find(transfer => transfer?.direction === task?.direction) || candidates[0] || null;
    }

    function buildDisplayTransferFromLocalTransfer(transfer) {
        const attempts = sortTaskAttempts(buildTaskAttemptsFromTransfer(transfer));
        const summary = summarizeTaskAttempts(attempts, transfer);
        return {
            detailId: transfer?.id != null ? String(transfer.id) : '',
            localTransferId: transfer?.id != null ? String(transfer.id) : '',
            deleteTransferId: transfer?.id != null ? String(transfer.id) : '',
            deleteServerTransferId: '',
            taskKey: transfer?.taskKey || '',
            taskId: transfer?.taskId || null,
            pairTaskId: transfer?.pairTaskId || null,
            pairSessionId: transfer?.pairSessionId || '',
            direction: transfer?.direction || 'incoming',
            transferMode: 'direct',
            stage: transfer?.status || '',
            attemptStatus: transfer?.attemptStatus || summary.attemptStatus,
            startReason: transfer?.startReason || summary.startReason,
            endReason: transfer?.endReason || summary.endReason,
            failureReason: transfer?.failureReason || summary.failureReason,
            fileName: transfer?.fileName || '',
            fileSize: Number(transfer?.fileSize || 0),
            peerLabel: transfer?.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            completedChunks: getTransferCompletedChunks(transfer),
            totalChunks: Number(transfer?.totalChunks || 0),
            startTime: transfer?.startTime || summary.startTime || transfer?.createdAt || transfer?.updateTime || '',
            updateTime: transfer?.updateTime || '',
            completedAt: transfer?.completedAt || summary.completedAt || '',
            failedAt: transfer?.failedAt || summary.failedAt || '',
            fallbackAt: transfer?.fallbackAt || summary.fallbackAt || '',
            savedToNetdiskAt: transfer?.savedToNetdiskAt || summary.savedToNetdiskAt || '',
            directTransferId: transfer?.id != null ? String(transfer.id) : '',
            attempts
        };
    }

    function buildDisplayTransferFromPairTask(task, localTransfer) {
        const normalizedAttempts = sortTaskAttempts(
            Array.isArray(task?.attempts) && task.attempts.length
                ? task.attempts.map(attempt => normalizeTaskAttempt(attempt, {
                    transferMode: attempt?.transferMode || 'direct',
                    stage: attempt?.stage || task?.stage || '',
                    completedChunks: Number(attempt?.completedChunks || 0),
                    totalChunks: Number(attempt?.totalChunks || task?.totalChunks || 0),
                    startReason: task?.startReason || (localTransfer?.senderDeviceId && localTransfer?.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct'),
                    updateTime: attempt?.updateTime || task?.updateTime || '',
                    completedAt: task?.completedAt || '',
                    failedAt: task?.failedAt || '',
                    fallbackAt: task?.fallbackAt || '',
                    savedToNetdiskAt: task?.savedToNetdiskAt || ''
                }))
                : buildTaskAttemptsFromTransfer(localTransfer)
        );
        const summary = summarizeTaskAttempts(normalizedAttempts, task);
        const directTransferId = getPairTaskDirectTransferId(task)
            || (localTransfer?.id != null ? String(localTransfer.id) : '');
        return {
            detailId: localTransfer?.id != null
                ? String(localTransfer.id)
                : `pair-task:${task?.id || task?.taskKey || directTransferId || 'unknown'}`,
            localTransferId: localTransfer?.id != null ? String(localTransfer.id) : '',
            deleteTransferId: localTransfer?.id != null ? String(localTransfer.id) : '',
            deleteServerTransferId: !localTransfer && task?.id && directTransferId ? String(directTransferId) : '',
            taskKey: task?.taskKey || localTransfer?.taskKey || '',
            taskId: localTransfer?.taskId || null,
            pairTaskId: task?.id || localTransfer?.pairTaskId || null,
            pairSessionId: task?.pairSessionId || localTransfer?.pairSessionId || '',
            direction: task?.direction || localTransfer?.direction || 'incoming',
            transferMode: task?.transferMode || 'direct',
            stage: task?.stage || localTransfer?.status || '',
            attemptStatus: task?.attemptStatus || summary.attemptStatus,
            startReason: task?.startReason || summary.startReason,
            endReason: task?.endReason || summary.endReason,
            failureReason: task?.failureReason || summary.failureReason,
            fileName: task?.fileName || localTransfer?.fileName || '',
            fileSize: Number(task?.fileSize ?? localTransfer?.fileSize ?? 0),
            peerLabel: task?.peerLabel || localTransfer?.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            completedChunks: Number(task?.completedChunks ?? getTransferCompletedChunks(localTransfer)),
            totalChunks: Number(task?.totalChunks ?? localTransfer?.totalChunks ?? 0),
            startTime: task?.startTime || summary.startTime || localTransfer?.createdAt || localTransfer?.updateTime || '',
            updateTime: task?.updateTime || localTransfer?.updateTime || '',
            completedAt: task?.completedAt || summary.completedAt || localTransfer?.completedAt || '',
            failedAt: task?.failedAt || summary.failedAt || localTransfer?.failedAt || '',
            fallbackAt: task?.fallbackAt || summary.fallbackAt || localTransfer?.fallbackAt || '',
            savedToNetdiskAt: task?.savedToNetdiskAt || summary.savedToNetdiskAt || localTransfer?.savedToNetdiskAt || '',
            directTransferId: directTransferId || '',
            attempts: normalizedAttempts
        };
    }

    function buildDisplayTransfers() {
        const context = getPairTaskListContext();
        const contextKey = buildPairTaskContextKey(context);
        const localTransfers = getCurrentContextLocalTransfers().sort(compareByUpdateTimeDesc);
        if (contextKey) {
            const usedLocalTransferIds = new Set();
            const pairTaskItems = (state.serverPairTasks || []).map(task => {
                const localTransfer = findLocalTransferForPairTask(task, localTransfers);
                if (localTransfer?.id != null) {
                    usedLocalTransferIds.add(String(localTransfer.id));
                }
                return buildDisplayTransferFromPairTask(task, localTransfer);
            });
            const localOnlyItems = localTransfers
                .filter(transfer => !usedLocalTransferIds.has(String(transfer?.id || '')))
                .map(buildDisplayTransferFromLocalTransfer);
            return [...pairTaskItems, ...localOnlyItems].sort(compareByUpdateTimeDesc);
        }
        return localTransfers.map(buildDisplayTransferFromLocalTransfer).sort(compareByUpdateTimeDesc);
    }

    async function refreshStoredTransfers() {
        const transfers = await listStoredTransfers();
        state.incomingTransfers = transfers
            .filter(item => item.direction === 'incoming')
            .sort(compareByUpdateTimeDesc);
        state.outgoingTransfers = transfers
            .filter(item => item.direction === 'outgoing')
            .sort(compareByUpdateTimeDesc);
        emitStoreChange();
        render();
    }

    function renderSelectedFile() {
        const container = document.getElementById('transferDirectSelectedFile');
        if (!container) {
            return;
        }
        if (!state.selectedFiles.length) {
            container.innerHTML = `<span>${text('transferNoFileSelected', 'No file selected')}</span>`;
            return;
        }
        const summary = summarizeSelectedFiles();
        container.innerHTML = `
            <span>${summary.title}</span>
            <span>${summary.meta || '-'}</span>
        `;
    }

    function renderActiveSend() {
        const wrap = document.getElementById('transferDirectActiveTransfer');
        const title = document.getElementById('transferDirectActiveTitle');
        const bar = document.getElementById('transferDirectActiveBar');
        const meta = document.getElementById('transferDirectActiveMeta');
        if (!wrap || !title || !bar || !meta) {
            return;
        }
        if (!state.activeSend) {
            wrap.classList.add('hidden');
            return;
        }
        wrap.classList.remove('hidden');
        title.textContent = state.activeSend.fileName || '-';
        bar.style.width = `${Math.max(0, Math.min(100, state.activeSend.progress || 0))}%`;
        meta.textContent = state.activeSend.statusText || '-';
    }

    function renderPeer() {
        const peer = document.getElementById('transferDirectPeer');
        const sendButton = document.getElementById('transferDirectSendBtn');
        const sendLabel = document.getElementById('transferDirectSendBtnLabel');
        const signalState = getSignalState();
        const peerLabel = signalState.latestPeerLabel || '';
        const canGuestRelaySend = !isSignedInTransferUser() && Boolean(signalState.pairSessionId);
        if (peer) {
            peer.textContent = peerLabel || text('transferDirectNoPeer', 'Waiting for a paired peer');
        }
        if (sendLabel) {
            sendLabel.textContent = peerLabel
                ? text('transferDirectSendNowWithPeer', 'Send to {name}').replace('{name}', peerLabel)
                : text('transferDirectSendNow', 'Start transfer');
        }
        if (sendButton) {
            sendButton.disabled = !state.selectedFiles.length || (!directReady() && !canGuestRelaySend);
        }
    }

    function renderPickerMenu() {
        const menu = document.getElementById('transferDirectPickerMenu');
        if (!menu) {
            return;
        }
        menu.classList.toggle('hidden', !state.pickerMenuOpen);
    }

    function renderTransferList() {
        const list = document.getElementById('transferDirectTransferList');
        const empty = document.getElementById('transferDirectTransferEmpty');
        if (!list || !empty) {
            return;
        }
        state.displayTransfers = buildDisplayTransfers();
        if (!state.displayTransfers.length) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');
        list.innerHTML = state.displayTransfers.map(transfer => {
            const progress = transfer.totalChunks > 0
                ? Math.round(((transfer.completedChunks || 0) / transfer.totalChunks) * 100)
                : 0;
            const peerLabel = transfer.peerLabel || text('transferDirectPeerFallback', 'Paired peer');
            const canDownload = transfer.direction === 'incoming'
                && transfer.localTransferId
                && (transfer.stage === 'ready' || transfer.stage === 'completed');
            const alreadySaved = Boolean(transfer.savedToNetdiskAt);
            const canSave = !alreadySaved
                && canDownload
                && typeof isLoggedIn === 'function'
                && isLoggedIn();
            const deleteAttrs = transfer.deleteTransferId
                ? `data-transfer-direct-delete="${transfer.deleteTransferId}"`
                : transfer.deleteServerTransferId
                    ? `data-transfer-direct-delete-task="${transfer.detailId}"`
                    : 'disabled';
            const previewKind = canDownload && typeof window.getInlinePreviewKind === 'function'
                ? window.getInlinePreviewKind(transfer.fileName, transfer.contentType)
                : null;
            const directPreviewHtml = previewKind && previewKind !== 'office'
                ? `<div class="inline-preview-wrap" data-direct-inline-preview="${transfer.localTransferId}"><div style="padding:12px;color:var(--text2,#64748b);font-size:.82rem"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`
                : '';
            return `
                <article class="transfer-card">
                    <div class="transfer-card-head">
                        <div class="transfer-card-title">
                            <h3>${transfer.fileName}</h3>
                            <p class="transfer-meta">${formatSize(transfer.fileSize)} · ${directionLabel(transfer.direction)} · ${peerLabel}</p>
                        </div>
                        <span class="device-pill">${transferStatusLabel(transfer.stage)}</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" style="width:${progress}%"></div>
                    </div>
                    <p class="transfer-meta">
                        ${text('transferChunkProgress', 'Chunks')}: ${transfer.completedChunks || 0} / ${transfer.totalChunks || 0}
                        · ${text('transferUpdatedAt', 'Updated')}: ${formatTime(transfer.updateTime)}
                    </p>
                    ${directPreviewHtml}
                    <div class="actions">
                        <button class="btn btn-primary" type="button" data-transfer-direct-download="${transfer.localTransferId}" ${canDownload ? '' : 'disabled'}>
                            <i class="fa-solid fa-download"></i>
                            <span>${text('transferDownload', 'Download')}</span>
                        </button>
                        ${alreadySaved
                            ? `<span class="btn btn-secondary" style="opacity:0.7;cursor:default;">
                                <i class="fa-solid fa-circle-check"></i>
                                <span>${text('transferSavedBadge', 'Saved to Netdisk')}</span>
                               </span>
                               <a class="btn btn-secondary" href="netdisk.html">
                                <i class="fa-solid fa-folder-open"></i>
                                <span>${text('transferViewInNetdisk', 'View in Netdisk')}</span>
                               </a>`
                            : `<button class="btn btn-secondary" type="button" data-transfer-direct-save="${transfer.localTransferId}" ${canSave ? '' : 'disabled'}>
                                <i class="fa-solid fa-hard-drive"></i>
                                <span>${text('transferSaveToNetdisk', 'Save to Netdisk')}</span>
                               </button>`
                        }
                        <button class="btn btn-secondary" type="button" data-transfer-direct-detail="${transfer.detailId}">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>${text('transferTaskDetails', 'Details')}</span>
                        </button>
                        <button class="btn btn-secondary" type="button" ${deleteAttrs}>
                            <i class="fa-solid fa-trash"></i>
                            <span>${text('transferDelete', 'Delete')}</span>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function render() {
        renderSelectedFile();
        renderActiveSend();
        renderPeer();
        renderPickerMenu();
        renderTransferList();
        fillDirectInlinePreviews();
    }

    var _blobUrlCache = {};

    async function fillDirectInlinePreviews() {
        Object.keys(_blobUrlCache).forEach(function (key) {
            try { URL.revokeObjectURL(_blobUrlCache[key]); } catch (ignore) {}
        });
        _blobUrlCache = {};
        const placeholders = document.querySelectorAll('[data-direct-inline-preview]');
        if (!placeholders.length) return;
        if (typeof window.injectInlinePreviewStyles === 'function') window.injectInlinePreviewStyles();
        for (const el of placeholders) {
            const transferId = el.getAttribute('data-direct-inline-preview');
            if (!transferId) continue;
            try {
                const transfer = state.displayTransfers.find(t => t.localTransferId === transferId);
                if (!transfer || !transfer.totalChunks) { el.innerHTML = ''; continue; }
                const chunks = await loadStoredChunks(transferId);
                if (!chunks || chunks.length < transfer.totalChunks) { el.innerHTML = ''; continue; }
                const blob = new Blob(chunks, { type: transfer.contentType || 'application/octet-stream' });
                const blobUrl = URL.createObjectURL(blob);
                _blobUrlCache[transferId] = blobUrl;
                const kind = window.getInlinePreviewKind(transfer.fileName, transfer.contentType);
                if (!kind || kind === 'office') { URL.revokeObjectURL(blobUrl); delete _blobUrlCache[transferId]; el.innerHTML = ''; continue; }
                el.innerHTML = window.renderInlinePreviewHtml({ previewUrl: blobUrl, kind: kind, fileName: transfer.fileName || '', maxWidth: 400 });
                if (kind === 'text' && typeof window.fillTextPreviews === 'function') window.fillTextPreviews(el);
            } catch (e) {
                el.innerHTML = '';
            }
        }
    }

    function formatTaskAttemptLine(attempt) {
        const bits = [
            `- ${attempt?.transferMode === 'relay' ? text('transferTransferModeRelay', 'Relay') : text('transferTransferModeDirect', 'Direct')}`,
            transferStatusLabel(attempt?.stage || ''),
            `${text('transferChunkProgress', 'Chunks')}: ${Number(attempt?.completedChunks || 0)} / ${Number(attempt?.totalChunks || 0)}`,
            `${text('transferLifecycleLabel', 'Lifecycle')}: ${attemptStatusLabel(attempt?.attemptStatus || deriveAttemptStatus(attempt?.stage || ''))}`
        ];
        const idLabel = attempt?.transferMode === 'relay'
            ? text('transferRelayTransferIdLabel', 'Relay Transfer ID')
            : text('transferDirectTransferIdLabel', 'Direct Transfer ID');
        bits.push(`${idLabel}: ${attempt?.transferId || '-'}`);
        if (attempt?.startReason) {
            bits.push(`${text('transferStartReasonLabel', 'Start Reason')}: ${lifecycleReasonLabel(attempt.startReason)}`);
        }
        if (attempt?.endReason) {
            bits.push(`${text('transferEndReasonLabel', 'End Reason')}: ${lifecycleReasonLabel(attempt.endReason)}`);
        }
        if (attempt?.failureReason) {
            bits.push(`${text('transferFailureReasonLabel', 'Failure Reason')}: ${lifecycleReasonLabel(attempt.failureReason)}`);
        }
        if (attempt?.startTime) {
            bits.push(`${text('transferStartedAtLabel', 'Started')}: ${formatTime(attempt.startTime)}`);
        }
        if (attempt?.fallbackAt) {
            bits.push(`${text('transferFallbackAtLabel', 'Fallback At')}: ${formatTime(attempt.fallbackAt)}`);
        }
        if (attempt?.failedAt) {
            bits.push(`${text('transferFailedAtLabel', 'Failed At')}: ${formatTime(attempt.failedAt)}`);
        }
        if (attempt?.completedAt) {
            bits.push(`${text('transferCompletedAtLabel', 'Completed At')}: ${formatTime(attempt.completedAt)}`);
        }
        bits.push(`${text('transferUpdatedAt', 'Updated')}: ${formatTime(attempt?.updateTime)}`);
        return bits.join(' · ');
    }

    function buildDirectTransferDetailValue(transfer) {
        const summary = summarizeTaskAttempts(transfer?.attempts || [], transfer || {});
        const directTransferIds = Array.from(new Set(
            sortTaskAttempts(transfer?.attempts || [])
                .filter(attempt => attempt?.transferMode === 'direct' && attempt?.transferId)
                .map(attempt => String(attempt.transferId))
        ));
        const lines = [
            `${text('transferTaskKeyLabel', 'Task Key')}: ${transfer?.taskKey || '-'}`,
            `${text('transferTaskModeLabel', 'Mode')}: ${text('transferTransferModeDirect', 'Direct')}`,
            `${text('transferTaskStatusLabel', 'Status')}: ${transferStatusLabel(transfer?.stage || '')}`,
            `${text('transferLifecycleLabel', 'Lifecycle')}: ${attemptStatusLabel(transfer?.attemptStatus || summary.attemptStatus || deriveAttemptStatus(transfer?.stage || ''))}`,
            `${text('transferTaskDirectionLabel', 'Direction')}: ${directionLabel(transfer?.direction)}`,
            `${text('transferTaskFileLabel', 'File')}: ${transfer?.fileName || '-'}`,
            `${text('transferTaskSizeLabel', 'Size')}: ${formatSize(transfer?.fileSize)}`,
            `${text('transferTaskPeerLabel', 'Peer')}: ${transfer?.peerLabel || '-'}`,
            `${text('transferChunkProgress', 'Chunks')}: ${Number(transfer?.completedChunks || 0)} / ${Number(transfer?.totalChunks || 0)}`,
            `${text('transferStartedAtLabel', 'Started')}: ${summary.startTime ? formatTime(summary.startTime) : text('transferNotYet', 'Not yet')}`,
            `${text('transferCompletedAtLabel', 'Completed At')}: ${(transfer?.completedAt || summary.completedAt) ? formatTime(transfer?.completedAt || summary.completedAt) : text('transferNotYet', 'Not yet')}`,
            `${text('transferSavedAtLabel', 'Saved To Netdisk')}: ${(transfer?.savedToNetdiskAt || summary.savedToNetdiskAt) ? formatTime(transfer?.savedToNetdiskAt || summary.savedToNetdiskAt) : text('transferNotYet', 'Not yet')}`,
            `${text('transferUpdatedAt', 'Updated')}: ${formatTime(transfer?.updateTime)}`,
            `${text('transferAccountTaskIdLabel', 'Account Task ID')}: ${transfer?.taskId || '-'}`,
            `${text('transferPairTaskIdLabel', 'Pair Task ID')}: ${transfer?.pairTaskId || '-'}`,
            `${text('transferPairSessionLabel', 'Pair Session')}: ${transfer?.pairSessionId || '-'}`
        ];
        if (transfer?.startReason || summary.startReason) {
            lines.push(`${text('transferStartReasonLabel', 'Start Reason')}: ${lifecycleReasonLabel(transfer?.startReason || summary.startReason)}`);
        }
        if (transfer?.endReason || summary.endReason) {
            lines.push(`${text('transferEndReasonLabel', 'End Reason')}: ${lifecycleReasonLabel(transfer?.endReason || summary.endReason)}`);
        }
        if (transfer?.failureReason || summary.failureReason) {
            lines.push(`${text('transferFailureReasonLabel', 'Failure Reason')}: ${lifecycleReasonLabel(transfer?.failureReason || summary.failureReason)}`);
        }
        if (transfer?.fallbackAt || summary.fallbackAt) {
            lines.push(`${text('transferFallbackAtLabel', 'Fallback At')}: ${formatTime(transfer?.fallbackAt || summary.fallbackAt)}`);
        }
        if (transfer?.failedAt || summary.failedAt) {
            lines.push(`${text('transferFailedAtLabel', 'Failed At')}: ${formatTime(transfer?.failedAt || summary.failedAt)}`);
        }

        if (directTransferIds.length) {
            lines.push(`${text('transferDirectTransferIdLabel', 'Direct Transfer ID')}: ${directTransferIds.join(', ')}`);
        }
        if ((transfer?.attempts || []).length) {
            lines.push(`${text('transferTaskAttemptsLabel', 'Attempts')}:`);
            sortTaskAttempts(transfer.attempts).forEach(attempt => {
                lines.push(formatTaskAttemptLine(attempt));
            });
        }
        lines.push(...buildDirectDiagnosticsLines());
        return lines.join('\n');
    }

    async function showDirectTransferDetails(detailId) {
        let transfer = state.displayTransfers.find(item => item.detailId === detailId) || null;
        if (!transfer) {
            const localTransfer = await getStoredTransfer(detailId);
            transfer = localTransfer ? buildDisplayTransferFromLocalTransfer(localTransfer) : null;
        }
        if (!transfer) {
            return;
        }
        const value = buildDirectTransferDetailValue(transfer);

        if (typeof showAppCopyDialog === 'function') {
            await showAppCopyDialog(
                text('transferTaskDetailsHint', 'Task snapshot. Copy it if you need to compare ids or keys across devices.'),
                value,
                {
                    title: text('transferTaskDetailsTitle', 'Task Details'),
                    icon: 'fa-circle-info',
                    multiline: true,
                    confirmText: text('transferClose', 'Close')
                }
            );
            return;
        }

        await showAppAlert(value, {
            title: text('transferTaskDetailsTitle', 'Task Details'),
            icon: 'fa-circle-info'
        });
    }

    async function upsertDirectTransferRecord(transfer, options = {}) {
        const existing = transfer?.id ? await getStoredTransfer(transfer.id) : null;
        let normalized = await putStoredTransfer({
            ...(existing || {}),
            transferMode: 'direct',
            ...transfer,
            startReason: transfer?.startReason || existing?.startReason || inferTransferStartReason(transfer || existing || {}),
            startTime: transfer?.startTime || existing?.startTime || transfer?.createdAt || existing?.createdAt || transfer?.updateTime || existing?.updateTime || nowIso(),
            attemptStatus: transfer?.attemptStatus || deriveAttemptStatus(transfer?.status || existing?.status || '')
        });
        let shouldRefreshPublicPairTasks = false;
        if (options.syncServer !== false) {
            if (canSyncTaskToServer(normalized)) {
                try {
                    const task = await syncDirectAttemptToServer(normalized, options);
                    if (task?.id && task.id !== normalized.taskId) {
                        normalized = await putStoredTransfer({
                            ...normalized,
                            taskId: task.id,
                            updateTime: normalized.updateTime || nowIso()
                        });
                    }
                } catch (error) {
                    console.warn('Failed to sync direct attempt to server:', error);
                }
            } else if (canSyncPublicPairTaskToServer(normalized)) {
                shouldRefreshPublicPairTasks = true;
                try {
                    const pairTask = await syncPublicPairTaskToServer(normalized, options);
                    if (pairTask?.id && pairTask.id !== normalized.pairTaskId) {
                        normalized = await putStoredTransfer({
                            ...normalized,
                            pairTaskId: pairTask.id,
                            updateTime: normalized.updateTime || nowIso()
                        });
                    }
                } catch (error) {
                    console.warn('Failed to sync public pair task to server:', error);
                }
            }
        }
        await refreshStoredTransfers();
        if (shouldRefreshPublicPairTasks) {
            fetchPublicPairTasksFromServer().catch(error => {
                console.warn('Failed to refresh public pair tasks after sync:', error);
            });
        }
        return normalized;
    }

    function createTransferId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID().replace(/-/g, '');
        }
        return `qd-direct-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function buildAllChunkIndexes(totalChunks) {
        return Array.from({ length: Math.max(0, totalChunks) }, (_, index) => index);
    }

    function buildChunkPacket(transferId, chunkIndex, totalChunks, payload) {
        const encoder = new TextEncoder();
        const header = encoder.encode(JSON.stringify({
            transferId,
            chunkIndex,
            totalChunks
        }));
        const body = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
        const packet = new Uint8Array(4 + header.length + body.length);
        const view = new DataView(packet.buffer);
        view.setUint32(0, header.length);
        packet.set(header, 4);
        packet.set(body, 4 + header.length);
        return packet.buffer;
    }

    async function parseChunkPacket(data) {
        const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
        const view = new DataView(buffer);
        const headerLength = view.getUint32(0);
        const headerBytes = buffer.slice(4, 4 + headerLength);
        const payload = buffer.slice(4 + headerLength);
        const decoder = new TextDecoder();
        const header = JSON.parse(decoder.decode(headerBytes));
        return { header, payload };
    }

    function clearSelectedFile() {
        if (state.batchSending) {
            state.selectedFile = null;
            return;
        }
        state.selectedFiles = [];
        state.selectedFile = null;
        const input = document.getElementById('transferDirectFileInput');
        if (input) {
            input.value = '';
        }
        const folderInput = document.getElementById('transferDirectFolderInput');
        if (folderInput) {
            folderInput.value = '';
        }
    }

    function clearAllSelectedFiles() {
        state.batchSending = false;
        state.selectedFiles = [];
        state.selectedFile = null;
        const input = document.getElementById('transferDirectFileInput');
        if (input) {
            input.value = '';
        }
        const folderInput = document.getElementById('transferDirectFolderInput');
        if (folderInput) {
            folderInput.value = '';
        }
    }

    function clearPendingTransfer(transferId) {
        const pending = pendingSessions();
        Object.keys(pending).forEach(key => {
            if (pending[key]?.transferId === transferId) {
                delete pending[key];
            }
        });
        savePendingSessions(pending);
    }

    function registerAcceptWaiter(transferId) {
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                state.acceptWaiters.delete(transferId);
                reject(createDirectError('accept_timeout', text('transferDirectAcceptTimeout', 'The peer did not respond in time')));
            }, TRANSFER_DIRECT_ACCEPT_TIMEOUT_MS);
            state.acceptWaiters.set(transferId, {
                resolve(payload) {
                    clearTimeout(timer);
                    resolve(payload);
                },
                reject(error) {
                    clearTimeout(timer);
                    reject(error);
                }
            });
        });
    }

    async function sendFile(file, options = {}) {
        const currentFile = file || state.selectedFile;
        if (!currentFile) {
            const error = createDirectError('direct_transfer_failed', text('transferDirectChooseFileFirst', 'Choose a file first'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }
        if (!directReady()) {
            const error = createDirectError('direct_link_unavailable', text('transferDirectNeedReady', 'The direct link is not ready yet'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const signalState = getSignalState();
        const peerChannelId = signalState.latestPeerChannelId || '';
        if (!peerChannelId) {
            const error = createDirectError('direct_link_unavailable', text('transferDirectNoPeer', 'Waiting for a paired peer'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }
        const peerDeviceId = signalState.latestPeerDeviceId || extractDeviceId(peerChannelId);
        if (options.expectedPeerDeviceId && peerDeviceId !== String(options.expectedPeerDeviceId).trim()) {
            const error = createDirectError('peer_mismatch', text('transferDirectPeerMismatch', 'The current direct link points to another device'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const pending = pendingSessions();
        const pendingKey = buildPendingKey(currentFile, peerChannelId);
        const existing = pending[pendingKey];
        const transferId = existing?.transferId || createTransferId();
        const totalChunks = Math.max(1, Math.ceil(currentFile.size / TRANSFER_DIRECT_CHUNK_SIZE));
        const taskKey = options.taskKey || existing?.taskKey || `pair:${transferId}`;
        const senderDeviceId = getCurrentDeviceId();
        const receiverDeviceId = peerDeviceId;
        const signalContext = getDirectSignalContext();
        const startReason = options.expectedPeerDeviceId ? 'same_account_direct' : 'pair_session_direct';

        pending[pendingKey] = {
            transferId,
            fileName: currentFile.name,
            fileSize: currentFile.size,
            lastModified: currentFile.lastModified,
            peerChannelId,
            taskKey
        };
        savePendingSessions(pending);

        state.activeSend = {
            transferId,
            fileName: currentFile.name,
            fileSize: currentFile.size,
            contentType: currentFile.type || 'application/octet-stream',
            progress: 0,
            status: 'waiting_accept',
            statusText: text('transferDirectWaitingAccept', 'Waiting for peer resume map'),
            totalChunks,
            sentChunks: 0,
            acknowledgedChunks: 0,
            peerChannelId,
            peerDeviceId,
            senderDeviceId,
            receiverDeviceId,
            pairSessionId: signalContext.pairSessionId,
            selfChannelId: signalContext.selfChannelId,
            selfLabel: signalContext.selfLabel,
            peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            taskKey
        };
        render();
        const initialRecord = await upsertDirectTransferRecord({
            id: transferId,
            taskKey,
            fileName: currentFile.name,
            fileSize: currentFile.size,
            contentType: currentFile.type || 'application/octet-stream',
            totalChunks,
            direction: 'outgoing',
            status: 'sending',
            startReason,
            sentChunks: 0,
            acknowledgedChunks: 0,
            peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            peerDeviceId,
            senderDeviceId,
            receiverDeviceId,
            pairSessionId: signalContext.pairSessionId,
            selfChannelId: signalContext.selfChannelId,
            selfLabel: signalContext.selfLabel,
            updateTime: nowIso()
        });
        if (initialRecord?.taskId) {
            state.activeSend.taskId = initialRecord.taskId;
        }
        if (initialRecord?.pairTaskId) {
            state.activeSend.pairTaskId = initialRecord.pairTaskId;
        }

        try {
            const acceptPromise = registerAcceptWaiter(transferId);
            const offered = TransferSignalManager.sendDirectControl({
                type: 'transfer-offer',
                transferId,
                taskKey,
                taskId: state.activeSend.taskId || null,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                lastModified: currentFile.lastModified || 0,
                chunkSize: TRANSFER_DIRECT_CHUNK_SIZE,
                totalChunks,
                senderLabel: resolveLocalLabel(),
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId
            });
            if (!offered) {
                throw createDirectError('direct_link_unavailable', text('transferDirectNeedReady', 'The direct link is not ready yet'));
            }

            const acceptPayload = await acceptPromise;
            const requestedChunks = Array.isArray(acceptPayload.missingChunks)
                ? acceptPayload.missingChunks.map(item => Number(item)).filter(item => Number.isInteger(item) && item >= 0 && item < totalChunks)
                : buildAllChunkIndexes(totalChunks);
            const alreadyReceived = Math.max(0, totalChunks - requestedChunks.length);

            state.activeSend = {
                transferId,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                progress: totalChunks > 0 ? Math.round((alreadyReceived / totalChunks) * 100) : 0,
                status: 'sending',
                statusText: text('transferDirectSending', 'Sending directly'),
                totalChunks,
                sentChunks: 0,
                acknowledgedChunks: alreadyReceived,
                peerChannelId,
                peerDeviceId,
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId,
                selfChannelId: signalContext.selfChannelId,
                selfLabel: signalContext.selfLabel,
                peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                taskKey,
                taskId: state.activeSend.taskId || null
            };
            render();
            const resumedRecord = await upsertDirectTransferRecord({
                id: transferId,
                taskKey,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                totalChunks,
                direction: 'outgoing',
                status: 'sending',
                startReason,
                sentChunks: 0,
                acknowledgedChunks: alreadyReceived,
                peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                peerDeviceId,
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId,
                selfChannelId: signalContext.selfChannelId,
                selfLabel: signalContext.selfLabel,
                taskId: state.activeSend.taskId || null,
                updateTime: nowIso()
            });
            if (resumedRecord?.taskId) {
                state.activeSend.taskId = resumedRecord.taskId;
            }
            if (resumedRecord?.pairTaskId) {
                state.activeSend.pairTaskId = resumedRecord.pairTaskId;
            }

            let sentCount = 0;
            for (const chunkIndex of requestedChunks) {
                await TransferSignalManager.waitForDirectDrain(TRANSFER_DIRECT_MAX_BUFFERED_AMOUNT);
                const start = chunkIndex * TRANSFER_DIRECT_CHUNK_SIZE;
                const end = Math.min(currentFile.size, start + TRANSFER_DIRECT_CHUNK_SIZE);
                const payload = await currentFile.slice(start, end).arrayBuffer();
                const sent = TransferSignalManager.sendDirectBinary(buildChunkPacket(transferId, chunkIndex, totalChunks, payload));
                if (!sent) {
                    throw createDirectError('direct_link_unavailable', text('transferDirectNeedReady', 'The direct link is not ready yet'));
                }
                sentCount += 1;
                const optimisticCount = alreadyReceived + sentCount;
                state.activeSend = {
                    transferId,
                    fileName: currentFile.name,
                    fileSize: currentFile.size,
                    contentType: currentFile.type || 'application/octet-stream',
                    progress: Math.round((optimisticCount / totalChunks) * 100),
                    status: 'sending',
                    statusText: `${optimisticCount}/${totalChunks} ${text('transferChunkProgress', 'chunks')}`,
                    totalChunks,
                    sentChunks: sentCount,
                    acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                    peerChannelId,
                    peerDeviceId,
                    senderDeviceId,
                    receiverDeviceId,
                    pairSessionId: signalContext.pairSessionId,
                    selfChannelId: signalContext.selfChannelId,
                    selfLabel: signalContext.selfLabel,
                    peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                    taskKey,
                    taskId: state.activeSend.taskId || null
                };
                render();
                await upsertDirectTransferRecord({
                    id: transferId,
                    taskKey,
                    fileName: currentFile.name,
                    fileSize: currentFile.size,
                    contentType: currentFile.type || 'application/octet-stream',
                    totalChunks,
                    direction: 'outgoing',
                    status: 'sending',
                    startReason,
                    sentChunks: sentCount,
                    acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                    peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                    peerDeviceId,
                    senderDeviceId,
                    receiverDeviceId,
                    pairSessionId: signalContext.pairSessionId,
                    selfChannelId: signalContext.selfChannelId,
                    selfLabel: signalContext.selfLabel,
                    taskId: state.activeSend.taskId || null,
                    updateTime: nowIso()
                }, {
                    syncServer: false
                });
            }

            TransferSignalManager.sendDirectControl({
                type: 'transfer-finish',
                transferId
            });
            if (!state.activeSend || state.activeSend.transferId !== transferId || state.activeSend.status !== 'completed') {
                state.activeSend = {
                    transferId,
                    fileName: currentFile.name,
                    fileSize: currentFile.size,
                    contentType: currentFile.type || 'application/octet-stream',
                    progress: 100,
                    status: 'waiting_complete',
                    statusText: text('transferDirectWaitingComplete', 'Waiting for peer to finish storage'),
                    totalChunks,
                    sentChunks: requestedChunks.length,
                    acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                    peerChannelId,
                    peerDeviceId,
                    senderDeviceId,
                    receiverDeviceId,
                    pairSessionId: signalContext.pairSessionId,
                    selfChannelId: signalContext.selfChannelId,
                    selfLabel: signalContext.selfLabel,
                    peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                    taskKey,
                    taskId: state.activeSend.taskId || null
                };
                render();
            }
            await upsertDirectTransferRecord({
                id: transferId,
                taskKey,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                totalChunks,
                direction: 'outgoing',
                status: 'waiting_complete',
                startReason,
                sentChunks: requestedChunks.length,
                acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                peerDeviceId,
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId,
                selfChannelId: signalContext.selfChannelId,
                selfLabel: signalContext.selfLabel,
                taskId: state.activeSend.taskId || null,
                updateTime: nowIso()
            });
            return {
                transferId,
                taskId: state.activeSend.taskId || null,
                pairTaskId: state.activeSend.pairTaskId || null,
                peerChannelId,
                peerDeviceId
            };
        } catch (error) {
            error.transferDirectContext = buildSendContext();
            const failureStage = resolveDirectFailureStage(options);
            const failureReason = error.transferFailureReason || (failureStage === 'relay_fallback'
                ? 'direct_transfer_interrupted'
                : 'direct_transfer_failed');
            state.activeSend = {
                transferId,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                progress: state.activeSend?.progress || 0,
                status: failureStage,
                statusText: failureStage === 'relay_fallback'
                    ? text('transferDirectResumeHint', 'Re-pair and choose the same file again to continue missing chunks')
                    : (error.message || text('transferDirectTransferFailed', 'Direct transfer failed')),
                totalChunks,
                sentChunks: state.activeSend?.sentChunks || 0,
                acknowledgedChunks: state.activeSend?.acknowledgedChunks || 0,
                peerChannelId,
                peerDeviceId,
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId,
                selfChannelId: signalContext.selfChannelId,
                selfLabel: signalContext.selfLabel,
                peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                taskKey,
                taskId: state.activeSend?.taskId || null
            };
            render();
            await upsertDirectTransferRecord({
                id: transferId,
                taskKey,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                totalChunks,
                direction: 'outgoing',
                status: failureStage,
                startReason,
                endReason: failureStage === 'relay_fallback' ? 'relay_fallback' : 'failed',
                failureReason,
                sentChunks: state.activeSend?.sentChunks || 0,
                acknowledgedChunks: state.activeSend?.acknowledgedChunks || 0,
                peerLabel: signalState.latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
                peerDeviceId,
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId,
                selfChannelId: signalContext.selfChannelId,
                selfLabel: signalContext.selfLabel,
                taskId: state.activeSend?.taskId || null,
                updateTime: nowIso()
            });
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }
    }

    async function sendGuestRelayFile(file, options = {}) {
        const currentFile = file || state.selectedFile;
        if (!currentFile) {
            const error = new Error(text('transferDirectChooseFileFirst', 'Choose a file first'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const signalContext = getDirectSignalContext();
        if (!signalContext.pairSessionId) {
            const error = new Error(text('transferDirectNoPeer', 'Waiting for a paired peer'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const created = await transferPublicRequest('/public/transfer/shares', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                senderLabel: resolveLocalLabel(),
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                chunkSize: TRANSFER_GUEST_RELAY_CHUNK_SIZE
            })
        }, isSignedInTransferUser());

        const chunkSize = Number(created.chunkSize || TRANSFER_GUEST_RELAY_CHUNK_SIZE);
        const totalChunks = Number(created.totalChunks || Math.max(1, Math.ceil(currentFile.size / chunkSize)));
        let e2ee = null;
        let encryptKey = null;
        if (window.QuickShareE2EE) {
            if (!state.relayPeerKeyOffer && window.TransferSignalManager?.sendSignal) {
                TransferSignalManager.sendSignal('relay-e2ee-offer-request', { pairSessionId: signalContext.pairSessionId });
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            if (!state.relayPeerKeyOffer || !window.QuickShareE2EE.encryptForRelayRecipient) {
                throw new Error('Recipient encryption key is unavailable');
            }
            const prepared = await window.QuickShareE2EE.encryptForRelayRecipient(state.relayPeerKeyOffer, {
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                chunkSize,
                totalChunks
            });
            encryptKey = prepared.key;
            e2ee = prepared.e2ee;
        }
        state.activeSend = {
            transferId: created.shareToken,
            fileName: currentFile.name,
            fileSize: currentFile.size,
            contentType: currentFile.type || 'application/octet-stream',
            progress: 0,
            status: 'sending',
            statusText: text('transferRelayFallback', 'Direct link is not ready yet, falling back to server relay'),
            totalChunks,
            sentChunks: 0,
            acknowledgedChunks: 0,
            pairSessionId: signalContext.pairSessionId,
            selfChannelId: signalContext.selfChannelId,
            selfLabel: signalContext.selfLabel,
            peerLabel: getSignalState().latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            guestRelay: true
        };
        render();

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(currentFile.size, start + chunkSize);
            const chunk = currentFile.slice(start, end);
            const body = encryptKey
                ? await window.QuickShareE2EE.encryptChunk(encryptKey, chunk, e2ee, chunkIndex)
                : chunk;
            const response = await fetch(`${API_BASE}/public/transfer/shares/${encodeURIComponent(created.shareToken)}/chunks/${chunkIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    ...(isSignedInTransferUser() && typeof getAuthHeaders === 'function' ? getAuthHeaders() : {})
                },
                body
            });
            const textBody = await response.text();
            const result = textBody ? JSON.parse(textBody) : null;
            if (!response.ok || !result || result.code !== 200) {
                throw new Error(result?.message || 'Transfer relay upload failed');
            }
            const uploadedChunks = Number(result.data?.uploadedChunks || (chunkIndex + 1));
            state.activeSend = {
                ...state.activeSend,
                progress: Math.round((uploadedChunks / totalChunks) * 100),
                sentChunks: uploadedChunks,
                statusText: `${uploadedChunks}/${totalChunks} ${text('transferChunkProgress', 'chunks')}`
            };
            render();
        }

        if (window.TransferSignalManager?.sendSignal) {
            TransferSignalManager.sendSignal('relay-done', {
                shareToken: created.shareToken,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                senderLabel: resolveLocalLabel(),
                e2ee
            });
        }
        state.activeSend = {
            ...state.activeSend,
            progress: 100,
            status: 'completed',
            statusText: text('transferSendSuccess', 'File is ready on the target device')
        };
        render();
        showToast(text('transferSendSuccess', 'File is ready on the target device'), 'success');
        return created;
    }

    async function sendDirectFile() {
        try {
            if (!state.selectedFiles.length) {
                if (!isSignedInTransferUser() && !directReady()) {
                    return await sendGuestRelayFile(state.selectedFile);
                }
                return await sendFile(state.selectedFile);
            }
            state.batchSending = state.selectedFiles.length > 1;
            let lastResult = null;
            for (const item of state.selectedFiles) {
                if (isSignedInTransferUser()) {
                    lastResult = await sendFile(item.file);
                    continue;
                }
                try {
                    if (!directReady()) {
                        throw new Error(text('transferRelayFallback', 'Direct link is not ready yet, falling back to server relay'));
                    }
                    lastResult = await sendFile(item.file, {
                        silentError: true
                    });
                } catch (error) {
                    showToast(text('transferRelayFallback', 'Direct link is not ready yet, falling back to server relay'), 'warning');
                    lastResult = await sendGuestRelayFile(item.file, {
                        silentError: true
                    });
                }
            }
            clearAllSelectedFiles();
            render();
            return lastResult;
        } catch (error) {
            return null;
        } finally {
            state.batchSending = false;
        }
    }

    async function ensureReceivingSession(message) {
        const existingTransfer = await getStoredTransfer(message.transferId);
        if (existingTransfer
            && (existingTransfer.fileName !== message.fileName || Number(existingTransfer.fileSize) !== Number(message.fileSize))) {
            await deleteStoredTransfer(message.transferId);
        }

        const storedChunkIndexes = new Set(await listStoredChunkIndexes(message.transferId));
        const transfer = await putStoredTransfer({
            id: message.transferId,
            taskKey: message.taskKey || '',
            taskId: message.taskId || existingTransfer?.taskId || null,
            pairTaskId: message.pairTaskId || existingTransfer?.pairTaskId || null,
            fileName: message.fileName,
            fileSize: message.fileSize,
            contentType: message.contentType || 'application/octet-stream',
            totalChunks: Number(message.totalChunks) || 1,
            chunkSize: Number(message.chunkSize) || TRANSFER_DIRECT_CHUNK_SIZE,
            lastModified: Number(message.lastModified) || 0,
            peerLabel: message.senderLabel || getSignalState().latestPeerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            peerDeviceId: message.senderDeviceId || existingTransfer?.peerDeviceId || '',
            senderDeviceId: message.senderDeviceId || existingTransfer?.senderDeviceId || '',
            receiverDeviceId: message.receiverDeviceId || existingTransfer?.receiverDeviceId || getCurrentDeviceId() || '',
            pairSessionId: message.pairSessionId || existingTransfer?.pairSessionId || getDirectSignalContext().pairSessionId,
            selfChannelId: getDirectSignalContext().selfChannelId,
            selfLabel: getDirectSignalContext().selfLabel,
            receivedChunks: storedChunkIndexes.size,
            status: storedChunkIndexes.size >= (Number(message.totalChunks) || 1) ? 'ready' : 'receiving',
            startReason: message.senderDeviceId && message.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct',
            startTime: existingTransfer?.startTime || existingTransfer?.createdAt || nowIso(),
            createdAt: existingTransfer?.createdAt || nowIso(),
            updateTime: nowIso(),
            direction: 'incoming',
            transferMode: 'direct'
        });

        const session = {
            transfer,
            receivedIndexes: storedChunkIndexes
        };
        state.receivingSessions.set(message.transferId, session);
        await refreshStoredTransfers();
        return session;
    }

    async function handleTransferOffer(message) {
        const session = await ensureReceivingSession(message);
        session.transfer = await upsertDirectTransferRecord({
            ...session.transfer,
            taskId: message.taskId || session.transfer.taskId || null,
            senderDeviceId: message.senderDeviceId || session.transfer.senderDeviceId || '',
            receiverDeviceId: message.receiverDeviceId || session.transfer.receiverDeviceId || getCurrentDeviceId(),
            peerDeviceId: message.senderDeviceId || session.transfer.peerDeviceId || '',
            startReason: session.transfer.startReason || (message.senderDeviceId && message.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct'),
            updateTime: nowIso()
        });
        const missingChunks = buildAllChunkIndexes(session.transfer.totalChunks)
            .filter(index => !session.receivedIndexes.has(index));

        TransferSignalManager.sendDirectControl({
            type: 'transfer-accept',
            transferId: message.transferId,
            totalChunks: session.transfer.totalChunks,
            receivedCount: session.receivedIndexes.size,
            missingChunks
        });

        showToast(
            missingChunks.length === session.transfer.totalChunks
                ? text('transferDirectOfferReady', 'Direct transfer is ready to receive')
                : text('transferDirectResumeReady', 'Existing chunks found, only missing chunks will continue'),
            'success'
        );
    }

    async function handleTransferProgress(message) {
        if (!state.activeSend || state.activeSend.transferId !== message.transferId) {
            return;
        }
        const totalChunks = Number(message.totalChunks) || 1;
        const receivedCount = Math.max(0, Number(message.receivedCount) || 0);
        state.activeSend = {
            ...state.activeSend,
            progress: Math.round((receivedCount / totalChunks) * 100),
            status: receivedCount >= totalChunks ? 'completed' : 'sending',
            statusText: `${receivedCount}/${totalChunks} ${text('transferChunkProgress', 'chunks')}`,
            acknowledgedChunks: receivedCount,
            totalChunks
        };
        render();
        await upsertDirectTransferRecord({
            id: message.transferId,
            taskKey: state.activeSend.taskKey || '',
            taskId: state.activeSend.taskId || null,
            fileName: state.activeSend.fileName,
            fileSize: state.activeSend.fileSize,
            contentType: state.activeSend.contentType || 'application/octet-stream',
            totalChunks,
            direction: 'outgoing',
            status: receivedCount >= totalChunks ? 'completed' : 'sending',
            startReason: state.activeSend?.senderDeviceId && state.activeSend?.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct',
            endReason: receivedCount >= totalChunks ? 'peer_confirmed' : '',
            sentChunks: state.activeSend.sentChunks || receivedCount,
            acknowledgedChunks: receivedCount,
            peerLabel: state.activeSend.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            peerDeviceId: state.activeSend.peerDeviceId,
            senderDeviceId: state.activeSend.senderDeviceId || '',
            receiverDeviceId: state.activeSend.receiverDeviceId || '',
            updateTime: nowIso()
        });
    }

    function handleTransferAccept(message) {
        const waiter = state.acceptWaiters.get(message.transferId);
        if (!waiter) {
            return;
        }
        state.acceptWaiters.delete(message.transferId);
        waiter.resolve(message);
    }

    function handleTransferError(message) {
        const waiter = state.acceptWaiters.get(message.transferId);
        if (waiter) {
            state.acceptWaiters.delete(message.transferId);
            waiter.reject(createDirectError(message.reason || 'peer_reported_error', message.error || text('transferDirectTransferFailed', 'Direct transfer failed')));
        }
        if (state.activeSend?.transferId === message.transferId) {
            state.activeSend = {
                ...state.activeSend,
                statusText: message.error || text('transferDirectTransferFailed', 'Direct transfer failed')
            };
            render();
        }
        const failureStage = resolveDirectFailureStage({
            expectedPeerDeviceId: state.activeSend?.receiverDeviceId || ''
        });
        upsertDirectTransferRecord({
            id: message.transferId,
            taskKey: state.activeSend?.taskKey || '',
            taskId: state.activeSend?.taskId || null,
            fileName: state.activeSend?.fileName || message.fileName || `direct-${message.transferId}`,
            fileSize: state.activeSend?.fileSize || 0,
            contentType: state.activeSend?.contentType || 'application/octet-stream',
            totalChunks: state.activeSend?.totalChunks || 0,
            direction: 'outgoing',
            status: failureStage,
            startReason: state.activeSend?.senderDeviceId && state.activeSend?.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct',
            endReason: failureStage === 'relay_fallback' ? 'relay_fallback' : 'failed',
            failureReason: message.reason || 'peer_reported_error',
            sentChunks: state.activeSend?.sentChunks || 0,
            acknowledgedChunks: state.activeSend?.acknowledgedChunks || 0,
            peerLabel: state.activeSend?.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            peerDeviceId: state.activeSend?.peerDeviceId || '',
            senderDeviceId: state.activeSend?.senderDeviceId || '',
            receiverDeviceId: state.activeSend?.receiverDeviceId || '',
            updateTime: nowIso()
        }).catch(() => {});
        showToast(message.error || text('transferDirectTransferFailed', 'Direct transfer failed'), 'error');
    }

    function handleTransferComplete(message) {
        if (!state.activeSend || state.activeSend.transferId !== message.transferId) {
            return;
        }
        clearPendingTransfer(message.transferId);
        clearSelectedFile();
        state.activeSend = {
            ...state.activeSend,
            progress: 100,
            status: 'completed',
            statusText: text('transferDirectComplete', 'Direct transfer complete'),
            acknowledgedChunks: state.activeSend?.totalChunks || state.activeSend?.acknowledgedChunks || 0
        };
        render();
        upsertDirectTransferRecord({
            id: message.transferId,
            taskKey: state.activeSend.taskKey || '',
            taskId: state.activeSend.taskId || null,
            fileName: state.activeSend.fileName,
            fileSize: state.activeSend.fileSize || 0,
            contentType: state.activeSend.contentType || 'application/octet-stream',
            totalChunks: state.activeSend.totalChunks || 0,
            direction: 'outgoing',
            status: 'completed',
            startReason: state.activeSend?.senderDeviceId && state.activeSend?.receiverDeviceId ? 'same_account_direct' : 'pair_session_direct',
            endReason: 'peer_confirmed',
            sentChunks: state.activeSend.sentChunks || state.activeSend.totalChunks || 0,
            acknowledgedChunks: state.activeSend.totalChunks || state.activeSend.acknowledgedChunks || 0,
            peerLabel: state.activeSend.peerLabel || text('transferDirectPeerFallback', 'Paired peer'),
            peerDeviceId: state.activeSend.peerDeviceId || '',
            senderDeviceId: state.activeSend.senderDeviceId || '',
            receiverDeviceId: state.activeSend.receiverDeviceId || '',
            updateTime: nowIso()
        }).catch(() => {});
        showToast(text('transferDirectSendSuccess', 'Direct transfer is ready on the peer device'), 'success');
    }

    async function handleTransferFinish(message) {
        const transfer = await getStoredTransfer(message.transferId);
        if (!transfer || transfer.status !== 'ready') {
            return;
        }
        TransferSignalManager.sendDirectControl({
            type: 'transfer-complete',
            transferId: message.transferId,
            totalChunks: transfer.totalChunks,
            receivedCount: transfer.receivedChunks || transfer.totalChunks
        });
    }

    async function handleControlMessage(message) {
        if (!message || typeof message.type !== 'string' || message.type === 'hello') {
            return;
        }
        if (message.type === 'transfer-offer') {
            await handleTransferOffer(message);
            return;
        }
        if (message.type === 'transfer-accept') {
            handleTransferAccept(message);
            return;
        }
        if (message.type === 'transfer-progress') {
            await handleTransferProgress(message);
            return;
        }
        if (message.type === 'transfer-complete') {
            handleTransferComplete(message);
            return;
        }
        if (message.type === 'transfer-error') {
            handleTransferError(message);
            return;
        }
        if (message.type === 'transfer-finish') {
            await handleTransferFinish(message);
        }
    }

    async function handleBinaryMessage(data) {
        const { header, payload } = await parseChunkPacket(data);
        if (!header.transferId || !Number.isInteger(Number(header.chunkIndex))) {
            return;
        }

        let session = state.receivingSessions.get(header.transferId);
        if (!session) {
            const transfer = await getStoredTransfer(header.transferId);
            if (!transfer) {
                TransferSignalManager.sendDirectControl({
                    type: 'transfer-error',
                    transferId: header.transferId,
                    reason: 'peer_missed_offer',
                    error: text('transferDirectMissingOffer', 'The receiver missed the direct transfer offer')
                });
                return;
            }
            session = {
                transfer,
                receivedIndexes: new Set(await listStoredChunkIndexes(header.transferId))
            };
            state.receivingSessions.set(header.transferId, session);
        }

        const chunkIndex = Number(header.chunkIndex);
        if (!session.receivedIndexes.has(chunkIndex)) {
            await putStoredChunk(header.transferId, chunkIndex, payload);
            session.receivedIndexes.add(chunkIndex);
        }

        const receivedCount = session.receivedIndexes.size;
        const ready = receivedCount >= session.transfer.totalChunks;
        session.transfer = await upsertDirectTransferRecord({
            ...session.transfer,
            receivedChunks: receivedCount,
            status: ready ? 'ready' : 'receiving',
            updateTime: nowIso()
        }, {
            syncServer: ready || receivedCount % 8 === 0
        });

        if (ready || receivedCount % 8 === 0) {
            TransferSignalManager.sendDirectControl({
                type: 'transfer-progress',
                transferId: header.transferId,
                totalChunks: session.transfer.totalChunks,
                receivedCount
            });
        }

        if (ready) {
            TransferSignalManager.sendDirectControl({
                type: 'transfer-complete',
                transferId: header.transferId,
                totalChunks: session.transfer.totalChunks,
                receivedCount
            });
            showToast(text('transferDirectReceiveReady', 'Direct transfer is ready to download'), 'success');
            presentIncomingArrivalDialog(header.transferId).catch(error => {
                console.warn('Failed to show incoming transfer dialog:', error);
            });
        }
    }

    async function downloadTransfer(transferId) {
        const transfer = await getStoredTransfer(transferId);
        if (!transfer || (transfer.status !== 'ready' && transfer.status !== 'completed')) {
            showToast(text('transferDirectNotReady', 'The direct transfer is not ready yet'), 'error');
            return;
        }
        const chunks = await loadStoredChunks(transferId);
        if (chunks.length < transfer.totalChunks) {
            showToast(text('transferDirectCorrupt', 'Some chunks are still missing'), 'error');
            return;
        }
        const blob = new Blob(chunks, {
            type: transfer.contentType || 'application/octet-stream'
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = transfer.fileName || `transfer-${transferId}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        await upsertDirectTransferRecord({
            ...transfer,
            status: 'completed',
            endReason: 'downloaded',
            updateTime: nowIso(),
            completedAt: transfer.completedAt || nowIso()
        }, {
            downloaded: true
        });
    }

    async function saveTransferToNetdisk(transferId, folderId = 0) {
        if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
            if (typeof showAppAlert === 'function') {
                await showAppAlert(text('transferLoginRequired', 'Please sign in before using Transfer'), {
                    icon: 'fa-right-to-bracket'
                });
            }
            window.location.href = 'login.html';
            throw new Error(text('transferLoginRequired', 'Please sign in before using Transfer'));
        }

        const transfer = await getStoredTransfer(transferId);
        if (!transfer || (transfer.status !== 'ready' && transfer.status !== 'completed')) {
            throw new Error(text('transferDirectNotReady', 'The direct transfer is not ready yet'));
        }
        const chunks = await loadStoredChunks(transferId);
        if (chunks.length < transfer.totalChunks) {
            throw new Error(text('transferDirectCorrupt', 'Some chunks are still missing'));
        }

        const blob = new Blob(chunks, {
            type: transfer.contentType || 'application/octet-stream'
        });
        const formData = new FormData();
        formData.append('file', blob, transfer.fileName || `transfer-${transferId}`);
        formData.append('folderId', String(Number(folderId) || 0));

        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders()
            },
            body: formData
        });
        const textBody = await response.text();
        const result = textBody ? JSON.parse(textBody) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'Save direct transfer failed');
        }

        await upsertDirectTransferRecord({
            ...transfer,
            status: 'completed',
            endReason: 'saved_to_netdisk',
            savedToNetdiskAt: nowIso(),
            savedFileId: result.data?.id || null,
            updateTime: nowIso()
        }, {
            savedToNetdisk: true
        });
        showToast(text('transferSavedToNetdisk', 'Saved to your netdisk'), 'success');
        return result.data;
    }

    function shouldShowIncomingArrivalDialog() {
        const loggedIn = typeof isLoggedIn === 'function' && isLoggedIn();
        if (!loggedIn) {
            return true;
        }
        return window.transferState?.currentMode === 'temporary' || window.transferState?.accountMode === false;
    }

    async function presentIncomingArrivalDialog(transferId) {
        if (!shouldShowIncomingArrivalDialog() || state.announcedIncomingTransfers.has(transferId)) {
            return;
        }
        state.announcedIncomingTransfers.add(transferId);

        const transfer = await getStoredTransfer(transferId);
        if (!transfer) {
            return;
        }

        const previewKind = getTransferPreviewKind(transfer);
        const canPreview = Boolean(previewKind);
        const message = [
            `${text('transferSender', 'Sender')}: ${transfer.peerLabel || text('transferDirectPeerFallback', 'Paired peer')}`,
            `${text('transferTaskFileLabel', 'File')}: ${transfer.fileName || '-'}`,
            `${text('transferTaskSizeLabel', 'Size')}: ${formatSize(transfer.fileSize)}`,
            `${text('transferTaskStatusLabel', 'Status')}: ${transferStatusLabel(transfer.status || '')}`
        ].join('\n');

        if (typeof showAppConfirm !== 'function') {
            showToast(text('transferDirectReceiveReady', 'Direct transfer is ready to download'), 'success');
            return;
        }

        const confirmed = await showAppConfirm(message, {
            title: text('transferIncomingNoticeSingle', 'A file arrived on this device'),
            icon: 'fa-file-arrow-down',
            confirmText: canPreview ? text('previewBtn', 'Preview') : text('transferDownload', 'Download'),
            cancelText: text('transferClose', 'Close')
        });
        if (!confirmed) {
            return;
        }
        if (canPreview) {
            await openPreviewWindow(transferId);
            return;
        }
        await downloadTransfer(transferId);
    }

    async function openPreviewWindow(transferId) {
        const transfer = await getStoredTransfer(transferId);
        if (!transfer || (transfer.status !== 'ready' && transfer.status !== 'completed')) {
            throw new Error(text('transferDirectNotReady', 'The direct transfer is not ready yet'));
        }

        const previewKind = getTransferPreviewKind(transfer);
        if (!previewKind) {
            throw new Error(text('cannotPreview', 'This file type cannot be previewed'));
        }

        const chunks = await loadStoredChunks(transferId);
        if (chunks.length < transfer.totalChunks) {
            throw new Error(text('transferDirectCorrupt', 'Some chunks are still missing'));
        }

        const blob = new Blob(chunks, {
            type: transfer.contentType || 'application/octet-stream'
        });
        const blobUrl = URL.createObjectURL(blob);
        const fileName = transfer.fileName || `transfer-${transferId}`;

        if (previewKind === 'pdf') {
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(blobUrl)}&name=${encodeURIComponent(fileName)}&kind=pdf`;
            window.open(viewerUrl, '_blank', 'noopener');
        } else {
            window.open(blobUrl, '_blank', 'noopener');
        }
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
    }

    function buildPublicShareDownloadUrl(shareToken) {
        return `${API_BASE}/public/transfer/shares/${encodeURIComponent(shareToken)}/download`;
    }

    function buildPublicSharePreviewUrl(shareToken) {
        return `${API_BASE}/public/transfer/shares/${encodeURIComponent(shareToken)}/preview`;
    }

    function openPublicSharePreviewWindow(shareToken, fileName, contentType) {
        const previewKind = getGuestRelayPreviewKind(fileName, contentType);
        if (!previewKind) {
            throw new Error(text('cannotPreview', 'This file type cannot be previewed'));
        }
        const previewUrl = buildPublicSharePreviewUrl(shareToken);
        const downloadUrl = buildPublicShareDownloadUrl(shareToken);
        if (previewKind === 'pdf' || previewKind === 'office') {
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(previewUrl)}&download=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(fileName || 'preview')}&kind=${previewKind === 'office' ? 'office' : 'pdf'}`;
            window.open(viewerUrl, '_blank', 'noopener');
            return;
        }
        window.open(previewUrl, '_blank', 'noopener');
    }

    async function openEncryptedPublicSharePreviewWindow(shareToken, fileName, contentType, e2ee) {
        const previewKind = getGuestRelayPreviewKind(fileName, contentType);
        if (!previewKind || previewKind === 'office') {
            throw new Error(text('cannotPreview', 'This file type cannot be previewed'));
        }
        const encryptedUrl = buildPublicShareDownloadUrl(shareToken);
        const blob = await window.QuickShareE2EE.fetchAndDecrypt(encryptedUrl, e2ee);
        const blobUrl = URL.createObjectURL(blob);
        if (previewKind === 'pdf') {
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(blobUrl)}&download=${encodeURIComponent(blobUrl)}&name=${encodeURIComponent(fileName || 'preview')}&kind=pdf`;
            window.open(viewerUrl, '_blank', 'noopener');
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
            return;
        }
        window.open(blobUrl, '_blank', 'noopener');
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
    }

    async function presentRelayShareArrivalDialog(payload) {
        const shareToken = String(payload?.shareToken || '').trim();
        if (!shareToken || state.announcedRelayShares.has(shareToken)) {
            return;
        }
        state.announcedRelayShares.add(shareToken);

        const fileName = payload?.fileName || 'transfer-file';
        const fileSize = Number(payload?.fileSize || 0);
        const contentType = payload?.contentType || 'application/octet-stream';
        const e2ee = payload?.e2ee || null;
        const senderLabel = payload?.senderLabel || text('transferDirectPeerFallback', 'Paired peer');
        const previewKind = getGuestRelayPreviewKind(fileName, contentType);
        const canPreview = Boolean(previewKind && !(e2ee?.encrypted && previewKind === 'office'));
        const message = [
            `${text('transferSender', 'Sender')}: ${senderLabel}`,
            `${text('transferTaskFileLabel', 'File')}: ${fileName}`,
            `${text('transferTaskSizeLabel', 'Size')}: ${formatSize(fileSize)}`,
            `${text('transferTaskStatusLabel', 'Status')}: ${text('transferStatusReady', 'Ready to Download')}`
        ].join('\n');

        if (typeof showAppConfirm !== 'function') {
            showToast(text('transferSendSuccess', 'File is ready on the target device'), 'success');
            return;
        }

        const confirmed = await showAppConfirm(message, {
            title: text('transferIncomingNoticeSingle', 'A file arrived on this device'),
            icon: 'fa-file-arrow-down',
            confirmText: canPreview ? text('previewBtn', 'Preview') : text('transferDownload', 'Download'),
            cancelText: text('transferClose', 'Close')
        });
        if (!confirmed) {
            return;
        }
        if (canPreview) {
            if (e2ee?.encrypted && window.QuickShareE2EE) {
                openEncryptedPublicSharePreviewWindow(shareToken, fileName, contentType, e2ee)
                    .catch(error => showToast(error.message, 'error'));
                return;
            }
            openPublicSharePreviewWindow(shareToken, fileName, contentType);
            return;
        }
        if (e2ee?.encrypted && window.QuickShareE2EE) {
            window.QuickShareE2EE.downloadDecrypted(buildPublicShareDownloadUrl(shareToken), e2ee, fileName)
                .catch(error => showToast(error.message || 'Decrypt failed', 'error'));
            return;
        }
        window.location.href = buildPublicShareDownloadUrl(shareToken);
    }

    async function deleteServerPairTaskSnapshot(snapshot, options = {}) {
        if (!snapshot?.pairTaskId || !snapshot?.deleteServerTransferId) {
            return;
        }
        if (!options.skipConfirm) {
            const confirmed = await showAppConfirm(text('transferDirectDeleteConfirm', 'Delete this direct transfer from this browser?'), {
                title: text('transferDelete', 'Delete'),
                tone: 'danger',
                icon: 'fa-trash',
                confirmText: text('transferDelete', 'Delete')
            });
            if (!confirmed) {
                return;
            }
        }
        try {
            await deletePublicPairTaskAttemptFromServer({
                id: snapshot.deleteServerTransferId,
                pairTaskId: snapshot.pairTaskId,
                pairSessionId: snapshot.pairSessionId,
                selfChannelId: getPairTaskListContext()?.selfChannelId || ''
            });
        } catch (error) {
            console.warn('Failed to delete public pair task attempt from server:', error);
            throw error;
        }
        await fetchPublicPairTasksFromServer().catch(fetchError => {
            console.warn('Failed to refresh public pair tasks after delete:', fetchError);
        });
    }

    async function deleteTransfer(transferId, options = {}) {
        if (!options.skipConfirm) {
            const confirmed = await showAppConfirm(text('transferDirectDeleteConfirm', 'Delete this direct transfer from this browser?'), {
                title: text('transferDelete', 'Delete'),
                tone: 'danger',
                icon: 'fa-trash',
                confirmText: text('transferDelete', 'Delete')
            });
            if (!confirmed) {
                return;
            }
        }
        const existingTransfer = await getStoredTransfer(transferId);
        if (!options.skipServerSync && existingTransfer?.taskId) {
            try {
                await deleteDirectAttemptFromServer(existingTransfer);
            } catch (error) {
                console.warn('Failed to delete direct attempt from server:', error);
            }
        }
        if (!options.skipServerSync && existingTransfer?.pairTaskId) {
            try {
                await deletePublicPairTaskAttemptFromServer(existingTransfer);
            } catch (error) {
                console.warn('Failed to delete public pair task attempt from server:', error);
            }
        }
        await deleteStoredTransfer(transferId);
        clearPendingTransfer(transferId);
        state.receivingSessions.delete(transferId);
        await refreshStoredTransfers();
        if (!options.skipServerSync && existingTransfer?.pairTaskId) {
            fetchPublicPairTasksFromServer().catch(error => {
                console.warn('Failed to refresh public pair tasks after local delete:', error);
            });
        }
    }

    async function cleanupStoredTransfers() {
        const now = Date.now();
        const transfers = await listStoredTransfers();
        for (const transfer of transfers) {
            const savedAge = transfer.savedToNetdiskAt ? now - new Date(transfer.savedToNetdiskAt).getTime() : 0;
            const completedAge = transfer.completedAt ? now - new Date(transfer.completedAt).getTime() : 0;
            const shouldDelete = (transfer.savedToNetdiskAt && savedAge > TRANSFER_DIRECT_SAVED_RETENTION_MS)
                || (transfer.completedAt && completedAge > TRANSFER_DIRECT_COMPLETED_RETENTION_MS);
            if (!shouldDelete) {
                continue;
            }
            await deleteTransfer(transfer.id, {
                skipConfirm: true
            });
        }
    }

    function openFilePicker() {
        closePickerMenu();
        const input = document.getElementById('transferDirectFileInput');
        if (input) {
            input.click();
        }
    }

    function openFolderPicker() {
        closePickerMenu();
        const input = document.getElementById('transferDirectFolderInput');
        if (input) {
            input.click();
        }
    }

    function togglePickerMenu() {
        state.pickerMenuOpen = !state.pickerMenuOpen;
        renderPickerMenu();
    }

    function closePickerMenu() {
        if (!state.pickerMenuOpen) {
            return;
        }
        state.pickerMenuOpen = false;
        renderPickerMenu();
    }

    function handleFileChange(event) {
        setSelectedFiles(Array.from(event.target.files || []));
        closePickerMenu();
        render();
    }

    function getDirectSaveFolderId() {
        return Number(
            document.getElementById('transferDirectSaveFolderSelect')?.value
            || document.getElementById('transferSaveFolderSelect')?.value
            || document.getElementById('transferPublicSaveFolderSelect')?.value
            || 0
        );
    }

    function bindUi() {
        const input = document.getElementById('transferDirectFileInput');
        const folderInput = document.getElementById('transferDirectFolderInput');
        const list = document.getElementById('transferDirectTransferList');

        if (input) {
            input.addEventListener('change', handleFileChange);
        }
        if (folderInput) {
            folderInput.addEventListener('change', handleFileChange);
        }

        document.addEventListener('click', event => {
            if (!event.target.closest('#transferDirectPickerShell')) {
                closePickerMenu();
            }
        });

        if (list) {
            list.addEventListener('click', event => {
                const downloadButton = event.target.closest('[data-transfer-direct-download]');
                if (downloadButton) {
                    downloadTransfer(downloadButton.getAttribute('data-transfer-direct-download'));
                    return;
                }
                const saveButton = event.target.closest('[data-transfer-direct-save]');
                if (saveButton) {
                    saveTransferToNetdisk(saveButton.getAttribute('data-transfer-direct-save'), getDirectSaveFolderId())
                        .catch(error => showToast(error.message, 'error'));
                    return;
                }
                const detailButton = event.target.closest('[data-transfer-direct-detail]');
                if (detailButton) {
                    showDirectTransferDetails(detailButton.getAttribute('data-transfer-direct-detail'));
                    return;
                }
                const deleteButton = event.target.closest('[data-transfer-direct-delete]');
                if (deleteButton) {
                    deleteTransfer(deleteButton.getAttribute('data-transfer-direct-delete'));
                    return;
                }
                const deleteTaskButton = event.target.closest('[data-transfer-direct-delete-task]');
                if (deleteTaskButton) {
                    const snapshot = state.displayTransfers.find(item => item.detailId === deleteTaskButton.getAttribute('data-transfer-direct-delete-task'));
                    if (snapshot) {
                        deleteServerPairTaskSnapshot(snapshot).catch(error => {
                            showToast(error.message, 'error');
                        });
                    }
                }
            });
        }

        document.addEventListener('transfer:direct-statechange', () => {
            if (state.activeSend && !directReady() && !state.activeSend.fallbackToRelay) {
                state.activeSend = {
                    ...state.activeSend,
                    statusText: text('transferDirectResumeHint', 'Re-pair and choose the same file again to continue missing chunks')
                };
            }
            syncPublicPairTaskPolling();
            render();
        });

        document.addEventListener('transfer:signal-message', event => {
            const payload = event.detail || {};
            if (payload.type === 'pair-ready') {
                announceRelayRecipientKey(payload.pairSessionId).catch(error => console.warn('Failed to announce relay E2EE key:', error));
            }
            if (payload.type === 'signal' && payload.signalType === 'relay-e2ee-offer' && payload.payload) {
                state.relayPeerKeyOffer = payload.payload;
            }
            if (payload.type === 'signal' && payload.signalType === 'relay-e2ee-offer-request') {
                announceRelayRecipientKey(payload.payload?.pairSessionId).catch(error => console.warn('Failed to answer relay E2EE key request:', error));
            }
            if (payload.type === 'signal' && payload.signalType === 'relay-done' && payload.payload) {
                Promise.resolve(payload.payload.e2ee)
                    .then(e2ee => completeIncomingRelayE2ee(e2ee))
                    .then(e2ee => presentRelayShareArrivalDialog({ ...payload.payload, e2ee }))
                    .catch(error => {
                    showToast(error.message, 'error');
                });
            }
            syncPublicPairTaskPolling();
            renderPeer();
        });

        document.addEventListener('transfer:direct-control', event => {
            handleControlMessage(event.detail?.message || event.detail).catch(error => {
                showToast(error.message, 'error');
            });
        });

        document.addEventListener('transfer:direct-binary', event => {
            state.receiveQueue = state.receiveQueue
                .then(() => handleBinaryMessage(event.detail?.data))
                .catch(error => {
                    showToast(error.message, 'error');
                });
        });

        document.addEventListener('quickshare:languagechange', render);
    }

    async function init() {
        if (!document.getElementById('transferDirectSelectedFile')) {
            return;
        }
        bindUi();
        await cleanupStoredTransfers();
        await refreshStoredTransfers();
        syncPublicPairTaskPolling();
        render();
        setInterval(() => cleanupStoredTransfers().catch(() => {}), TRANSFER_DIRECT_CLEANUP_INTERVAL_MS);
    }

    return {
        init,
        openFilePicker,
        openFolderPicker,
        togglePickerMenu,
        sendDirectFile,
        sendFile,
        markFallbackToRelay(context = {}) {
            if (!state.activeSend) {
                return;
            }
            if (context.transferId && state.activeSend.transferId !== context.transferId) {
                return;
            }
            state.activeSend = {
                ...state.activeSend,
                fallbackToRelay: true,
                statusText: text('transferDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay')
            };
            render();
        },
        canSendToPeerDevice(deviceId) {
            const normalizedDeviceId = String(deviceId || '').trim();
            if (!normalizedDeviceId || !directReady()) {
                return false;
            }
            const signalState = getSignalState();
            const peerDeviceId = signalState.latestPeerDeviceId || extractDeviceId(signalState.latestPeerChannelId);
            return peerDeviceId === normalizedDeviceId;
        },
        getTransfers(direction) {
            if (direction === 'incoming') {
                return [...state.incomingTransfers];
            }
            if (direction === 'outgoing') {
                return [...state.outgoingTransfers];
            }
            return [...state.incomingTransfers, ...state.outgoingTransfers];
        },
        recordSameAccountRelayFallbackAttempt,
        downloadTransfer,
        openPreviewWindow,
        deleteTransfer,
        saveTransferToNetdisk,
        // Exposed for browser automation and packet compatibility checks.
        buildChunkPacket
    };
})();

window.TransferDirectTransfer = TransferDirectTransfer;
window.openTransferDirectFilePicker = () => TransferDirectTransfer.openFilePicker();
window.openTransferDirectFolderPicker = () => TransferDirectTransfer.openFolderPicker();
window.toggleTransferDirectPickerMenu = () => TransferDirectTransfer.togglePickerMenu();
window.sendTransferDirectFile = () => TransferDirectTransfer.sendDirectFile();

document.addEventListener('DOMContentLoaded', () => {
    TransferDirectTransfer.init();
});
