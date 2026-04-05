const TRANSFER_PUBLIC_PENDING_KEY = 'transfer-public-pending-uploads';

const transferPublicState = {
    selectedFile: null,
    currentShare: null,
    creating: false,
    folders: [],
    pollingTimer: null
};

function transferPublicText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function transferPublicRequest(path, options = {}, withAuth = false) {
    const headers = {
        ...(options.headers || {})
    };
    if (withAuth) {
        Object.assign(headers, getAuthHeaders());
    }

    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    }).then(async response => {
        const text = await response.text();
        const result = text ? JSON.parse(text) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'Transfer public request failed');
        }
        return result.data;
    });
}

function getTransferPublicShareToken() {
    return new URLSearchParams(window.location.search).get('share') || '';
}

function loadTransferPublicPending() {
    try {
        return JSON.parse(localStorage.getItem(TRANSFER_PUBLIC_PENDING_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function saveTransferPublicPending(data) {
    localStorage.setItem(TRANSFER_PUBLIC_PENDING_KEY, JSON.stringify(data));
}

function buildTransferPublicPendingKey(file) {
    return [file.name, file.size, file.lastModified].join('|');
}

function setTransferPublicViewMode(mode) {
    const createCard = document.getElementById('transferPublicCreateCard');
    const pickupCard = document.getElementById('transferPublicPickupCard');
    if (!createCard || !pickupCard) {
        return;
    }

    createCard.classList.toggle('hidden', mode === 'pickup');
    pickupCard.classList.toggle('hidden', mode !== 'pickup');
}

function renderTransferPublicSelectedFile() {
    const container = document.getElementById('transferPublicSelectedFile');
    const sendBtn = document.getElementById('transferPublicSendBtn');
    if (!container || !sendBtn) {
        return;
    }

    if (!transferPublicState.selectedFile) {
        container.innerHTML = `<span>${transferPublicText('transferNoFileSelected', 'No file selected yet')}</span>`;
    } else {
        container.innerHTML = `
            <span>${transferPublicState.selectedFile.name}</span>
            <span>${typeof formatFileSize === 'function' ? formatFileSize(transferPublicState.selectedFile.size) : transferPublicState.selectedFile.size + ' B'}</span>
        `;
    }

    sendBtn.disabled = transferPublicState.creating || !transferPublicState.selectedFile;
}

function updateTransferPublicProgress(progress, text) {
    const bar = document.getElementById('transferPublicProgressBar');
    const meta = document.getElementById('transferPublicProgressMeta');
    if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, progress || 0))}%`;
    }
    if (meta) {
        meta.textContent = text || '-';
    }
}

function renderTransferPublicResultLink(share) {
    const link = document.getElementById('transferPublicResultLink');
    if (!link) {
        return;
    }

    if (!share || !share.shareToken) {
        link.style.display = 'none';
        link.textContent = '';
        return;
    }

    const href = `${window.location.origin}/transfer-share.html?share=${encodeURIComponent(share.shareToken)}`;
    link.href = href;
    link.textContent = href;
    link.style.display = '';
}

function renderTransferPublicPickup() {
    const share = transferPublicState.currentShare;
    if (!share) {
        return;
    }

    const status = document.getElementById('transferPublicStatus');
    const fileName = document.getElementById('transferPublicFileName');
    const sender = document.getElementById('transferPublicSender');
    const fileSize = document.getElementById('transferPublicFileSize');
    const updatedAt = document.getElementById('transferPublicUpdatedAt');
    const downloadBtn = document.getElementById('transferPublicDownloadBtn');
    const saveBtn = document.getElementById('transferPublicSaveBtn');
    const folderWrap = document.getElementById('transferPublicSaveFolderWrap');

    if (status) {
        status.textContent = share.ready
            ? transferPublicText('transferStatusReady', 'Ready to Download')
            : transferPublicText('transferStatusUploading', 'Uploading');
    }
    if (fileName) fileName.textContent = share.fileName || '-';
    if (sender) sender.textContent = share.senderLabel || '-';
    if (fileSize) fileSize.textContent = typeof formatFileSize === 'function' ? formatFileSize(share.fileSize || 0) : `${share.fileSize || 0} B`;
    if (updatedAt) updatedAt.textContent = formatTransferPublicTime(share.updateTime);
    if (downloadBtn) downloadBtn.disabled = !share.ready;
    if (saveBtn) {
        saveBtn.disabled = !share.ready || !isLoggedIn();
        saveBtn.style.display = isLoggedIn() ? '' : 'none';
    }
    if (folderWrap) {
        folderWrap.style.display = isLoggedIn() ? '' : 'none';
    }
}

function renderTransferPublicFolderSelect() {
    const select = document.getElementById('transferPublicSaveFolderSelect');
    if (!select) {
        return;
    }

    const options = [
        { id: 0, label: transferPublicText('transferRootFolder', 'Root') },
        ...transferPublicState.folders.map(folder => ({
            id: folder.id,
            label: folder.name || folder.originalName || folder.fileName || `Folder ${folder.id}`
        }))
    ];

    const currentValue = select.value || '0';
    select.innerHTML = options.map(option => `<option value="${option.id}">${option.label}</option>`).join('');

    if (options.some(option => String(option.id) === currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '0';
    }
}

function formatTransferPublicTime(value) {
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

function openTransferPublicFilePicker() {
    const input = document.getElementById('transferPublicFileInput');
    if (input) {
        input.click();
    }
}

function handleTransferPublicFileChange(event) {
    transferPublicState.selectedFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    renderTransferPublicSelectedFile();
}

async function resolveTransferPublicShareSession(file) {
    const pending = loadTransferPublicPending();
    const pendingKey = buildTransferPublicPendingKey(file);
    const current = pending[pendingKey];

    if (current && current.shareToken) {
        try {
            const share = await transferPublicRequest(`/public/transfer/shares/${encodeURIComponent(current.shareToken)}`);
            if (share.fileName === file.name
                && Number(share.fileSize) === Number(file.size)
                && share.status !== 'ready'
                && share.status !== 'completed') {
                return share;
            }
        } catch (error) {
            delete pending[pendingKey];
            saveTransferPublicPending(pending);
        }
    }

    const created = await transferPublicRequest('/public/transfer/shares', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            senderLabel: document.getElementById('transferPublicSenderLabel')?.value.trim() || '',
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream'
        })
    }, isLoggedIn());

    pending[pendingKey] = {
        shareToken: created.shareToken,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified
    };
    saveTransferPublicPending(pending);
    return created;
}

function clearTransferPublicPending(file) {
    const pending = loadTransferPublicPending();
    delete pending[buildTransferPublicPendingKey(file)];
    saveTransferPublicPending(pending);
}

async function createTransferPublicShare() {
    if (transferPublicState.creating || !transferPublicState.selectedFile) {
        return;
    }

    const file = transferPublicState.selectedFile;
    transferPublicState.creating = true;
    renderTransferPublicSelectedFile();

    try {
        let share = await resolveTransferPublicShareSession(file);
        const uploadedIndexes = new Set(share.uploadedChunkIndexes || []);
        const totalChunks = share.totalChunks || Math.max(1, Math.ceil(file.size / share.chunkSize));

        updateTransferPublicProgress(
            Math.round((uploadedIndexes.size / totalChunks) * 100),
            transferPublicText('transferResumeHint', 'If upload breaks, choose the same file again to continue missing chunks.')
        );

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadedIndexes.has(chunkIndex)) {
                continue;
            }

            const start = chunkIndex * share.chunkSize;
            const end = Math.min(file.size, start + share.chunkSize);
            const chunk = file.slice(start, end);

            const response = await fetch(`${API_BASE}/public/transfer/shares/${encodeURIComponent(share.shareToken)}/chunks/${chunkIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: chunk
            });
            const text = await response.text();
            const result = text ? JSON.parse(text) : null;
            if (!response.ok || !result || result.code !== 200) {
                throw new Error(result?.message || 'Transfer public chunk upload failed');
            }

            share = result.data;
            uploadedIndexes.add(chunkIndex);
            updateTransferPublicProgress(
                Math.round(((share.uploadedChunks || uploadedIndexes.size) / totalChunks) * 100),
                `${share.uploadedChunks || uploadedIndexes.size}/${totalChunks} ${transferPublicText('transferChunkProgress', 'chunks')}`
            );
        }

        transferPublicState.currentShare = share;
        renderTransferPublicResultLink(share);
        clearTransferPublicPending(file);
        updateTransferPublicProgress(100, transferPublicText('transferPublicReady', 'The pickup link is ready'));
        showToast(transferPublicText('transferPublicShareCreated', 'Public pickup link created'), 'success');
    } catch (error) {
        updateTransferPublicProgress(0, transferPublicText('transferResumeHint', 'If upload breaks, choose the same file again to continue missing chunks.'));
        showToast(error.message, 'error');
    } finally {
        transferPublicState.creating = false;
        renderTransferPublicSelectedFile();
    }
}

async function loadTransferPublicShare() {
    const shareToken = getTransferPublicShareToken();
    if (!shareToken) {
        return;
    }

    const share = await transferPublicRequest(`/public/transfer/shares/${encodeURIComponent(shareToken)}`);
    transferPublicState.currentShare = share;
    setTransferPublicViewMode('pickup');
    renderTransferPublicPickup();

    if (transferPublicState.pollingTimer) {
        clearInterval(transferPublicState.pollingTimer);
    }
    if (!share.ready) {
        transferPublicState.pollingTimer = window.setInterval(async () => {
            const latest = await transferPublicRequest(`/public/transfer/shares/${encodeURIComponent(shareToken)}`);
            transferPublicState.currentShare = latest;
            renderTransferPublicPickup();
            if (latest.ready) {
                clearInterval(transferPublicState.pollingTimer);
                transferPublicState.pollingTimer = null;
            }
        }, 4000);
    }
}

function downloadTransferPublicShare() {
    const shareToken = transferPublicState.currentShare?.shareToken;
    if (!shareToken) {
        return;
    }
    window.location.href = `${API_BASE}/public/transfer/shares/${encodeURIComponent(shareToken)}/download`;
}

async function saveTransferPublicShareToNetdisk() {
    if (!isLoggedIn()) {
        await showAppAlert(transferPublicText('transferLoginRequired', 'Please sign in before using Transfer'), {
            icon: 'fa-right-to-bracket'
        });
        window.location.href = 'login.html';
        return;
    }

    const shareToken = transferPublicState.currentShare?.shareToken;
    if (!shareToken) {
        return;
    }

    const folderId = Number(document.getElementById('transferPublicSaveFolderSelect')?.value || 0);
    await transferPublicRequest(`/transfer/public-shares/${encodeURIComponent(shareToken)}/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderId })
    }, true);
    showToast(transferPublicText('transferSavedToNetdisk', 'Saved to your netdisk'), 'success');
}

function bindTransferPublicEvents() {
    const fileInput = document.getElementById('transferPublicFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleTransferPublicFileChange);
    }

    document.addEventListener('quickshare:languagechange', () => {
        renderTransferPublicSelectedFile();
        renderTransferPublicPickup();
        renderTransferPublicResultLink(transferPublicState.currentShare);
    });
}

async function initTransferPublicPage() {
    bindTransferPublicEvents();
    renderTransferPublicSelectedFile();
    renderTransferPublicResultLink(null);

    const senderInput = document.getElementById('transferPublicSenderLabel');
    if (senderInput && !senderInput.value) {
        senderInput.value = isLoggedIn()
            ? `${getStoredAuthUser().nickname || getStoredAuthUser().username || 'QuickShare'}`
            : transferPublicText('transferPublicGuestLabel', 'Guest Share');
    }

    if (isLoggedIn()) {
        try {
            transferPublicState.folders = await transferPublicRequest('/folders/all', {}, true);
        } catch (error) {
            transferPublicState.folders = [];
        }
    } else {
        transferPublicState.folders = [];
    }
    renderTransferPublicFolderSelect();

    if (getTransferPublicShareToken()) {
        try {
            await loadTransferPublicShare();
        } catch (error) {
            showToast(error.message, 'error');
        }
    } else {
        setTransferPublicViewMode('create');
    }
}

window.openTransferPublicFilePicker = openTransferPublicFilePicker;
window.createTransferPublicShare = createTransferPublicShare;
window.downloadTransferPublicShare = downloadTransferPublicShare;
window.saveTransferPublicShareToNetdisk = saveTransferPublicShareToNetdisk;

document.addEventListener('DOMContentLoaded', initTransferPublicPage);
