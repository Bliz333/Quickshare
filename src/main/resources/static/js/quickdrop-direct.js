const QUICKDROP_DIRECT_DB_NAME = 'quickdrop-direct-v1';
const QUICKDROP_DIRECT_TRANSFER_STORE = 'transfers';
const QUICKDROP_DIRECT_CHUNK_STORE = 'chunks';
const QUICKDROP_DIRECT_PENDING_KEY = 'quickdrop-direct-pending';
const QUICKDROP_DIRECT_DEVICE_ID_KEY = 'quickdrop-device-id';
const QUICKDROP_DIRECT_CHUNK_SIZE = 64 * 1024;
const QUICKDROP_DIRECT_MAX_BUFFERED_AMOUNT = 512 * 1024;
const QUICKDROP_DIRECT_ACCEPT_TIMEOUT_MS = 15000;
const QUICKDROP_DIRECT_COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const QUICKDROP_DIRECT_SAVED_RETENTION_MS = 24 * 60 * 60 * 1000;
const QUICKDROP_DIRECT_PAIR_TASK_POLL_INTERVAL_MS = 5000;

const QuickDropDirectTransfer = (() => {
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
        serverPairTasks: [],
        pairTaskContextKey: '',
        pairTaskPollTimer: null,
        acceptWaiters: new Map(),
        receivingSessions: new Map(),
        receiveQueue: Promise.resolve(),
        dbPromise: null
    };

    function text(key, fallback) {
        return typeof t === 'function' ? t(key) : fallback;
    }

    function directReady() {
        return window.QuickDropSignalManager && typeof QuickDropSignalManager.isDirectReady === 'function'
            ? QuickDropSignalManager.isDirectReady()
            : false;
    }

    function getSignalState() {
        return window.QuickDropSignalManager && typeof QuickDropSignalManager.getState === 'function'
            ? QuickDropSignalManager.getState()
            : {};
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

    function normalizeBatchFileName(file) {
        const displayName = getSelectionDisplayName(file);
        const normalized = String(displayName || file?.name || '')
            .replace(/[\\/]+/g, '__')
            .trim();
        return normalized || `quickdrop-${Date.now()}`;
    }

    function buildSelectionItem(file) {
        const label = getSelectionDisplayName(file) || file.name || 'quickdrop-file';
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
        document.dispatchEvent(new CustomEvent('quickdrop:direct-transfer-storechange', {
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
            const request = window.indexedDB.open(QUICKDROP_DIRECT_DB_NAME, 1);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(QUICKDROP_DIRECT_TRANSFER_STORE)) {
                    db.createObjectStore(QUICKDROP_DIRECT_TRANSFER_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(QUICKDROP_DIRECT_CHUNK_STORE)) {
                    const chunkStore = db.createObjectStore(QUICKDROP_DIRECT_CHUNK_STORE, { keyPath: 'key' });
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
        const transaction = db.transaction([QUICKDROP_DIRECT_TRANSFER_STORE], 'readonly');
        const request = transaction.objectStore(QUICKDROP_DIRECT_TRANSFER_STORE).getAll();
        const result = await requestToPromise(request);
        await transactionDone(transaction);
        return result || [];
    }

    async function getStoredTransfer(transferId) {
        const db = await openDb();
        if (!db) {
            return memoryStore.transfers.get(transferId) || null;
        }
        const transaction = db.transaction([QUICKDROP_DIRECT_TRANSFER_STORE], 'readonly');
        const request = transaction.objectStore(QUICKDROP_DIRECT_TRANSFER_STORE).get(transferId);
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
        const transaction = db.transaction([QUICKDROP_DIRECT_TRANSFER_STORE], 'readwrite');
        transaction.objectStore(QUICKDROP_DIRECT_TRANSFER_STORE).put(normalized);
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
        const transaction = db.transaction([QUICKDROP_DIRECT_CHUNK_STORE], 'readwrite');
        transaction.objectStore(QUICKDROP_DIRECT_CHUNK_STORE).put({
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
        const transaction = db.transaction([QUICKDROP_DIRECT_CHUNK_STORE], 'readonly');
        const index = transaction.objectStore(QUICKDROP_DIRECT_CHUNK_STORE).index('byTransferId');
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
        const transaction = db.transaction([QUICKDROP_DIRECT_CHUNK_STORE], 'readonly');
        const index = transaction.objectStore(QUICKDROP_DIRECT_CHUNK_STORE).index('byTransferId');
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

        const transferTx = db.transaction([QUICKDROP_DIRECT_TRANSFER_STORE], 'readwrite');
        transferTx.objectStore(QUICKDROP_DIRECT_TRANSFER_STORE).delete(transferId);
        await transactionDone(transferTx);

        const chunkTx = db.transaction([QUICKDROP_DIRECT_CHUNK_STORE], 'readwrite');
        const chunkStore = chunkTx.objectStore(QUICKDROP_DIRECT_CHUNK_STORE);
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

    function pendingSessions() {
        try {
            return JSON.parse(localStorage.getItem(QUICKDROP_DIRECT_PENDING_KEY) || '{}');
        } catch (error) {
            return {};
        }
    }

    function savePendingSessions(data) {
        localStorage.setItem(QUICKDROP_DIRECT_PENDING_KEY, JSON.stringify(data));
    }

    function getCurrentDeviceId() {
        return localStorage.getItem(QUICKDROP_DIRECT_DEVICE_ID_KEY) || '';
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

        const response = await fetch(`${API_BASE}/public/quickdrop/pair-tasks?pairSessionId=${encodeURIComponent(context.pairSessionId)}&selfChannelId=${encodeURIComponent(context.selfChannelId)}`);
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
        }, QUICKDROP_DIRECT_PAIR_TASK_POLL_INTERVAL_MS);
    }

    async function syncDirectAttemptToServer(transfer, options = {}) {
        if (!canSyncTaskToServer(transfer)) {
            return null;
        }

        const response = await fetch(`${API_BASE}/quickdrop/tasks/direct-attempts`, {
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

    async function syncPublicPairTaskToServer(transfer, options = {}) {
        if (!canSyncPublicPairTaskToServer(transfer)) {
            return null;
        }

        const context = getDirectSignalContext();
        const response = await fetch(`${API_BASE}/public/quickdrop/pair-tasks/direct-attempts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pairSessionId: transfer.pairSessionId || context.pairSessionId,
                selfChannelId: transfer.selfChannelId || context.selfChannelId,
                peerChannelId: transfer.peerChannelId || context.peerChannelId,
                selfLabel: transfer.selfLabel || context.selfLabel,
                peerLabel: transfer.peerLabel || context.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
        const response = await fetch(`${API_BASE}/quickdrop/tasks/${encodeURIComponent(transfer.taskId)}/direct-attempts/${encodeURIComponent(transfer.id)}?deviceId=${encodeURIComponent(getCurrentDeviceId())}`, {
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
        const response = await fetch(`${API_BASE}/public/quickdrop/pair-tasks/${encodeURIComponent(transfer.pairTaskId)}/direct-attempts/${encodeURIComponent(transfer.id)}?pairSessionId=${encodeURIComponent(pairSessionId)}&selfChannelId=${encodeURIComponent(selfChannelId)}`, {
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
        const explicitDeviceName = localStorage.getItem('quickdrop-device-name');
        if (explicitDeviceName) {
            return explicitDeviceName;
        }
        const publicSenderLabel = document.getElementById('quickDropPublicSenderLabel')?.value.trim();
        if (publicSenderLabel) {
            return publicSenderLabel;
        }
        if (typeof getStoredAuthUser === 'function') {
            const user = getStoredAuthUser();
            if (user?.nickname || user?.username) {
                return user.nickname || user.username;
            }
        }
        return 'QuickDrop';
    }

    function transferStatusLabel(status) {
        switch (status) {
            case 'sending':
                return text('quickDropDirectSending', 'Sending directly');
            case 'waiting_complete':
                return text('quickDropDirectWaitingComplete', 'Waiting for peer to finish storage');
            case 'relay_fallback':
                return text('quickDropDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay');
            case 'ready':
                return text('quickDropStatusReady', 'Ready to Download');
            case 'completed':
                return text('quickDropStatusCompleted', 'Completed');
            case 'receiving':
                return text('quickDropDirectReceiving', 'Receiving');
            case 'cancelled':
                return text('quickDropStatusCancelled', 'Cancelled');
            default:
                return text('quickDropDirectPending', 'Pending');
        }
    }

    function directionLabel(direction) {
        return direction === 'outgoing'
            ? text('quickDropOutgoing', 'Outgoing')
            : text('quickDropIncoming', 'Inbox');
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
                title: text('quickDropNoFileSelected', 'No file selected'),
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
            title: text('quickDropBatchSelectedSummary', '{count} items selected').replace('{count}', String(state.selectedFiles.length)),
            meta: `${formatSize(totalSize)} · ${state.selectedFiles.slice(0, 3).map(item => item.label).join(' · ')}${state.selectedFiles.length > 3 ? ' ...' : ''}`
        };
    }

    function buildTaskAttemptsFromTransfer(transfer) {
        if (!transfer) {
            return [];
        }
        return [{
            transferMode: 'direct',
            transferId: transfer.id != null ? String(transfer.id) : '',
            stage: transfer.status || '',
            completedChunks: getTransferCompletedChunks(transfer),
            totalChunks: Number(transfer.totalChunks || 0),
            updateTime: transfer.updateTime || ''
        }];
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
            fileName: transfer?.fileName || '',
            fileSize: Number(transfer?.fileSize || 0),
            peerLabel: transfer?.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
            completedChunks: getTransferCompletedChunks(transfer),
            totalChunks: Number(transfer?.totalChunks || 0),
            updateTime: transfer?.updateTime || '',
            directTransferId: transfer?.id != null ? String(transfer.id) : '',
            attempts: sortTaskAttempts(buildTaskAttemptsFromTransfer(transfer))
        };
    }

    function buildDisplayTransferFromPairTask(task, localTransfer) {
        const normalizedAttempts = sortTaskAttempts(
            Array.isArray(task?.attempts) && task.attempts.length
                ? task.attempts.map(attempt => ({
                    transferMode: attempt?.transferMode || 'direct',
                    transferId: attempt?.transferId != null ? String(attempt.transferId) : '',
                    stage: attempt?.stage || task?.stage || '',
                    completedChunks: Number(attempt?.completedChunks || 0),
                    totalChunks: Number(attempt?.totalChunks || task?.totalChunks || 0),
                    updateTime: attempt?.updateTime || task?.updateTime || ''
                }))
                : buildTaskAttemptsFromTransfer(localTransfer)
        );
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
            fileName: task?.fileName || localTransfer?.fileName || '',
            fileSize: Number(task?.fileSize ?? localTransfer?.fileSize ?? 0),
            peerLabel: task?.peerLabel || localTransfer?.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
            completedChunks: Number(task?.completedChunks ?? getTransferCompletedChunks(localTransfer)),
            totalChunks: Number(task?.totalChunks ?? localTransfer?.totalChunks ?? 0),
            updateTime: task?.updateTime || localTransfer?.updateTime || '',
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
        const container = document.getElementById('quickDropDirectSelectedFile');
        if (!container) {
            return;
        }
        if (!state.selectedFiles.length) {
            container.innerHTML = `<span>${text('quickDropNoFileSelected', 'No file selected')}</span>`;
            return;
        }
        const summary = summarizeSelectedFiles();
        container.innerHTML = `
            <span>${summary.title}</span>
            <span>${summary.meta || '-'}</span>
        `;
    }

    function renderActiveSend() {
        const wrap = document.getElementById('quickDropDirectActiveTransfer');
        const title = document.getElementById('quickDropDirectActiveTitle');
        const bar = document.getElementById('quickDropDirectActiveBar');
        const meta = document.getElementById('quickDropDirectActiveMeta');
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
        const peer = document.getElementById('quickDropDirectPeer');
        const sendButton = document.getElementById('quickDropDirectSendBtn');
        const sendLabel = document.getElementById('quickDropDirectSendBtnLabel');
        const peerLabel = getSignalState().latestPeerLabel || '';
        if (peer) {
            peer.textContent = peerLabel || text('quickDropDirectNoPeer', 'Waiting for a paired peer');
        }
        if (sendLabel) {
            sendLabel.textContent = peerLabel
                ? text('quickDropDirectSendNowWithPeer', 'Send to {name}').replace('{name}', peerLabel)
                : text('quickDropDirectSendNow', 'Start transfer');
        }
        if (sendButton) {
            sendButton.disabled = !state.selectedFiles.length || !directReady();
        }
    }

    function renderTransferList() {
        const list = document.getElementById('quickDropDirectTransferList');
        const empty = document.getElementById('quickDropDirectTransferEmpty');
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
            const peerLabel = transfer.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer');
            const canDownload = transfer.direction === 'incoming'
                && transfer.localTransferId
                && (transfer.stage === 'ready' || transfer.stage === 'completed');
            const canSave = canDownload
                && typeof isLoggedIn === 'function'
                && isLoggedIn();
            const deleteAttrs = transfer.deleteTransferId
                ? `data-quickdrop-direct-delete="${transfer.deleteTransferId}"`
                : transfer.deleteServerTransferId
                    ? `data-quickdrop-direct-delete-task="${transfer.detailId}"`
                    : 'disabled';
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
                        ${text('quickDropChunkProgress', 'Chunks')}: ${transfer.completedChunks || 0} / ${transfer.totalChunks || 0}
                        · ${text('quickDropUpdatedAt', 'Updated')}: ${formatTime(transfer.updateTime)}
                    </p>
                    <div class="actions">
                        <button class="btn btn-primary" type="button" data-quickdrop-direct-download="${transfer.localTransferId}" ${canDownload ? '' : 'disabled'}>
                            <i class="fa-solid fa-download"></i>
                            <span>${text('quickDropDownload', 'Download')}</span>
                        </button>
                        <button class="btn btn-secondary" type="button" data-quickdrop-direct-save="${transfer.localTransferId}" ${canSave ? '' : 'disabled'}>
                            <i class="fa-solid fa-hard-drive"></i>
                            <span>${text('quickDropSaveToNetdisk', 'Save to Netdisk')}</span>
                        </button>
                        <button class="btn btn-secondary" type="button" data-quickdrop-direct-detail="${transfer.detailId}">
                            <i class="fa-solid fa-circle-info"></i>
                            <span>${text('quickDropTaskDetails', 'Details')}</span>
                        </button>
                        <button class="btn btn-secondary" type="button" ${deleteAttrs}>
                            <i class="fa-solid fa-trash"></i>
                            <span>${text('quickDropDelete', 'Delete')}</span>
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
        renderTransferList();
    }

    function formatTaskAttemptLine(attempt) {
        const idLabel = attempt?.transferMode === 'relay'
            ? text('quickDropRelayTransferIdLabel', 'Relay Transfer ID')
            : text('quickDropDirectTransferIdLabel', 'Direct Transfer ID');
        return [
            `- ${attempt?.transferMode === 'relay' ? text('quickDropTransferModeRelay', 'Relay') : text('quickDropTransferModeDirect', 'Direct')}`,
            transferStatusLabel(attempt?.stage || ''),
            `${text('quickDropChunkProgress', 'Chunks')}: ${Number(attempt?.completedChunks || 0)} / ${Number(attempt?.totalChunks || 0)}`,
            `${idLabel}: ${attempt?.transferId || '-'}`,
            `${text('quickDropUpdatedAt', 'Updated')}: ${formatTime(attempt?.updateTime)}`
        ].join(' · ');
    }

    function buildDirectTransferDetailValue(transfer) {
        const directTransferIds = Array.from(new Set(
            sortTaskAttempts(transfer?.attempts || [])
                .filter(attempt => attempt?.transferMode === 'direct' && attempt?.transferId)
                .map(attempt => String(attempt.transferId))
        ));
        const lines = [
            `${text('quickDropTaskKeyLabel', 'Task Key')}: ${transfer?.taskKey || '-'}`,
            `${text('quickDropTaskModeLabel', 'Mode')}: ${text('quickDropTransferModeDirect', 'Direct')}`,
            `${text('quickDropTaskStatusLabel', 'Status')}: ${transferStatusLabel(transfer?.stage || '')}`,
            `${text('quickDropTaskDirectionLabel', 'Direction')}: ${directionLabel(transfer?.direction)}`,
            `${text('quickDropTaskFileLabel', 'File')}: ${transfer?.fileName || '-'}`,
            `${text('quickDropTaskSizeLabel', 'Size')}: ${formatSize(transfer?.fileSize)}`,
            `${text('quickDropTaskPeerLabel', 'Peer')}: ${transfer?.peerLabel || '-'}`,
            `${text('quickDropChunkProgress', 'Chunks')}: ${Number(transfer?.completedChunks || 0)} / ${Number(transfer?.totalChunks || 0)}`,
            `${text('quickDropUpdatedAt', 'Updated')}: ${formatTime(transfer?.updateTime)}`,
            `${text('quickDropAccountTaskIdLabel', 'Account Task ID')}: ${transfer?.taskId || '-'}`,
            `${text('quickDropPairTaskIdLabel', 'Pair Task ID')}: ${transfer?.pairTaskId || '-'}`,
            `${text('quickDropPairSessionLabel', 'Pair Session')}: ${transfer?.pairSessionId || '-'}`
        ];

        if (directTransferIds.length) {
            lines.push(`${text('quickDropDirectTransferIdLabel', 'Direct Transfer ID')}: ${directTransferIds.join(', ')}`);
        }
        if ((transfer?.attempts || []).length) {
            lines.push(`${text('quickDropTaskAttemptsLabel', 'Attempts')}:`);
            sortTaskAttempts(transfer.attempts).forEach(attempt => {
                lines.push(formatTaskAttemptLine(attempt));
            });
        }
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
                text('quickDropTaskDetailsHint', 'Task snapshot. Copy it if you need to compare ids or keys across devices.'),
                value,
                {
                    title: text('quickDropTaskDetailsTitle', 'Task Details'),
                    icon: 'fa-circle-info',
                    multiline: true,
                    confirmText: text('quickDropClose', 'Close')
                }
            );
            return;
        }

        await showAppAlert(value, {
            title: text('quickDropTaskDetailsTitle', 'Task Details'),
            icon: 'fa-circle-info'
        });
    }

    async function upsertDirectTransferRecord(transfer, options = {}) {
        let normalized = await putStoredTransfer({
            transferMode: 'direct',
            ...transfer
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
        const input = document.getElementById('quickDropDirectFileInput');
        if (input) {
            input.value = '';
        }
        const folderInput = document.getElementById('quickDropDirectFolderInput');
        if (folderInput) {
            folderInput.value = '';
        }
    }

    function clearAllSelectedFiles() {
        state.batchSending = false;
        state.selectedFiles = [];
        state.selectedFile = null;
        const input = document.getElementById('quickDropDirectFileInput');
        if (input) {
            input.value = '';
        }
        const folderInput = document.getElementById('quickDropDirectFolderInput');
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
                reject(new Error(text('quickDropDirectAcceptTimeout', 'The peer did not respond in time')));
            }, QUICKDROP_DIRECT_ACCEPT_TIMEOUT_MS);
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
            const error = new Error(text('quickDropDirectChooseFileFirst', 'Choose a file first'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }
        if (!directReady()) {
            const error = new Error(text('quickDropDirectNeedReady', 'The direct link is not ready yet'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const signalState = getSignalState();
        const peerChannelId = signalState.latestPeerChannelId || '';
        if (!peerChannelId) {
            const error = new Error(text('quickDropDirectNoPeer', 'Waiting for a paired peer'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }
        const peerDeviceId = signalState.latestPeerDeviceId || extractDeviceId(peerChannelId);
        if (options.expectedPeerDeviceId && peerDeviceId !== String(options.expectedPeerDeviceId).trim()) {
            const error = new Error(text('quickDropDirectPeerMismatch', 'The current direct link points to another device'));
            if (!options.silentError) {
                showToast(error.message, 'error');
            }
            throw error;
        }

        const pending = pendingSessions();
        const pendingKey = buildPendingKey(currentFile, peerChannelId);
        const existing = pending[pendingKey];
        const transferId = existing?.transferId || createTransferId();
        const totalChunks = Math.max(1, Math.ceil(currentFile.size / QUICKDROP_DIRECT_CHUNK_SIZE));
        const taskKey = options.taskKey || existing?.taskKey || `pair:${transferId}`;
        const senderDeviceId = getCurrentDeviceId();
        const receiverDeviceId = peerDeviceId;
        const signalContext = getDirectSignalContext();

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
            statusText: text('quickDropDirectWaitingAccept', 'Waiting for peer resume map'),
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
            peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
            sentChunks: 0,
            acknowledgedChunks: 0,
            peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
            const offered = QuickDropSignalManager.sendDirectControl({
                type: 'transfer-offer',
                transferId,
                taskKey,
                taskId: state.activeSend.taskId || null,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                lastModified: currentFile.lastModified || 0,
                chunkSize: QUICKDROP_DIRECT_CHUNK_SIZE,
                totalChunks,
                senderLabel: resolveLocalLabel(),
                senderDeviceId,
                receiverDeviceId,
                pairSessionId: signalContext.pairSessionId
            });
            if (!offered) {
                throw new Error(text('quickDropDirectNeedReady', 'The direct link is not ready yet'));
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
                statusText: text('quickDropDirectSending', 'Sending directly'),
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
                peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
                sentChunks: 0,
                acknowledgedChunks: alreadyReceived,
                peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
                await QuickDropSignalManager.waitForDirectDrain(QUICKDROP_DIRECT_MAX_BUFFERED_AMOUNT);
                const start = chunkIndex * QUICKDROP_DIRECT_CHUNK_SIZE;
                const end = Math.min(currentFile.size, start + QUICKDROP_DIRECT_CHUNK_SIZE);
                const payload = await currentFile.slice(start, end).arrayBuffer();
                const sent = QuickDropSignalManager.sendDirectBinary(buildChunkPacket(transferId, chunkIndex, totalChunks, payload));
                if (!sent) {
                    throw new Error(text('quickDropDirectNeedReady', 'The direct link is not ready yet'));
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
                    statusText: `${optimisticCount}/${totalChunks} ${text('quickDropChunkProgress', 'chunks')}`,
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
                    peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
                    sentChunks: sentCount,
                    acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                    peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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

            QuickDropSignalManager.sendDirectControl({
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
                    statusText: text('quickDropDirectWaitingComplete', 'Waiting for peer to finish storage'),
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
                    peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
                sentChunks: requestedChunks.length,
                acknowledgedChunks: Math.max(state.activeSend?.acknowledgedChunks || 0, alreadyReceived),
                peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
            error.quickDropDirectContext = buildSendContext();
            state.activeSend = {
                transferId,
                fileName: currentFile.name,
                fileSize: currentFile.size,
                contentType: currentFile.type || 'application/octet-stream',
                progress: state.activeSend?.progress || 0,
                status: 'relay_fallback',
                statusText: text('quickDropDirectResumeHint', 'Re-pair and choose the same file again to continue missing chunks'),
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
                peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
                status: 'relay_fallback',
                sentChunks: state.activeSend?.sentChunks || 0,
                acknowledgedChunks: state.activeSend?.acknowledgedChunks || 0,
                peerLabel: signalState.latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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

    async function sendDirectFile() {
        try {
            if (!state.selectedFiles.length) {
                return await sendFile(state.selectedFile);
            }
            state.batchSending = state.selectedFiles.length > 1;
            let lastResult = null;
            for (const item of state.selectedFiles) {
                lastResult = await sendFile(item.file);
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
            chunkSize: Number(message.chunkSize) || QUICKDROP_DIRECT_CHUNK_SIZE,
            lastModified: Number(message.lastModified) || 0,
            peerLabel: message.senderLabel || getSignalState().latestPeerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
            peerDeviceId: message.senderDeviceId || existingTransfer?.peerDeviceId || '',
            senderDeviceId: message.senderDeviceId || existingTransfer?.senderDeviceId || '',
            receiverDeviceId: message.receiverDeviceId || existingTransfer?.receiverDeviceId || getCurrentDeviceId() || '',
            pairSessionId: message.pairSessionId || existingTransfer?.pairSessionId || getDirectSignalContext().pairSessionId,
            selfChannelId: getDirectSignalContext().selfChannelId,
            selfLabel: getDirectSignalContext().selfLabel,
            receivedChunks: storedChunkIndexes.size,
            status: storedChunkIndexes.size >= (Number(message.totalChunks) || 1) ? 'ready' : 'receiving',
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
            updateTime: nowIso()
        });
        const missingChunks = buildAllChunkIndexes(session.transfer.totalChunks)
            .filter(index => !session.receivedIndexes.has(index));

        QuickDropSignalManager.sendDirectControl({
            type: 'transfer-accept',
            transferId: message.transferId,
            totalChunks: session.transfer.totalChunks,
            receivedCount: session.receivedIndexes.size,
            missingChunks
        });

        showToast(
            missingChunks.length === session.transfer.totalChunks
                ? text('quickDropDirectOfferReady', 'Direct transfer is ready to receive')
                : text('quickDropDirectResumeReady', 'Existing chunks found, only missing chunks will continue'),
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
            statusText: `${receivedCount}/${totalChunks} ${text('quickDropChunkProgress', 'chunks')}`,
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
            sentChunks: state.activeSend.sentChunks || receivedCount,
            acknowledgedChunks: receivedCount,
            peerLabel: state.activeSend.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
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
            waiter.reject(new Error(message.error || text('quickDropDirectTransferFailed', 'Direct transfer failed')));
        }
        if (state.activeSend?.transferId === message.transferId) {
            state.activeSend = {
                ...state.activeSend,
                statusText: text('quickDropDirectResumeHint', 'Re-pair and choose the same file again to continue missing chunks')
            };
            render();
        }
        upsertDirectTransferRecord({
            id: message.transferId,
            taskKey: state.activeSend?.taskKey || '',
            taskId: state.activeSend?.taskId || null,
            fileName: state.activeSend?.fileName || message.fileName || `direct-${message.transferId}`,
            fileSize: state.activeSend?.fileSize || 0,
            contentType: state.activeSend?.contentType || 'application/octet-stream',
            totalChunks: state.activeSend?.totalChunks || 0,
            direction: 'outgoing',
            status: 'relay_fallback',
            sentChunks: state.activeSend?.sentChunks || 0,
            acknowledgedChunks: state.activeSend?.acknowledgedChunks || 0,
            peerLabel: state.activeSend?.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
            peerDeviceId: state.activeSend?.peerDeviceId || '',
            senderDeviceId: state.activeSend?.senderDeviceId || '',
            receiverDeviceId: state.activeSend?.receiverDeviceId || '',
            updateTime: nowIso()
        }).catch(() => {});
        showToast(message.error || text('quickDropDirectTransferFailed', 'Direct transfer failed'), 'error');
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
            statusText: text('quickDropDirectComplete', 'Direct transfer complete'),
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
            sentChunks: state.activeSend.sentChunks || state.activeSend.totalChunks || 0,
            acknowledgedChunks: state.activeSend.totalChunks || state.activeSend.acknowledgedChunks || 0,
            peerLabel: state.activeSend.peerLabel || text('quickDropDirectPeerFallback', 'Paired peer'),
            peerDeviceId: state.activeSend.peerDeviceId || '',
            senderDeviceId: state.activeSend.senderDeviceId || '',
            receiverDeviceId: state.activeSend.receiverDeviceId || '',
            updateTime: nowIso()
        }).catch(() => {});
        showToast(text('quickDropDirectSendSuccess', 'Direct transfer is ready on the peer device'), 'success');
    }

    async function handleTransferFinish(message) {
        const transfer = await getStoredTransfer(message.transferId);
        if (!transfer || transfer.status !== 'ready') {
            return;
        }
        QuickDropSignalManager.sendDirectControl({
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
                QuickDropSignalManager.sendDirectControl({
                    type: 'transfer-error',
                    transferId: header.transferId,
                    error: text('quickDropDirectMissingOffer', 'The receiver missed the direct transfer offer')
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
            QuickDropSignalManager.sendDirectControl({
                type: 'transfer-progress',
                transferId: header.transferId,
                totalChunks: session.transfer.totalChunks,
                receivedCount
            });
        }

        if (ready) {
            QuickDropSignalManager.sendDirectControl({
                type: 'transfer-complete',
                transferId: header.transferId,
                totalChunks: session.transfer.totalChunks,
                receivedCount
            });
            showToast(text('quickDropDirectReceiveReady', 'Direct transfer is ready to download'), 'success');
        }
    }

    async function downloadTransfer(transferId) {
        const transfer = await getStoredTransfer(transferId);
        if (!transfer || (transfer.status !== 'ready' && transfer.status !== 'completed')) {
            showToast(text('quickDropDirectNotReady', 'The direct transfer is not ready yet'), 'error');
            return;
        }
        const chunks = await loadStoredChunks(transferId);
        if (chunks.length < transfer.totalChunks) {
            showToast(text('quickDropDirectCorrupt', 'Some chunks are still missing'), 'error');
            return;
        }
        const blob = new Blob(chunks, {
            type: transfer.contentType || 'application/octet-stream'
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = transfer.fileName || `quickdrop-${transferId}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        await upsertDirectTransferRecord({
            ...transfer,
            status: 'completed',
            updateTime: nowIso(),
            completedAt: transfer.completedAt || nowIso()
        }, {
            downloaded: true
        });
    }

    async function saveTransferToNetdisk(transferId, folderId = 0) {
        if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
            if (typeof showAppAlert === 'function') {
                await showAppAlert(text('quickDropLoginRequired', 'Please sign in before using QuickDrop'), {
                    icon: 'fa-right-to-bracket'
                });
            }
            window.location.href = 'login.html';
            throw new Error(text('quickDropLoginRequired', 'Please sign in before using QuickDrop'));
        }

        const transfer = await getStoredTransfer(transferId);
        if (!transfer || (transfer.status !== 'ready' && transfer.status !== 'completed')) {
            throw new Error(text('quickDropDirectNotReady', 'The direct transfer is not ready yet'));
        }
        const chunks = await loadStoredChunks(transferId);
        if (chunks.length < transfer.totalChunks) {
            throw new Error(text('quickDropDirectCorrupt', 'Some chunks are still missing'));
        }

        const blob = new Blob(chunks, {
            type: transfer.contentType || 'application/octet-stream'
        });
        const formData = new FormData();
        formData.append('file', blob, transfer.fileName || `quickdrop-${transferId}`);
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
            savedToNetdiskAt: nowIso(),
            savedFileId: result.data?.id || null,
            updateTime: nowIso()
        }, {
            savedToNetdisk: true
        });
        showToast(text('quickDropSavedToNetdisk', 'Saved to your netdisk'), 'success');
        return result.data;
    }

    async function deleteServerPairTaskSnapshot(snapshot, options = {}) {
        if (!snapshot?.pairTaskId || !snapshot?.deleteServerTransferId) {
            return;
        }
        if (!options.skipConfirm) {
            const confirmed = await showAppConfirm(text('quickDropDirectDeleteConfirm', 'Delete this direct transfer from this browser?'), {
                title: text('quickDropDelete', 'Delete'),
                tone: 'danger',
                icon: 'fa-trash',
                confirmText: text('quickDropDelete', 'Delete')
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
            const confirmed = await showAppConfirm(text('quickDropDirectDeleteConfirm', 'Delete this direct transfer from this browser?'), {
                title: text('quickDropDelete', 'Delete'),
                tone: 'danger',
                icon: 'fa-trash',
                confirmText: text('quickDropDelete', 'Delete')
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
            const shouldDelete = (transfer.savedToNetdiskAt && savedAge > QUICKDROP_DIRECT_SAVED_RETENTION_MS)
                || (transfer.completedAt && completedAge > QUICKDROP_DIRECT_COMPLETED_RETENTION_MS);
            if (!shouldDelete) {
                continue;
            }
            await deleteTransfer(transfer.id, {
                skipConfirm: true
            });
        }
    }

    function openFilePicker() {
        const input = document.getElementById('quickDropDirectFileInput');
        if (input) {
            input.click();
        }
    }

    function openFolderPicker() {
        const input = document.getElementById('quickDropDirectFolderInput');
        if (input) {
            input.click();
        }
    }

    function handleFileChange(event) {
        setSelectedFiles(Array.from(event.target.files || []));
        render();
    }

    function getDirectSaveFolderId() {
        return Number(
            document.getElementById('quickDropDirectSaveFolderSelect')?.value
            || document.getElementById('quickDropSaveFolderSelect')?.value
            || document.getElementById('quickDropPublicSaveFolderSelect')?.value
            || 0
        );
    }

    function bindUi() {
        const input = document.getElementById('quickDropDirectFileInput');
        const folderInput = document.getElementById('quickDropDirectFolderInput');
        const list = document.getElementById('quickDropDirectTransferList');

        if (input) {
            input.addEventListener('change', handleFileChange);
        }
        if (folderInput) {
            folderInput.addEventListener('change', handleFileChange);
        }

        if (list) {
            list.addEventListener('click', event => {
                const downloadButton = event.target.closest('[data-quickdrop-direct-download]');
                if (downloadButton) {
                    downloadTransfer(downloadButton.getAttribute('data-quickdrop-direct-download'));
                    return;
                }
                const saveButton = event.target.closest('[data-quickdrop-direct-save]');
                if (saveButton) {
                    saveTransferToNetdisk(saveButton.getAttribute('data-quickdrop-direct-save'), getDirectSaveFolderId())
                        .catch(error => showToast(error.message, 'error'));
                    return;
                }
                const detailButton = event.target.closest('[data-quickdrop-direct-detail]');
                if (detailButton) {
                    showDirectTransferDetails(detailButton.getAttribute('data-quickdrop-direct-detail'));
                    return;
                }
                const deleteButton = event.target.closest('[data-quickdrop-direct-delete]');
                if (deleteButton) {
                    deleteTransfer(deleteButton.getAttribute('data-quickdrop-direct-delete'));
                    return;
                }
                const deleteTaskButton = event.target.closest('[data-quickdrop-direct-delete-task]');
                if (deleteTaskButton) {
                    const snapshot = state.displayTransfers.find(item => item.detailId === deleteTaskButton.getAttribute('data-quickdrop-direct-delete-task'));
                    if (snapshot) {
                        deleteServerPairTaskSnapshot(snapshot).catch(error => {
                            showToast(error.message, 'error');
                        });
                    }
                }
            });
        }

        document.addEventListener('quickdrop:direct-statechange', () => {
            if (state.activeSend && !directReady() && !state.activeSend.fallbackToRelay) {
                state.activeSend = {
                    ...state.activeSend,
                    statusText: text('quickDropDirectResumeHint', 'Re-pair and choose the same file again to continue missing chunks')
                };
            }
            syncPublicPairTaskPolling();
            render();
        });

        document.addEventListener('quickdrop:signal-message', () => {
            syncPublicPairTaskPolling();
            renderPeer();
        });

        document.addEventListener('quickdrop:direct-control', event => {
            handleControlMessage(event.detail?.message || event.detail).catch(error => {
                showToast(error.message, 'error');
            });
        });

        document.addEventListener('quickdrop:direct-binary', event => {
            state.receiveQueue = state.receiveQueue
                .then(() => handleBinaryMessage(event.detail?.data))
                .catch(error => {
                    showToast(error.message, 'error');
                });
        });

        document.addEventListener('quickshare:languagechange', render);
    }

    async function init() {
        if (!document.getElementById('quickDropDirectSelectedFile')) {
            return;
        }
        bindUi();
        await cleanupStoredTransfers();
        await refreshStoredTransfers();
        syncPublicPairTaskPolling();
        render();
    }

    return {
        init,
        openFilePicker,
        openFolderPicker,
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
                statusText: text('quickDropDirectFallbackRunning', 'Direct transfer was interrupted, switching to server relay')
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
        downloadTransfer,
        deleteTransfer,
        saveTransferToNetdisk,
        // Exposed for browser automation and packet compatibility checks.
        buildChunkPacket
    };
})();

window.QuickDropDirectTransfer = QuickDropDirectTransfer;
window.openQuickDropDirectFilePicker = () => QuickDropDirectTransfer.openFilePicker();
window.openQuickDropDirectFolderPicker = () => QuickDropDirectTransfer.openFolderPicker();
window.sendQuickDropDirectFile = () => QuickDropDirectTransfer.sendDirectFile();

document.addEventListener('DOMContentLoaded', () => {
    QuickDropDirectTransfer.init();
});
