const QUICKDROP_PUBLIC_PENDING_KEY = 'quickdrop-public-pending-uploads';

const quickDropPublicState = {
    selectedFile: null,
    currentShare: null,
    creating: false,
    folders: [],
    pollingTimer: null
};

function quickDropPublicText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function quickDropPublicRequest(path, options = {}, withAuth = false) {
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
            throw new Error(result?.message || 'QuickDrop public request failed');
        }
        return result.data;
    });
}

function getQuickDropPublicShareToken() {
    return new URLSearchParams(window.location.search).get('share') || '';
}

function loadQuickDropPublicPending() {
    try {
        return JSON.parse(localStorage.getItem(QUICKDROP_PUBLIC_PENDING_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function saveQuickDropPublicPending(data) {
    localStorage.setItem(QUICKDROP_PUBLIC_PENDING_KEY, JSON.stringify(data));
}

function buildQuickDropPublicPendingKey(file) {
    return [file.name, file.size, file.lastModified].join('|');
}

function setQuickDropPublicViewMode(mode) {
    const createCard = document.getElementById('quickDropPublicCreateCard');
    const pickupCard = document.getElementById('quickDropPublicPickupCard');
    if (!createCard || !pickupCard) {
        return;
    }

    createCard.classList.toggle('hidden', mode === 'pickup');
    pickupCard.classList.toggle('hidden', mode !== 'pickup');
}

function renderQuickDropPublicSelectedFile() {
    const container = document.getElementById('quickDropPublicSelectedFile');
    const sendBtn = document.getElementById('quickDropPublicSendBtn');
    if (!container || !sendBtn) {
        return;
    }

    if (!quickDropPublicState.selectedFile) {
        container.innerHTML = `<span>${quickDropPublicText('quickDropNoFileSelected', 'No file selected yet')}</span>`;
    } else {
        container.innerHTML = `
            <span>${quickDropPublicState.selectedFile.name}</span>
            <span>${typeof formatFileSize === 'function' ? formatFileSize(quickDropPublicState.selectedFile.size) : quickDropPublicState.selectedFile.size + ' B'}</span>
        `;
    }

    sendBtn.disabled = quickDropPublicState.creating || !quickDropPublicState.selectedFile;
}

function updateQuickDropPublicProgress(progress, text) {
    const bar = document.getElementById('quickDropPublicProgressBar');
    const meta = document.getElementById('quickDropPublicProgressMeta');
    if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, progress || 0))}%`;
    }
    if (meta) {
        meta.textContent = text || '-';
    }
}

function renderQuickDropPublicResultLink(share) {
    const link = document.getElementById('quickDropPublicResultLink');
    if (!link) {
        return;
    }

    if (!share || !share.shareToken) {
        link.style.display = 'none';
        link.textContent = '';
        return;
    }

    const href = `${window.location.origin}/quickdrop-share.html?share=${encodeURIComponent(share.shareToken)}`;
    link.href = href;
    link.textContent = href;
    link.style.display = '';
}

function renderQuickDropPublicPickup() {
    const share = quickDropPublicState.currentShare;
    if (!share) {
        return;
    }

    const status = document.getElementById('quickDropPublicStatus');
    const fileName = document.getElementById('quickDropPublicFileName');
    const sender = document.getElementById('quickDropPublicSender');
    const fileSize = document.getElementById('quickDropPublicFileSize');
    const updatedAt = document.getElementById('quickDropPublicUpdatedAt');
    const downloadBtn = document.getElementById('quickDropPublicDownloadBtn');
    const saveBtn = document.getElementById('quickDropPublicSaveBtn');
    const folderWrap = document.getElementById('quickDropPublicSaveFolderWrap');

    if (status) {
        status.textContent = share.ready
            ? quickDropPublicText('quickDropStatusReady', 'Ready to Download')
            : quickDropPublicText('quickDropStatusUploading', 'Uploading');
    }
    if (fileName) fileName.textContent = share.fileName || '-';
    if (sender) sender.textContent = share.senderLabel || '-';
    if (fileSize) fileSize.textContent = typeof formatFileSize === 'function' ? formatFileSize(share.fileSize || 0) : `${share.fileSize || 0} B`;
    if (updatedAt) updatedAt.textContent = formatQuickDropPublicTime(share.updateTime);
    if (downloadBtn) downloadBtn.disabled = !share.ready;
    if (saveBtn) {
        saveBtn.disabled = !share.ready || !isLoggedIn();
        saveBtn.style.display = isLoggedIn() ? '' : 'none';
    }
    if (folderWrap) {
        folderWrap.style.display = isLoggedIn() ? '' : 'none';
    }
}

function renderQuickDropPublicFolderSelect() {
    const select = document.getElementById('quickDropPublicSaveFolderSelect');
    if (!select) {
        return;
    }

    const options = [
        { id: 0, label: quickDropPublicText('quickDropRootFolder', 'Root') },
        ...quickDropPublicState.folders.map(folder => ({
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

function formatQuickDropPublicTime(value) {
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

function openQuickDropPublicFilePicker() {
    const input = document.getElementById('quickDropPublicFileInput');
    if (input) {
        input.click();
    }
}

function handleQuickDropPublicFileChange(event) {
    quickDropPublicState.selectedFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    renderQuickDropPublicSelectedFile();
}

async function resolveQuickDropPublicShareSession(file) {
    const pending = loadQuickDropPublicPending();
    const pendingKey = buildQuickDropPublicPendingKey(file);
    const current = pending[pendingKey];

    if (current && current.shareToken) {
        try {
            const share = await quickDropPublicRequest(`/public/quickdrop/shares/${encodeURIComponent(current.shareToken)}`);
            if (share.fileName === file.name
                && Number(share.fileSize) === Number(file.size)
                && share.status !== 'ready'
                && share.status !== 'completed') {
                return share;
            }
        } catch (error) {
            delete pending[pendingKey];
            saveQuickDropPublicPending(pending);
        }
    }

    const created = await quickDropPublicRequest('/public/quickdrop/shares', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            senderLabel: document.getElementById('quickDropPublicSenderLabel')?.value.trim() || '',
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
    saveQuickDropPublicPending(pending);
    return created;
}

function clearQuickDropPublicPending(file) {
    const pending = loadQuickDropPublicPending();
    delete pending[buildQuickDropPublicPendingKey(file)];
    saveQuickDropPublicPending(pending);
}

async function createQuickDropPublicShare() {
    if (quickDropPublicState.creating || !quickDropPublicState.selectedFile) {
        return;
    }

    const file = quickDropPublicState.selectedFile;
    quickDropPublicState.creating = true;
    renderQuickDropPublicSelectedFile();

    try {
        let share = await resolveQuickDropPublicShareSession(file);
        const uploadedIndexes = new Set(share.uploadedChunkIndexes || []);
        const totalChunks = share.totalChunks || Math.max(1, Math.ceil(file.size / share.chunkSize));

        updateQuickDropPublicProgress(
            Math.round((uploadedIndexes.size / totalChunks) * 100),
            quickDropPublicText('quickDropResumeHint', 'If upload breaks, choose the same file again to continue missing chunks.')
        );

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadedIndexes.has(chunkIndex)) {
                continue;
            }

            const start = chunkIndex * share.chunkSize;
            const end = Math.min(file.size, start + share.chunkSize);
            const chunk = file.slice(start, end);

            const response = await fetch(`${API_BASE}/public/quickdrop/shares/${encodeURIComponent(share.shareToken)}/chunks/${chunkIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: chunk
            });
            const text = await response.text();
            const result = text ? JSON.parse(text) : null;
            if (!response.ok || !result || result.code !== 200) {
                throw new Error(result?.message || 'QuickDrop public chunk upload failed');
            }

            share = result.data;
            uploadedIndexes.add(chunkIndex);
            updateQuickDropPublicProgress(
                Math.round(((share.uploadedChunks || uploadedIndexes.size) / totalChunks) * 100),
                `${share.uploadedChunks || uploadedIndexes.size}/${totalChunks} ${quickDropPublicText('quickDropChunkProgress', 'chunks')}`
            );
        }

        quickDropPublicState.currentShare = share;
        renderQuickDropPublicResultLink(share);
        clearQuickDropPublicPending(file);
        updateQuickDropPublicProgress(100, quickDropPublicText('quickDropPublicReady', 'The pickup link is ready'));
        showToast(quickDropPublicText('quickDropPublicShareCreated', 'Public pickup link created'), 'success');
    } catch (error) {
        updateQuickDropPublicProgress(0, quickDropPublicText('quickDropResumeHint', 'If upload breaks, choose the same file again to continue missing chunks.'));
        showToast(error.message, 'error');
    } finally {
        quickDropPublicState.creating = false;
        renderQuickDropPublicSelectedFile();
    }
}

async function loadQuickDropPublicShare() {
    const shareToken = getQuickDropPublicShareToken();
    if (!shareToken) {
        return;
    }

    const share = await quickDropPublicRequest(`/public/quickdrop/shares/${encodeURIComponent(shareToken)}`);
    quickDropPublicState.currentShare = share;
    setQuickDropPublicViewMode('pickup');
    renderQuickDropPublicPickup();

    if (quickDropPublicState.pollingTimer) {
        clearInterval(quickDropPublicState.pollingTimer);
    }
    if (!share.ready) {
        quickDropPublicState.pollingTimer = window.setInterval(async () => {
            const latest = await quickDropPublicRequest(`/public/quickdrop/shares/${encodeURIComponent(shareToken)}`);
            quickDropPublicState.currentShare = latest;
            renderQuickDropPublicPickup();
            if (latest.ready) {
                clearInterval(quickDropPublicState.pollingTimer);
                quickDropPublicState.pollingTimer = null;
            }
        }, 4000);
    }
}

function downloadQuickDropPublicShare() {
    const shareToken = quickDropPublicState.currentShare?.shareToken;
    if (!shareToken) {
        return;
    }
    window.location.href = `${API_BASE}/public/quickdrop/shares/${encodeURIComponent(shareToken)}/download`;
}

async function saveQuickDropPublicShareToNetdisk() {
    if (!isLoggedIn()) {
        await showAppAlert(quickDropPublicText('quickDropLoginRequired', 'Please sign in before using QuickDrop'), {
            icon: 'fa-right-to-bracket'
        });
        window.location.href = 'login.html';
        return;
    }

    const shareToken = quickDropPublicState.currentShare?.shareToken;
    if (!shareToken) {
        return;
    }

    const folderId = Number(document.getElementById('quickDropPublicSaveFolderSelect')?.value || 0);
    await quickDropPublicRequest(`/quickdrop/public-shares/${encodeURIComponent(shareToken)}/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderId })
    }, true);
    showToast(quickDropPublicText('quickDropSavedToNetdisk', 'Saved to your netdisk'), 'success');
}

function bindQuickDropPublicEvents() {
    const fileInput = document.getElementById('quickDropPublicFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleQuickDropPublicFileChange);
    }

    document.addEventListener('quickshare:languagechange', () => {
        renderQuickDropPublicSelectedFile();
        renderQuickDropPublicPickup();
        renderQuickDropPublicResultLink(quickDropPublicState.currentShare);
    });
}

async function initQuickDropPublicPage() {
    bindQuickDropPublicEvents();
    renderQuickDropPublicSelectedFile();
    renderQuickDropPublicResultLink(null);

    const senderInput = document.getElementById('quickDropPublicSenderLabel');
    if (senderInput && !senderInput.value) {
        senderInput.value = isLoggedIn()
            ? `${getStoredAuthUser().nickname || getStoredAuthUser().username || 'QuickShare'}`
            : quickDropPublicText('quickDropPublicGuestLabel', 'Guest Share');
    }

    if (isLoggedIn()) {
        try {
            quickDropPublicState.folders = await quickDropPublicRequest('/folders/all', {}, true);
        } catch (error) {
            quickDropPublicState.folders = [];
        }
    } else {
        quickDropPublicState.folders = [];
    }
    renderQuickDropPublicFolderSelect();

    if (getQuickDropPublicShareToken()) {
        try {
            await loadQuickDropPublicShare();
        } catch (error) {
            showToast(error.message, 'error');
        }
    } else {
        setQuickDropPublicViewMode('create');
    }
}

window.openQuickDropPublicFilePicker = openQuickDropPublicFilePicker;
window.createQuickDropPublicShare = createQuickDropPublicShare;
window.downloadQuickDropPublicShare = downloadQuickDropPublicShare;
window.saveQuickDropPublicShareToNetdisk = saveQuickDropPublicShareToNetdisk;

document.addEventListener('DOMContentLoaded', initQuickDropPublicPage);
