/**
 * netdisk.js - 网盘页面核心逻辑
 * 使用统一的 theme.js 和 lang-switch.js
 */

// ================== 全局变量 ==================
let currentView = 'list';
let currentFolder = null;
let currentCategory = 'all';
let files = [];
let folders = [];
let folderPath = [];
let isMobile = window.innerWidth <= 768;
let filePreviewPolicy = createDefaultFilePreviewPolicy();
let activeActionDialog = null;
let actionDialogFocusRestore = null;
let actionDialogEventsBound = false;
let netdiskHistoryEventsBound = false;
let selectionModeEnabled = false;
let draggedNetdiskItems = null;
const NETDISK_PAGE_SIZE = 50;
let _filesPageNum = 1;
let _filesTotalPages = 1;
let _filesLoading = false;

const NETDISK_CATEGORIES = new Set(['all', 'image', 'document', 'video', 'audio', 'other']);

// 文件类型映射
const FILE_TYPE_MAP = {
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'svg': 'image', 'webp': 'image',
    'doc': 'document', 'docx': 'document', 'pdf': 'document', 'txt': 'document', 'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document',
    'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'mkv': 'video',
    'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio',
    'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive'
};

const TEXT_PREVIEW_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'yaml', 'yml',
    'properties', 'ini', 'conf', 'sql', 'sh', 'bat', 'java', 'js', 'ts',
    'tsx', 'jsx', 'css', 'html', 'htm'
]);
const TEXT_PREVIEW_MIME_TYPES = new Set([
    'application/json', 'application/xml', 'application/javascript', 'application/x-javascript',
    'application/yaml', 'application/x-yaml', 'application/sql'
]);
const OFFICE_PREVIEW_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const OFFICE_PREVIEW_MIME_TYPES = new Set([
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

function createDefaultFilePreviewPolicy() {
    return {
        enabled: true,
        imageEnabled: true,
        videoEnabled: true,
        audioEnabled: true,
        pdfEnabled: true,
        textEnabled: true,
        officeEnabled: true,
        allowedExtensions: []
    };
}

function normalizeNetdiskCategory(category) {
    return NETDISK_CATEGORIES.has(category) ? category : 'all';
}

function normalizeNetdiskFolderId(value) {
    if (value == null || value === '' || value === 0 || value === '0') {
        return null;
    }

    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getNetdiskNavigationState() {
    return {
        currentFolder: currentFolder,
        currentCategory: normalizeNetdiskCategory(currentCategory)
    };
}

function normalizeNetdiskNavigationState(rawState) {
    return {
        currentFolder: normalizeNetdiskFolderId(rawState?.currentFolder),
        currentCategory: normalizeNetdiskCategory(rawState?.currentCategory)
    };
}

function isSameNetdiskNavigationState(left, right) {
    return normalizeNetdiskFolderId(left?.currentFolder) === normalizeNetdiskFolderId(right?.currentFolder)
        && normalizeNetdiskCategory(left?.currentCategory) === normalizeNetdiskCategory(right?.currentCategory);
}

function getNetdiskNavigationStateFromUrl() {
    const url = new URL(window.location.href);
    return normalizeNetdiskNavigationState({
        currentFolder: url.searchParams.get('folder'),
        currentCategory: url.searchParams.get('category')
    });
}

function buildNetdiskNavigationUrl(state = getNetdiskNavigationState()) {
    const url = new URL(window.location.href);
    url.searchParams.delete('folder');
    url.searchParams.delete('category');

    if (state.currentFolder != null) {
        url.searchParams.set('folder', String(state.currentFolder));
    }
    if (state.currentCategory && state.currentCategory !== 'all') {
        url.searchParams.set('category', state.currentCategory);
    }

    return `${url.pathname}${url.search}`;
}

function syncNetdiskHistoryState(mode = 'replace') {
    const nextState = normalizeNetdiskNavigationState(getNetdiskNavigationState());
    const currentState = history.state?.quickshareNetdisk
        ? normalizeNetdiskNavigationState(history.state)
        : getNetdiskNavigationStateFromUrl();
    const nextUrl = buildNetdiskNavigationUrl(nextState);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (mode === 'push' && isSameNetdiskNavigationState(nextState, currentState) && nextUrl === currentUrl) {
        return;
    }

    const historyState = {
        quickshareNetdisk: true,
        ...nextState
    };

    if (mode === 'push') {
        window.history.pushState(historyState, '', nextUrl);
    } else {
        window.history.replaceState(historyState, '', nextUrl);
    }
}

function updateSidebarSelection(category = currentCategory) {
    const nextCategory = normalizeNetdiskCategory(category);
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active', 'bg-brand-50', 'text-brand-600');
        item.classList.add('text-text-sub');

        if ((item.dataset.category || 'all') === nextCategory) {
            item.classList.remove('text-text-sub');
            item.classList.add('active', 'bg-brand-50', 'text-brand-600');
        }
    });
}

function closeSidebarOnMobile() {
    if (window.innerWidth > 768) {
        return;
    }

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

const selectedNetdiskItems = new Set();

function getNetdiskSelectionKey(kind, id) {
    return `${kind}:${id}`;
}

function isNetdiskItemSelected(kind, id) {
    return selectedNetdiskItems.has(getNetdiskSelectionKey(kind, id));
}

function getNetdiskItemByKind(kind, id) {
    if (kind === 'folder') {
        return folders.find(folder => folder.id === id) || null;
    }
    if (kind === 'file') {
        return files.find(file => file.id === id) || null;
    }
    return null;
}

function setNetdiskItemSelection(kind, id, selected) {
    const key = getNetdiskSelectionKey(kind, id);
    if (selected) {
        selectedNetdiskItems.add(key);
    } else {
        selectedNetdiskItems.delete(key);
    }
}

function getNetdiskSearchKeyword() {
    return String(document.getElementById('searchInput')?.value || '').trim().toLowerCase();
}

function getVisibleNetdiskEntries(searchKeyword = getNetdiskSearchKeyword()) {
    const keyword = String(searchKeyword || '').trim().toLowerCase();

    if (keyword) {
        const matchedFolders = folders.filter(folder => {
            const name = String(folder.name || folder.originalName || folder.fileName || '').toLowerCase();
            return name.includes(keyword);
        });
        const matchedFiles = files.filter(file => {
            const name = String(file.originalName || file.fileName || file.name || '').toLowerCase();
            return name.includes(keyword);
        });

        return {
            folders: currentCategory === 'all' ? matchedFolders : [],
            files: currentCategory === 'all'
                ? matchedFiles
                : matchedFiles.filter(file => file.type === currentCategory)
        };
    }

    const targetFolder = currentFolder === null ? 0 : currentFolder;
    const currentFolders = folders.filter(folder => {
        const parentId = folder.parentId === undefined ? 0 : folder.parentId;
        return parentId === targetFolder;
    });
    const currentFiles = files.filter(file => {
        const folderId = file.folderId === undefined ? 0 : file.folderId;
        return folderId === targetFolder;
    });

    return {
        folders: currentCategory === 'all' ? currentFolders : [],
        files: currentCategory === 'all'
            ? currentFiles
            : currentFiles.filter(file => file.type === currentCategory)
    };
}

function getVisibleNetdiskItems(searchKeyword = getNetdiskSearchKeyword()) {
    const visibleEntries = getVisibleNetdiskEntries(searchKeyword);
    return [
        ...visibleEntries.folders.map(folder => ({ kind: 'folder', id: folder.id })),
        ...visibleEntries.files.map(file => ({ kind: 'file', id: file.id }))
    ];
}

function getSelectedNetdiskItems() {
    const selectedFiles = [];
    const selectedFolders = [];
    const fileMap = new Map(files.map(file => [file.id, file]));
    const folderMap = new Map(folders.map(folder => [folder.id, folder]));

    selectedNetdiskItems.forEach(key => {
        const [kind, rawId] = key.split(':');
        const id = Number.parseInt(rawId, 10);
        if (!Number.isInteger(id)) {
            return;
        }

        if (kind === 'file' && fileMap.has(id)) {
            selectedFiles.push(fileMap.get(id));
        } else if (kind === 'folder' && folderMap.has(id)) {
            selectedFolders.push(folderMap.get(id));
        }
    });

    return {
        files: selectedFiles,
        folders: selectedFolders,
        total: selectedFiles.length + selectedFolders.length
    };
}

function getSelectedNetdiskSummaryText() {
    const selection = getSelectedNetdiskItems();
    return t('batchSelectionSummary')
        .replace('{total}', selection.total)
        .replace('{files}', selection.files.length)
        .replace('{folders}', selection.folders.length);
}

function pruneNetdiskSelection() {
    const validKeys = new Set([
        ...folders.map(folder => getNetdiskSelectionKey('folder', folder.id)),
        ...files.map(file => getNetdiskSelectionKey('file', file.id))
    ]);

    let changed = false;
    [...selectedNetdiskItems].forEach(key => {
        if (!validKeys.has(key)) {
            selectedNetdiskItems.delete(key);
            changed = true;
        }
    });

    return changed;
}

function updateNetdiskSelectionUI() {
    const bar = document.getElementById('bulkActionsBar');
    const selectedCountText = document.getElementById('selectedCountText');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const selectAllVisibleBtn = document.getElementById('selectAllVisibleBtn');
    const selectAllVisibleLabel = selectAllVisibleBtn?.querySelector('span');
    const selectionModeToggle = document.getElementById('selectionModeToggle');
    const selectionModeToggleText = document.getElementById('selectionModeToggleText');

    const selection = getSelectedNetdiskItems();
    const visibleItems = getVisibleNetdiskItems();
    const allVisibleSelected = visibleItems.length > 0
        && visibleItems.every(item => isNetdiskItemSelected(item.kind, item.id));

    if (bar) {
        bar.classList.toggle('hidden', !selectionModeEnabled);
    }
    if (selectedCountText) {
        selectedCountText.textContent = getSelectedNetdiskSummaryText();
    }
    if (batchMoveBtn) {
        batchMoveBtn.disabled = selection.total === 0;
    }
    if (batchDeleteBtn) {
        batchDeleteBtn.disabled = selection.total === 0;
    }
    if (clearSelectionBtn) {
        clearSelectionBtn.disabled = selection.total === 0;
    }
    if (selectAllVisibleBtn) {
        selectAllVisibleBtn.disabled = visibleItems.length === 0;
    }
    if (selectAllVisibleLabel) {
        selectAllVisibleLabel.textContent = allVisibleSelected
            ? t('batchUnselectAllVisible')
            : t('batchSelectAllVisible');
    }
    if (selectionModeToggle) {
        selectionModeToggle.classList.toggle('is-active', selectionModeEnabled);
        selectionModeToggle.title = selectionModeEnabled ? t('selectionModeDone') : t('selectionModeStart');
        selectionModeToggle.setAttribute('aria-pressed', selectionModeEnabled ? 'true' : 'false');
    }
    if (selectionModeToggleText) {
        selectionModeToggleText.textContent = selectionModeEnabled ? t('selectionModeDone') : t('selectionModeStart');
    }
}

function rerenderNetdiskCurrentView() {
    const keyword = getNetdiskSearchKeyword();
    if (keyword) {
        searchFiles(keyword);
    } else {
        renderFiles();
    }
}

function toggleNetdiskSelectionMode(forceEnabled) {
    const nextEnabled = typeof forceEnabled === 'boolean' ? forceEnabled : !selectionModeEnabled;
    if (nextEnabled === selectionModeEnabled) {
        updateNetdiskSelectionUI();
        return;
    }

    selectionModeEnabled = nextEnabled;
    if (!selectionModeEnabled) {
        clearNetdiskSelection({ render: false });
    }

    rerenderNetdiskCurrentView();
}

function toggleNetdiskItemSelection(kind, id, event) {
    if (event?.stopPropagation) {
        event.stopPropagation();
    }

    const isChecked = typeof event?.target?.checked === 'boolean'
        ? event.target.checked
        : !isNetdiskItemSelected(kind, id);

    setNetdiskItemSelection(kind, id, isChecked);
    rerenderNetdiskCurrentView();
}

function handleNetdiskFolderPrimaryAction(folderId, folderName, event) {
    if (selectionModeEnabled) {
        toggleNetdiskItemSelection('folder', folderId, event);
        return;
    }

    openFolder(folderId, folderName);
}

function handleNetdiskFilePrimaryAction(index, fileId, event) {
    if (selectionModeEnabled) {
        toggleNetdiskItemSelection('file', fileId, event);
        return;
    }

    previewFile(index);
}

function toggleSelectAllVisibleItems() {
    const visibleItems = getVisibleNetdiskItems();
    if (visibleItems.length === 0) {
        return;
    }

    const shouldSelect = visibleItems.some(item => !isNetdiskItemSelected(item.kind, item.id));
    visibleItems.forEach(item => {
        setNetdiskItemSelection(item.kind, item.id, shouldSelect);
    });
    rerenderNetdiskCurrentView();
}

function clearNetdiskSelection(options = {}) {
    selectedNetdiskItems.clear();
    if (options.render === false) {
        updateNetdiskSelectionUI();
        return;
    }
    rerenderNetdiskCurrentView();
}

function rebuildFolderPathFromCurrentFolder() {
    if (currentFolder == null) {
        folderPath = [];
        return false;
    }

    const path = [];
    let cursor = currentFolder;
    let depth = 0;

    while (cursor != null && depth < 50) {
        const folder = folders.find(item => item.id === cursor);
        if (!folder) {
            currentFolder = null;
            folderPath = [];
            return true;
        }

        path.unshift({
            id: folder.id,
            name: getFolderDisplayName(folder)
        });
        cursor = normalizeNetdiskFolderId(folder.parentId);
        depth++;
    }

    folderPath = path;
    return false;
}

function restoreNetdiskNavigationState(state, options = {}) {
    const normalizedState = normalizeNetdiskNavigationState(state);
    currentFolder = normalizedState.currentFolder;
    currentCategory = normalizedState.currentCategory;
    updateSidebarSelection();

    if (options.syncHistory === 'push') {
        syncNetdiskHistoryState('push');
    } else if (options.syncHistory === 'replace') {
        syncNetdiskHistoryState('replace');
    }

    if (options.loadFiles !== false) {
        loadFiles();
    }
}

function bindNetdiskHistoryEvents() {
    if (netdiskHistoryEventsBound) {
        return;
    }

    window.addEventListener('popstate', (event) => {
        const nextState = event.state?.quickshareNetdisk
            ? normalizeNetdiskNavigationState(event.state)
            : getNetdiskNavigationStateFromUrl();

        if (isSameNetdiskNavigationState(nextState, getNetdiskNavigationState())) {
            return;
        }

        restoreNetdiskNavigationState(nextState);
    });

    netdiskHistoryEventsBound = true;
}

function normalizePreviewExtension(fileName) {
    const rawName = String(fileName || '').trim().toLowerCase();
    const dotIndex = rawName.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === rawName.length - 1) return '';
    return rawName.slice(dotIndex + 1);
}

function normalizePreviewContentType(contentType) {
    const value = String(contentType || '').trim().toLowerCase();
    if (!value) return '';
    const semicolonIndex = value.indexOf(';');
    return semicolonIndex >= 0 ? value.slice(0, semicolonIndex).trim() : value;
}

function getPreviewAllowedExtensions() {
    return Array.isArray(filePreviewPolicy?.allowedExtensions)
        ? filePreviewPolicy.allowedExtensions.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [];
}

function getFilePreviewKind(file) {
    const fileName = file.originalName || file.fileName || file.name || '';
    const extension = normalizePreviewExtension(fileName);
    const contentType = normalizePreviewContentType(file.fileType || file.type || '');

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
    if (contentType.startsWith('text/') || TEXT_PREVIEW_MIME_TYPES.has(contentType) || TEXT_PREVIEW_EXTENSIONS.has(extension)) {
        return 'text';
    }
    if (OFFICE_PREVIEW_MIME_TYPES.has(contentType) || OFFICE_PREVIEW_EXTENSIONS.has(extension)) {
        return 'office';
    }
    return null;
}

function getFilePreviewDecision(file) {
    const kind = getFilePreviewKind(file);
    if (!kind) {
        return { allowed: false, kind: null, reason: 'unsupported' };
    }

    if (!filePreviewPolicy || filePreviewPolicy.enabled === false) {
        return { allowed: false, kind, reason: 'policy' };
    }

    const kindEnabled = {
        image: filePreviewPolicy.imageEnabled !== false,
        video: filePreviewPolicy.videoEnabled !== false,
        audio: filePreviewPolicy.audioEnabled !== false,
        pdf: filePreviewPolicy.pdfEnabled !== false,
        text: filePreviewPolicy.textEnabled !== false,
        office: filePreviewPolicy.officeEnabled !== false
    };
    if (!kindEnabled[kind]) {
        return { allowed: false, kind, reason: 'policy' };
    }

    const allowedExtensions = getPreviewAllowedExtensions();
    if (allowedExtensions.length > 0) {
        const extension = normalizePreviewExtension(file.originalName || file.fileName || file.name || '');
        if (!extension || !allowedExtensions.includes(extension)) {
            return { allowed: false, kind, reason: 'policy' };
        }
    }

    return { allowed: true, kind, reason: null };
}

async function loadPreviewPolicy() {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        filePreviewPolicy = createDefaultFilePreviewPolicy();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/settings/file-preview`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.code === 401) {
            await showAppAlert(t('loginExpired'), {
                tone: 'danger',
                icon: 'fa-user-clock'
            });
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        if (result.code === 200 && result.data) {
            filePreviewPolicy = {
                ...createDefaultFilePreviewPolicy(),
                ...result.data,
                allowedExtensions: Array.isArray(result.data.allowedExtensions) ? result.data.allowedExtensions : []
            };
            return;
        }
    } catch (error) {
        console.warn('加载预览策略失败，回退到默认前端判断:', error);
    }

    filePreviewPolicy = createDefaultFilePreviewPolicy();
}

function hideActionDialogError() {
    const errorEl = document.getElementById('actionDialogError');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('show');
}

function showActionDialogError(message) {
    const errorEl = document.getElementById('actionDialogError');
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.classList.toggle('show', !!message);
}

function closeActionDialog() {
    const dialog = document.getElementById('actionDialog');
    if (!dialog) return;

    dialog.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    hideActionDialogError();
    activeActionDialog = null;

    if (actionDialogFocusRestore && typeof actionDialogFocusRestore.focus === 'function') {
        actionDialogFocusRestore.focus();
    }
    actionDialogFocusRestore = null;
}

function getActionDialogInputValue(id) {
    const field = document.getElementById(id);
    return field ? field.value : '';
}

function bindActionDialogEvents() {
    if (actionDialogEventsBound) {
        return;
    }

    document.addEventListener('keydown', (event) => {
        const dialog = document.getElementById('actionDialog');
        if (!dialog || !dialog.classList.contains('active') || !activeActionDialog) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeActionDialog();
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        const target = event.target;
        if (target instanceof HTMLElement) {
            if (target.tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey) {
                return;
            }

            if (target.closest('[data-dialog-cancel], [data-dialog-confirm]')) {
                return;
            }
        }

        const confirmBtn = dialog.querySelector('[data-dialog-confirm]');
        if (confirmBtn instanceof HTMLButtonElement && !confirmBtn.disabled) {
            event.preventDefault();
            confirmBtn.click();
        }
    });

    actionDialogEventsBound = true;
}

function openActionDialog(config) {
    const dialog = document.getElementById('actionDialog');
    const iconEl = document.getElementById('actionDialogIcon');
    const titleEl = document.getElementById('actionDialogTitle');
    const descriptionEl = document.getElementById('actionDialogDescription');
    const contentEl = document.getElementById('actionDialogContent');
    const actionsEl = document.getElementById('actionDialogActions');

    if (!dialog || !iconEl || !titleEl || !descriptionEl || !contentEl || !actionsEl) {
        return;
    }

    actionDialogFocusRestore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeActionDialog = config;

    iconEl.className = `dialog-icon${config.tone === 'danger' ? ' danger' : ''}`;
    iconEl.innerHTML = `<i class="fa-solid ${config.icon || 'fa-pen'}"></i>`;
    titleEl.textContent = config.title || '';
    descriptionEl.textContent = config.description || '';
    contentEl.innerHTML = config.content || '';
    hideActionDialogError();

    const cancelLabel = config.cancelText || t('dialogCancel');
    actionsEl.innerHTML = `
        <button type="button" class="dialog-btn" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="dialog-btn ${config.confirmTone || 'primary'}" data-dialog-confirm>
            ${config.confirmIcon ? `<i class="fa-solid ${config.confirmIcon}"></i>` : ''}
            <span>${escapeHtml(config.confirmText || t('dialogConfirm'))}</span>
        </button>
    `;

    const cancelBtn = actionsEl.querySelector('[data-dialog-cancel]');
    const confirmBtn = actionsEl.querySelector('[data-dialog-confirm]');

    cancelBtn?.addEventListener('click', () => closeActionDialog(), { once: true });
    confirmBtn?.addEventListener('click', async () => {
        if (!activeActionDialog || typeof activeActionDialog.onConfirm !== 'function') return;
        hideActionDialogError();
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        try {
            await activeActionDialog.onConfirm({
                dialog,
                confirmBtn,
                cancelBtn,
                setError: showActionDialogError,
                close: closeActionDialog,
                getValue: getActionDialogInputValue
            });
        } finally {
            if (document.getElementById('actionDialog')?.classList.contains('active')) {
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        }
    });

    dialog.classList.add('active');
    document.body.classList.add('overflow-hidden');

    requestAnimationFrame(() => {
        if (typeof config.onOpen === 'function') {
            config.onOpen();
            return;
        }
        const autoFocusEl = dialog.querySelector('[data-autofocus]');
        if (autoFocusEl && typeof autoFocusEl.focus === 'function') {
            autoFocusEl.focus();
            if (typeof autoFocusEl.select === 'function') autoFocusEl.select();
        }
    });
}

function ensureAuthenticatedForAction() {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        showToast(t('loginRequired'), 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 600);
        return null;
    }
    return token;
}

function openCreateFolderDialog() {
    openActionDialog({
        icon: 'fa-folder-plus',
        title: t('folderDialogTitle'),
        description: t('folderDialogDescription'),
        confirmText: t('folderDialogConfirm'),
        confirmIcon: 'fa-folder-plus',
        content: `
            <div class="dialog-field">
                <label for="actionFolderName">${escapeHtml(t('folderDialogNameLabel'))}</label>
                <input id="actionFolderName" type="text" data-autofocus placeholder="${escapeHtml(t('folderDialogNamePlaceholder'))}">
                <p class="dialog-help">${escapeHtml(t('folderDialogNameHelp'))}</p>
            </div>
        `,
        onConfirm: async ({ setError, close, getValue }) => {
            const name = getValue('actionFolderName').trim();
            if (!name) {
                setError(t('folderDialogValidation'));
                return;
            }
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/folders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, parentId: currentFolder })
                });
                const result = await response.json();

                if (result.code === 200) {
                    close();
                    showToast(t('folderCreateSuccess'), 'success');
                    await loadFiles();
                } else if (result.code === 401) {
                    close();
                    showToast(t('loginExpired'), 'error');
                    localStorage.clear();
                    window.location.href = 'login.html';
                } else {
                    setError(result.message || t('folderCreateFailed'));
                }
            } catch (error) {
                setError(`${t('folderCreateFailed')}: ${error.message}`);
            }
        }
    });
}

function openRenameDialog(options) {
    const currentName = options.currentName || '';
    openActionDialog({
        icon: 'fa-pen',
        title: t('renameDialogTitle'),
        description: t('renameDialogDescription').replace('{name}', currentName),
        confirmText: t('renameDialogConfirm'),
        confirmIcon: 'fa-check',
        content: `
            <div class="dialog-note">
                <i class="fa-solid fa-file-signature"></i>
                <span>${escapeHtml(t('renameDialogNote').replace('{name}', currentName))}</span>
            </div>
            <div class="dialog-field">
                <label for="actionRenameValue">${escapeHtml(t('renameDialogLabel'))}</label>
                <input id="actionRenameValue" type="text" value="${escapeHtml(currentName)}" data-autofocus>
            </div>
        `,
        onOpen: () => {
            const input = document.getElementById('actionRenameValue');
            if (input) {
                input.focus();
                input.select();
            }
        },
        onConfirm: async ({ setError, close, getValue }) => {
            const nextName = getValue('actionRenameValue').trim();
            if (!nextName) {
                setError(t('renameDialogValidation'));
                return;
            }
            if (nextName === currentName) {
                close();
                return;
            }
            await options.onSubmit(nextName, { setError, close });
        }
    });
}

function openDeleteDialog(options) {
    openActionDialog({
        icon: 'fa-trash',
        tone: 'danger',
        confirmTone: 'danger',
        title: t('deleteDialogTitle'),
        description: t('deleteDialogDescription').replace('{name}', options.name || '-'),
        confirmText: t('deleteDialogConfirm'),
        confirmIcon: 'fa-trash',
        content: `
            <div class="dialog-surface">
                <div class="text-sm font-semibold text-text-main">${escapeHtml(options.name || '-')}</div>
                <p class="dialog-help">${escapeHtml(options.meta || t('deleteDialogMetaDefault'))}</p>
            </div>
            <div class="dialog-note">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${escapeHtml(t('deleteDialogNote'))}</span>
            </div>
        `,
        onConfirm: options.onConfirm
    });
}

function openShareDialog(index) {
    const file = files[index];
    if (!file) return;

    const fileName = file.originalName || file.fileName || file.name || '-';
    openActionDialog({
        icon: 'fa-share-nodes',
        title: t('shareDialogTitle'),
        description: t('shareDialogDescription').replace('{name}', fileName),
        confirmText: t('shareDialogConfirm'),
        confirmIcon: 'fa-wand-magic-sparkles',
        content: `
            <div class="dialog-surface">
                <div class="text-sm font-semibold text-text-main">${escapeHtml(fileName)}</div>
                <div class="dialog-meta mt-3">
                    <span class="dialog-chip"><i class="fa-solid fa-file"></i>${escapeHtml(file.type || getFileType(fileName))}</span>
                    <span class="dialog-chip"><i class="fa-solid fa-weight-hanging"></i>${escapeHtml(formatFileSize(file.fileSize || file.size || 0))}</span>
                </div>
            </div>
            <div class="dialog-inline-grid">
                <div class="dialog-field">
                    <label for="actionShareExpireDays">${escapeHtml(t('shareDialogExpireLabel'))}</label>
                    <select id="actionShareExpireDays" data-autofocus>
                        <option value="1">${escapeHtml(t('shareDialogExpire1'))}</option>
                        <option value="7" selected>${escapeHtml(t('shareDialogExpire7'))}</option>
                        <option value="30">${escapeHtml(t('shareDialogExpire30'))}</option>
                        <option value="-1">${escapeHtml(t('shareDialogExpireNever'))}</option>
                    </select>
                </div>
                <div class="dialog-field">
                    <label for="actionShareExtractCode">${escapeHtml(t('shareDialogCodeLabel'))}</label>
                    <input id="actionShareExtractCode" type="text" maxlength="6" placeholder="${escapeHtml(t('shareDialogCodePlaceholder'))}">
                    <p class="dialog-help">${escapeHtml(t('shareDialogCodeHelp'))}</p>
                </div>
            </div>
        `,
        onConfirm: async ({ setError, close, getValue }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            const expireDays = parseInt(getValue('actionShareExpireDays'), 10);
            const extractCode = getValue('actionShareExtractCode').trim();
            if (extractCode.length > 6) {
                setError(t('shareDialogCodeValidation'));
                return;
            }

            const expireHours = Number.isNaN(expireDays) || expireDays <= 0 ? null : expireDays * 24;

            try {
                const response = await fetch(`${API_BASE}/share`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fileId: file.id,
                        expireHours,
                        extractCode: extractCode || null
                    })
                });
                const result = await response.json();

                if (result.code !== 200) {
                    setError(result.message || t('shareFailed'));
                    return;
                }

                let shareUrl = `${window.location.protocol}//${window.location.host}/index.html?share=${result.data.shareCode}`;
                if (result.data.extractCode) {
                    shareUrl += `&code=${result.data.extractCode}`;
                }
                copyToClipboard(shareUrl);

                openActionDialog({
                    icon: 'fa-circle-check',
                    title: t('shareResultTitle'),
                    description: t('shareResultDescription'),
                    confirmText: t('shareResultDone'),
                    confirmIcon: 'fa-check',
                    content: `
                        <div class="dialog-field">
                            <label>${escapeHtml(t('shareResultLinkLabel'))}</label>
                            <div class="share-result-link">${escapeHtml(shareUrl)}</div>
                        </div>
                        <div class="dialog-inline-grid">
                            <div class="dialog-field">
                                <label>${escapeHtml(t('shareResultCodeLabel'))}</label>
                                <div class="share-result-link">${escapeHtml(result.data.extractCode || t('none'))}</div>
                            </div>
                            <div class="dialog-field">
                                <label>${escapeHtml(t('shareResultExpireLabel'))}</label>
                                <div class="share-result-link">${escapeHtml(expireDays === -1 ? t('neverExpires') : t('shareResultExpireValue').replace('{days}', expireDays))}</div>
                            </div>
                        </div>
                        <div class="dialog-note">
                            <i class="fa-solid fa-copy"></i>
                            <span>${escapeHtml(t('shareResultCopiedHint'))}</span>
                        </div>
                    `,
                    onConfirm: async ({ close: closeResult }) => {
                        closeResult();
                    }
                });
            } catch (error) {
                setError(`${t('shareFailed')}: ${error.message}`);
            }
        }
    });
}

function getFolderDisplayName(folder) {
    return folder?.name || folder?.originalName || folder?.fileName || t('folder');
}

function buildFolderPathLabel(folderId, folderMap, cache = new Map()) {
    const normalizedId = folderId == null ? 0 : folderId;
    if (cache.has(normalizedId)) {
        return cache.get(normalizedId);
    }
    if (normalizedId === 0) {
        const rootLabel = t('moveDialogRoot');
        cache.set(0, rootLabel);
        return rootLabel;
    }

    const folder = folderMap.get(normalizedId);
    if (!folder) {
        return t('moveDialogRoot');
    }

    const parentLabel = buildFolderPathLabel(folder.parentId, folderMap, cache);
    const nextLabel = `${parentLabel} / ${getFolderDisplayName(folder)}`;
    cache.set(normalizedId, nextLabel);
    return nextLabel;
}

function collectBlockedFolderIds(folderId) {
    const blocked = new Set();
    if (!folderId) {
        return blocked;
    }

    const queue = [folderId];
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (blocked.has(currentId)) {
            continue;
        }

        blocked.add(currentId);
        folders
            .filter(folder => (folder.parentId == null ? 0 : folder.parentId) === currentId)
            .forEach(child => queue.push(child.id));
    }

    return blocked;
}

function openMoveDialog(options) {
    const currentParentId = options.currentParentId == null ? 0 : options.currentParentId;
    const folderMap = new Map((folders || []).map(folder => [folder.id, folder]));
    const pathCache = new Map();
    const blockedFolderIds = options.kind === 'folder' ? collectBlockedFolderIds(options.itemId) : new Set();
    const destinations = (folders || [])
        .filter(folder => !blockedFolderIds.has(folder.id))
        .map(folder => ({
            id: folder.id,
            label: buildFolderPathLabel(folder.id, folderMap, pathCache)
        }))
        .sort((left, right) => left.label.localeCompare(right.label, getCurrentLanguage() === 'en' ? 'en' : 'zh'));
    const currentLocationLabel = buildFolderPathLabel(currentParentId, folderMap, pathCache);
    const selectedTargetId = blockedFolderIds.has(currentParentId) ? 0 : currentParentId;

    openActionDialog({
        icon: 'fa-folder-tree',
        title: t('moveDialogTitle'),
        description: t(options.kind === 'folder' ? 'moveDialogDescriptionFolder' : 'moveDialogDescriptionFile')
            .replace('{name}', options.name || '-'),
        confirmText: t('moveDialogConfirm'),
        confirmIcon: 'fa-arrow-right-arrow-left',
        content: `
            <div class="dialog-surface">
                <div class="text-sm font-semibold text-text-main">${escapeHtml(options.name || '-')}</div>
                <p class="dialog-help">${escapeHtml(t('moveDialogCurrentLabel'))}: ${escapeHtml(currentLocationLabel)}</p>
            </div>
            <div class="dialog-field">
                <label for="actionMoveTarget">${escapeHtml(t('moveDialogTargetLabel'))}</label>
                <select id="actionMoveTarget" data-autofocus>
                    <option value="0" ${selectedTargetId === 0 ? 'selected' : ''}>${escapeHtml(t('moveDialogRoot'))}</option>
                    ${destinations.map(destination => `
                        <option value="${destination.id}" ${selectedTargetId === destination.id ? 'selected' : ''}>
                            ${escapeHtml(destination.label)}
                        </option>
                    `).join('')}
                </select>
                <p class="dialog-help">${escapeHtml(t(options.kind === 'folder' ? 'moveDialogHelpFolder' : 'moveDialogHelpFile'))}</p>
            </div>
        `,
        onConfirm: async ({ setError, close, getValue }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            const rawTargetValue = getValue('actionMoveTarget');
            const parsedTargetId = Number.parseInt(rawTargetValue, 10);
            const targetFolderId = Number.isNaN(parsedTargetId) ? null : parsedTargetId;
            if (targetFolderId == null || (blockedFolderIds.has(targetFolderId) && targetFolderId !== 0)) {
                setError(t('moveDialogValidation'));
                return;
            }
            if (targetFolderId === currentParentId) {
                close();
                return;
            }

            try {
                await requestNetdiskMove(options.kind, options.itemId, targetFolderId, token);
                if (options.kind === 'folder' && (currentFolder === options.itemId || folderPath.some(folder => folder.id === options.itemId))) {
                    currentFolder = null;
                    folderPath = [];
                    currentCategory = 'all';
                    syncNetdiskHistoryState('replace');
                }
                applyLocalMove(options.kind, options.itemId, targetFolderId);
                setNetdiskItemSelection(options.kind, options.itemId, false);
                close();
                showToast(t('moveSuccess'), 'success');
                rerenderNetdiskCurrentView();
                refreshNetdiskAfterMutation();
            } catch (error) {
                setError(`${t('moveDialogValidation')}: ${error.message}`);
            }
        }
    });
}

function normalizeComparableFolderId(value) {
    return normalizeNetdiskFolderId(value) ?? 0;
}

function getNetdiskItemParentId(kind, item) {
    if (!item) {
        return 0;
    }

    if (kind === 'folder') {
        return normalizeComparableFolderId(item.parentId);
    }

    return normalizeComparableFolderId(item.folderId ?? item.parentId);
}

function setNetdiskItemParentId(kind, item, targetFolderId) {
    if (!item) {
        return;
    }

    const normalizedTargetFolderId = normalizeComparableFolderId(targetFolderId);
    if (kind === 'folder') {
        item.parentId = normalizedTargetFolderId;
        if ('folderId' in item) {
            item.folderId = normalizedTargetFolderId;
        }
        return;
    }

    item.folderId = normalizedTargetFolderId;
    if ('parentId' in item) {
        item.parentId = normalizedTargetFolderId;
    }
}

function canMoveNetdiskItemToFolder(kind, itemId, targetFolderId) {
    const item = getNetdiskItemByKind(kind, itemId);
    if (!item) {
        return false;
    }

    const normalizedTargetFolderId = normalizeComparableFolderId(targetFolderId);
    if (kind === 'folder' && normalizedTargetFolderId !== 0 && collectBlockedFolderIds(itemId).has(normalizedTargetFolderId)) {
        return false;
    }

    return getNetdiskItemParentId(kind, item) !== normalizedTargetFolderId;
}

function applyLocalMove(kind, itemId, targetFolderId) {
    const item = getNetdiskItemByKind(kind, itemId);
    if (!item || !canMoveNetdiskItemToFolder(kind, itemId, targetFolderId)) {
        return false;
    }

    setNetdiskItemParentId(kind, item, targetFolderId);
    saveFiles();
    return true;
}

function refreshNetdiskAfterMutation() {
    loadFiles().catch(error => {
        console.error('刷新网盘列表失败:', error);
    });
}

async function requestNetdiskMove(kind, itemId, targetFolderId, token) {
    const response = await fetch(`${API_BASE}/${kind === 'folder' ? 'folders' : 'files'}/${itemId}/move`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetFolderId })
    });
    const result = await response.json();

    if (result.code !== 200) {
        throw new Error(result.message || t('moveDialogValidation'));
    }
}

async function moveNetdiskItems(moveItems, targetFolderId, token) {
    let successCount = 0;
    let failedCount = 0;
    let firstError = '';
    const movedFolderIds = [];

    for (const item of moveItems) {
        if (!canMoveNetdiskItemToFolder(item.kind, item.id, targetFolderId)) {
            continue;
        }

        try {
            await requestNetdiskMove(item.kind, item.id, targetFolderId, token);
            if (applyLocalMove(item.kind, item.id, targetFolderId)) {
                if (item.kind === 'folder') {
                    movedFolderIds.push(item.id);
                }
                successCount++;
            }
        } catch (error) {
            failedCount++;
            if (!firstError) {
                firstError = error.message;
            }
        }
    }

    if (movedFolderIds.length > 0) {
        resetNetdiskNavigationForFolders(movedFolderIds);
    }

    return {
        successCount,
        failedCount,
        firstError
    };
}

function clearNetdiskDragState() {
    document.querySelectorAll('.netdisk-drop-target.is-over, .netdisk-drop-root.is-over').forEach(element => {
        element.classList.remove('is-over');
    });
    draggedNetdiskItems = null;
}

function buildDraggedNetdiskItems(kind, id) {
    if (selectionModeEnabled && isNetdiskItemSelected(kind, id)) {
        const selection = getSelectedNetdiskItems();
        const selectedFolders = normalizeSelectedFoldersForBatch(selection.folders);
        const selectedItems = [
            ...selection.files.map(file => ({ kind: 'file', id: file.id })),
            ...selectedFolders.map(folder => ({ kind: 'folder', id: folder.id }))
        ];

        if (selectedItems.length > 0) {
            return selectedItems;
        }
    }

    return [{ kind, id }];
}

function canDropDraggedNetdiskItems(targetFolderId) {
    if (!draggedNetdiskItems || !Array.isArray(draggedNetdiskItems.items)) {
        return false;
    }

    return draggedNetdiskItems.items.some(item => canMoveNetdiskItemToFolder(item.kind, item.id, targetFolderId));
}

function startNetdiskDrag(kind, id, event) {
    const items = buildDraggedNetdiskItems(kind, id);
    draggedNetdiskItems = { items };

    if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', items.map(item => getNetdiskSelectionKey(item.kind, item.id)).join(','));
    }
}

function endNetdiskDrag() {
    clearNetdiskDragState();
}

function handleNetdiskDragOver(event, targetFolderId) {
    if (!canDropDraggedNetdiskItems(targetFolderId)) {
        return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
    event.currentTarget?.classList.add('is-over');
}

function handleNetdiskDragLeave(event) {
    event.currentTarget?.classList.remove('is-over');
}

async function handleNetdiskDrop(event, targetFolderId) {
    event.preventDefault();
    event.currentTarget?.classList.remove('is-over');

    if (!canDropDraggedNetdiskItems(targetFolderId)) {
        clearNetdiskDragState();
        return;
    }

    const token = ensureAuthenticatedForAction();
    if (!token) {
        clearNetdiskDragState();
        return;
    }

    const result = await moveNetdiskItems(draggedNetdiskItems.items, targetFolderId, token);
    clearNetdiskDragState();

    if (result.successCount === 0 && result.failedCount === 0) {
        showToast(t('batchNoChanges'), 'success');
        return;
    }

    if (result.successCount === 0 && result.failedCount > 0) {
        showToast(result.firstError || t('moveDialogValidation'), 'error');
        refreshNetdiskAfterMutation();
        return;
    }

    if (selectionModeEnabled) {
        clearNetdiskSelection({ render: false });
    }
    rerenderNetdiskCurrentView();
    refreshNetdiskAfterMutation();
    showToast(formatBatchResultMessage('batchMoveSuccess', 'batchMovePartial', result.successCount, result.failedCount), result.failedCount > 0 ? 'error' : 'success');
}

function normalizeSelectedFoldersForBatch(selectedFolders) {
    const selectedFolderIds = new Set(selectedFolders.map(folder => folder.id));
    const folderMap = new Map(folders.map(folder => [folder.id, folder]));

    return selectedFolders.filter(folder => {
        let parentId = normalizeNetdiskFolderId(folder.parentId);
        while (parentId != null) {
            if (selectedFolderIds.has(parentId)) {
                return false;
            }
            parentId = normalizeNetdiskFolderId(folderMap.get(parentId)?.parentId);
        }
        return true;
    });
}

function resetNetdiskNavigationForFolders(folderIds) {
    if (!Array.isArray(folderIds) || folderIds.length === 0) {
        return;
    }

    const affectedIds = new Set(folderIds);
    if ((currentFolder != null && affectedIds.has(currentFolder)) || folderPath.some(folder => affectedIds.has(folder.id))) {
        currentFolder = null;
        folderPath = [];
        currentCategory = 'all';
        syncNetdiskHistoryState('replace');
    }
}

function formatBatchResultMessage(successKey, partialKey, successCount, failedCount) {
    if (failedCount > 0) {
        return t(partialKey)
            .replace('{success}', successCount)
            .replace('{failed}', failedCount);
    }
    return t(successKey).replace('{success}', successCount);
}

async function batchMoveSelected() {
    const selection = getSelectedNetdiskItems();
    if (selection.total === 0) {
        return;
    }

    const selectedFolders = normalizeSelectedFoldersForBatch(selection.folders);
    const blockedFolderIds = new Set();
    selectedFolders.forEach(folder => {
        collectBlockedFolderIds(folder.id).forEach(id => blockedFolderIds.add(id));
    });

    const folderMap = new Map((folders || []).map(folder => [folder.id, folder]));
    const pathCache = new Map();
    const destinations = (folders || [])
        .filter(folder => !blockedFolderIds.has(folder.id))
        .map(folder => ({
            id: folder.id,
            label: buildFolderPathLabel(folder.id, folderMap, pathCache)
        }))
        .sort((left, right) => left.label.localeCompare(right.label, getCurrentLanguage() === 'en' ? 'en' : 'zh'));

    const parentIds = [
        ...selection.files.map(file => normalizeComparableFolderId(file.folderId ?? file.parentId)),
        ...selectedFolders.map(folder => normalizeComparableFolderId(folder.parentId))
    ];
    const uniqueParentIds = [...new Set(parentIds)];
    const selectedTargetId = uniqueParentIds.length === 1 && !blockedFolderIds.has(uniqueParentIds[0])
        ? uniqueParentIds[0]
        : 0;

    openActionDialog({
        icon: 'fa-arrow-right-arrow-left',
        title: t('batchMoveDialogTitle'),
        description: t('batchMoveDialogDescription'),
        confirmText: t('batchMoveSelected'),
        confirmIcon: 'fa-folder-tree',
        content: `
            <div class="dialog-surface">
                <div class="text-sm font-semibold text-text-main">${escapeHtml(getSelectedNetdiskSummaryText())}</div>
                <p class="dialog-help">${escapeHtml(t('batchMoveDialogHelp'))}</p>
            </div>
            <div class="dialog-field">
                <label for="actionBatchMoveTarget">${escapeHtml(t('moveDialogTargetLabel'))}</label>
                <select id="actionBatchMoveTarget" data-autofocus>
                    <option value="0" ${selectedTargetId === 0 ? 'selected' : ''}>${escapeHtml(t('moveDialogRoot'))}</option>
                    ${destinations.map(destination => `
                        <option value="${destination.id}" ${selectedTargetId === destination.id ? 'selected' : ''}>
                            ${escapeHtml(destination.label)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `,
        onConfirm: async ({ setError, close, getValue }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            const parsedTargetId = Number.parseInt(getValue('actionBatchMoveTarget'), 10);
            const targetFolderId = Number.isNaN(parsedTargetId) ? null : parsedTargetId;
            if (targetFolderId == null || (blockedFolderIds.has(targetFolderId) && targetFolderId !== 0)) {
                setError(t('moveDialogValidation'));
                return;
            }
            const moveItems = [
                ...selection.files.map(file => ({ kind: 'file', id: file.id })),
                ...selectedFolders.map(folder => ({ kind: 'folder', id: folder.id }))
            ];
            const { successCount, failedCount, firstError } = await moveNetdiskItems(moveItems, targetFolderId, token);

            if (successCount === 0 && failedCount === 0) {
                close();
                showToast(t('batchNoChanges'), 'success');
                return;
            }

            if (successCount === 0 && failedCount > 0) {
                setError(firstError || t('moveDialogValidation'));
                return;
            }

            clearNetdiskSelection({ render: false });
            close();
            rerenderNetdiskCurrentView();
            refreshNetdiskAfterMutation();
            showToast(formatBatchResultMessage('batchMoveSuccess', 'batchMovePartial', successCount, failedCount), failedCount > 0 ? 'error' : 'success');
        }
    });
}

async function batchDeleteSelected() {
    const selection = getSelectedNetdiskItems();
    if (selection.total === 0) {
        return;
    }

    const selectedFolders = normalizeSelectedFoldersForBatch(selection.folders);

    openActionDialog({
        icon: 'fa-trash',
        tone: 'danger',
        confirmTone: 'danger',
        title: t('batchDeleteDialogTitle'),
        description: t('batchDeleteDialogDescription'),
        confirmText: t('batchDeleteSelected'),
        confirmIcon: 'fa-trash',
        content: `
            <div class="dialog-surface">
                <div class="text-sm font-semibold text-text-main">${escapeHtml(getSelectedNetdiskSummaryText())}</div>
                <p class="dialog-help">${escapeHtml(
                    t('batchDeleteDialogMeta')
                        .replace('{total}', selection.total)
                        .replace('{files}', selection.files.length)
                        .replace('{folders}', selectedFolders.length)
                )}</p>
            </div>
            <div class="dialog-note">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${escapeHtml(t('deleteDialogNote'))}</span>
            </div>
        `,
        onConfirm: async ({ setError, close }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            let successCount = 0;
            let failedCount = 0;
            let firstError = '';

            const requestDelete = async (kind, id) => {
                const response = await fetch(`${API_BASE}/${kind === 'folder' ? 'folders' : 'files'}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.status === 404) {
                    return;
                }

                const result = await response.json();
                if (result.code !== 200) {
                    throw new Error(result.message || t('deleteDialogUnknownError'));
                }
            };

            for (const file of selection.files) {
                try {
                    await requestDelete('file', file.id);
                    successCount++;
                } catch (error) {
                    failedCount++;
                    if (!firstError) {
                        firstError = error.message;
                    }
                }
            }

            for (const folder of selectedFolders) {
                try {
                    await requestDelete('folder', folder.id);
                    successCount++;
                } catch (error) {
                    failedCount++;
                    if (!firstError) {
                        firstError = error.message;
                    }
                }
            }

            if (successCount === 0 && failedCount > 0) {
                setError(firstError || t('deleteDialogUnknownError'));
                return;
            }

            resetNetdiskNavigationForFolders(selectedFolders.map(folder => folder.id));
            clearNetdiskSelection({ render: false });
            close();
            await loadFiles();
            showToast(formatBatchResultMessage('batchDeleteSuccess', 'batchDeletePartial', successCount, failedCount), failedCount > 0 ? 'error' : 'success');
        }
    });
}

// ================== 侧边栏 ==================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function updateAdminConsoleEntry(user) {
    // Admin console is only accessible via hidden URL, no UI entry needed
}

// ================== 登录验证 ==================
function getStoredNetdiskUser() {
    if (window.QuickShareSession && typeof window.QuickShareSession.getStoredUser === 'function') {
        return window.QuickShareSession.getStoredUser();
    }

    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
        return {};
    }
}

function renderQuotaDisplay(user) {
    const section = document.getElementById('quotaSection');
    if (!section || !user) return;
    section.style.display = 'block';

    // VIP status
    const vipEl = document.getElementById('userVipStatus');
    if (vipEl) {
        if (user.vipExpireTime) {
            const expDate = new Date(user.vipExpireTime);
            if (expDate > new Date()) {
                vipEl.textContent = t('quotaVipActive') + ' → ' + expDate.toLocaleDateString();
                vipEl.style.color = 'var(--success)';
            } else {
                vipEl.textContent = t('quotaVipExpired');
                vipEl.style.color = 'var(--danger)';
            }
        } else {
            vipEl.textContent = t('quotaNoVip');
            vipEl.style.color = '';
        }
    }

    // Storage quota
    const storageText = document.getElementById('quotaStorageText');
    const storageBar = document.getElementById('quotaStorageBar');
    if (storageText && user.storageLimit && user.storageLimit > 0) {
        const used = user.storageUsed || 0;
        const total = user.storageLimit;
        const pct = Math.min(100, Math.round(used / total * 100));
        storageText.textContent = formatFileSize(used) + ' / ' + formatFileSize(total);
        if (storageBar) {
            storageBar.style.width = pct + '%';
            storageBar.style.background = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : '';
        }
    } else if (storageText) {
        storageText.textContent = user.storageUsed ? formatFileSize(user.storageUsed) + ' / ' + t('quotaUnlimited') : t('quotaUnlimited');
        if (storageBar) storageBar.style.width = '0%';
    }

    // Download quota
    const dlText = document.getElementById('quotaDownloadsText');
    if (dlText) {
        const used = user.downloadUsed || 0;
        const limit = user.downloadLimit || 0;
        if (limit > 0) {
            dlText.textContent = used + ' / ' + limit;
        } else {
            dlText.textContent = used + ' / ' + t('quotaUnlimited');
        }
    }
}

function updateCurrentUserDisplay(user) {
    const nameEl = document.getElementById('userName');
    if (nameEl) {
        nameEl.textContent = user.nickname || user.username;
    }
    updateAdminConsoleEntry(user);
    renderQuotaDisplay(user);
}

async function checkLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('share')) return true;

    const token = localStorage.getItem('token');
    const user = getStoredNetdiskUser();

    if (!token || !user.username) {
        updateAdminConsoleEntry(null);
        return false;
    }

    updateCurrentUserDisplay(user);
    updateAdminConsoleEntry(null);

    if (window.QuickShareSession && typeof window.QuickShareSession.fetchProfile === 'function') {
        try {
            const freshUser = await window.QuickShareSession.fetchProfile();
            if (!freshUser || !freshUser.username) {
                updateAdminConsoleEntry(null);
                return false;
            }

            updateCurrentUserDisplay(freshUser);
            return true;
        } catch (error) {
            console.warn('Failed to sync current profile on netdisk page:', error);
        }
    }

    return true;
}

async function handleLogout() {
    openActionDialog({
        icon: 'fa-right-from-bracket',
        tone: 'danger',
        confirmTone: 'danger',
        title: t('logoutTitle'),
        description: t('logoutConfirm'),
        confirmText: t('logoutConfirmBtn'),
        confirmIcon: 'fa-right-from-bracket',
        content: `
            <div class="dialog-note">
                <i class="fa-solid fa-shield-heart"></i>
                <span>${escapeHtml(t('logoutDeviceNote'))}</span>
            </div>
        `,
        onConfirm: async ({ close }) => {
            if (window.QuickShareSession && typeof window.QuickShareSession.clear === 'function') {
                window.QuickShareSession.clear();
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
            close();
            window.location.href = 'index.html';
        }
    });
}

// ================== 视图切换 ==================
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-brand-50', 'text-brand-600');
    });
    event.target.closest('.view-btn').classList.add('active', 'bg-brand-50', 'text-brand-600');

    if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('gridView').classList.add('hidden');
    } else {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.remove('hidden');
    }
    renderFiles();
}

// ================== Row action menu (kebab) ==================
let _rowMenuOutsideClickBound = false;

function closeAllRowMenus() {
    document.querySelectorAll('.row-action-menu.is-open').forEach(function(menu) {
        menu.classList.remove('is-open');
    });
}

function toggleRowMenu(menuId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    var menu = document.getElementById(menuId);
    if (!menu) return;

    var wasOpen = menu.classList.contains('is-open');
    closeAllRowMenus();
    if (!wasOpen) {
        menu.classList.add('is-open');
    }
}

function bindRowMenuGlobalEvents() {
    if (_rowMenuOutsideClickBound) return;
    _rowMenuOutsideClickBound = true;

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.row-action-menu') && !e.target.closest('[aria-haspopup]')) {
            closeAllRowMenus();
        }
    });
}

function showCategory(category) {
    let nextCategory = category;
    let triggerEvent = null;

    if (typeof category !== 'string') {
        triggerEvent = category;
        nextCategory = arguments[1];
    } else {
        triggerEvent = window.event;
    }

    if (triggerEvent?.preventDefault) {
        triggerEvent.preventDefault();
    }

    currentCategory = normalizeNetdiskCategory(nextCategory);
    updateSidebarSelection();
    closeSidebarOnMobile();
    syncNetdiskHistoryState('push');
    renderFiles();
}

// ================== 文件操作 ==================
function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return FILE_TYPE_MAP[ext] || 'other';
}

function getUserStorageKey() {
    const user = getStoredNetdiskUser();
    const userId = user.id || user.username || 'default';
    return `uploadedFiles_${userId}_${window.location.host}`;
}

function saveFiles() {
    localStorage.setItem(getUserStorageKey(), JSON.stringify({ files, folders }));
}

let _loadFilesSeq = 0;
async function loadFiles() {
    _filesPageNum = 1;
    _filesTotalPages = 1;
    await _fetchFilesPage(1, false);
}

async function loadMoreFiles() {
    if (_filesLoading || _filesPageNum >= _filesTotalPages) return;
    await _fetchFilesPage(_filesPageNum + 1, true);
}

async function _fetchFilesPage(pageNum, append) {
    const seq = ++_loadFilesSeq;
    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        files = [];
        folders = [];
        rerenderNetdiskCurrentView();
        return;
    }

    _filesLoading = true;
    try {
        const cacheBuster = `_=${Date.now()}`;
        let filesUrl = `${API_BASE}/files?${cacheBuster}&pageNum=${pageNum}&pageSize=${NETDISK_PAGE_SIZE}`;
        if (currentFolder !== null) filesUrl += `&folderId=${currentFolder}`;

        const fetches = [
            fetch(filesUrl, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ];
        if (!append) {
            fetches.unshift(
                fetch(`${API_BASE}/folders/all?${cacheBuster}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            );
        }

        const responses = await Promise.all(fetches);
        const jsonResults = await Promise.all(responses.map(r => r.json()));

        if (seq !== _loadFilesSeq) return;

        let foldersResult, result;
        if (!append) {
            foldersResult = jsonResults[0];
            result = jsonResults[1];
        } else {
            result = jsonResults[0];
        }

        if ((foldersResult && foldersResult.code === 401) || result.code === 401) {
            await showAppAlert(t('loginExpired'), {
                tone: 'danger',
                icon: 'fa-user-clock'
            });
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        if (foldersResult) {
            folders = foldersResult.code === 200 && foldersResult.data ? foldersResult.data : [];
        }

        if (!append) {
            const navigationChanged = rebuildFolderPathFromCurrentFolder();
            updateSidebarSelection();
            if (navigationChanged) {
                syncNetdiskHistoryState('replace');
            }
        }

        if (result.code === 200 && result.data) {
            let pageData;
            // Support both paginated response (object with records) and legacy array response
            if (Array.isArray(result.data)) {
                pageData = result.data;
                _filesTotalPages = 1;
                _filesPageNum = 1;
            } else {
                pageData = result.data.records || [];
                _filesTotalPages = result.data.pages || 1;
                _filesPageNum = result.data.current || 1;
            }

            pageData.forEach(item => {
                if (item.isFolder === 1 || item.fileType === 'folder') {
                    item.name = item.originalName || item.fileName;
                    if (!folders.find(f => f.id === item.id)) folders.push(item);
                }
            });

            const newFiles = pageData.filter(item => item.isFolder !== 1 && item.fileType !== 'folder');
            newFiles.forEach(file => {
                if (!file.type) file.type = getFileType(file.originalName || file.fileName || file.name);
            });

            if (append) {
                files = files.concat(newFiles);
            } else {
                files = newFiles;
            }

            saveFiles();
            pruneNetdiskSelection();
            rerenderNetdiskCurrentView();
            renderLoadMoreButton();
        } else {
            throw new Error(result.message || t('loadFailed'));
        }
    } catch (error) {
        console.error('加载文件失败:', error);
        if (!append) {
            const saved = localStorage.getItem(getUserStorageKey());
            if (saved) {
                const savedData = JSON.parse(saved);
                files = savedData.files || [];
                folders = savedData.folders || [];
                rebuildFolderPathFromCurrentFolder();
                files.forEach(file => {
                    if (!file.type) file.type = getFileType(file.originalName || file.fileName || file.name);
                });
            } else {
                files = [];
                folders = [];
                folderPath = [];
            }
            pruneNetdiskSelection();
            updateSidebarSelection();
            rerenderNetdiskCurrentView();
        }
    } finally {
        _filesLoading = false;
    }
}

function renderLoadMoreButton() {
    let btn = document.getElementById('netdiskLoadMore');
    if (_filesPageNum >= _filesTotalPages) {
        if (btn) btn.remove();
        return;
    }
    const container = document.getElementById('listContent') || document.getElementById('gridView');
    if (!container) return;
    if (!btn) {
        btn = document.createElement('div');
        btn.id = 'netdiskLoadMore';
        btn.style.cssText = 'text-align:center; padding:16px 0;';
        btn.innerHTML = `<button class="toolbar-btn" onclick="loadMoreFiles()" style="min-width:200px;">
            <i class="fa-solid fa-chevron-down"></i> <span>${t('netdiskLoadMore') || 'Load more'}</span>
        </button>`;
    }
    container.parentElement.appendChild(btn);
}



// ================== 文件夹操作 ==================
async function createFolder() {
    openCreateFolderDialog();
}

function openFolder(folderId, folderName) {
    currentFolder = folderId;
    folderPath.push({ id: folderId, name: folderName });
    currentCategory = 'all';
    updateSidebarSelection('all');
    closeSidebarOnMobile();
    syncNetdiskHistoryState('push');
    loadFiles();
}

function navigateToFolderByIndex(index) {
    if (index < folderPath.length - 1) {
        folderPath = folderPath.slice(0, index + 1);
        currentFolder = folderPath[index].id;
    } else {
        return;
    }
    currentCategory = 'all';
    updateSidebarSelection('all');
    syncNetdiskHistoryState('push');
    loadFiles();
}

function navigateToFolder(folderId) {
    if (folderId === 0 || folderId === null) {
        currentFolder = null;
        folderPath = [];
        currentCategory = 'all';
    } else {
        currentFolder = folderId;
        currentCategory = 'all';
        rebuildFolderPathFromCurrentFolder();
    }

    updateSidebarSelection('all');
    syncNetdiskHistoryState('push');
    loadFiles();
}

async function renameFolder(folderId, oldName) {
    openRenameDialog({
        currentName: oldName,
        onSubmit: async (newName, { setError, close }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/folders/${folderId}/rename`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newName })
                });
                const result = await res.json();

                if (result.code === 200) {
                    folders.forEach(folder => {
                        if (folder.id === folderId) {
                            folder.name = newName;
                            folder.originalName = newName;
                            folder.fileName = newName;
                        }
                    });
                    folderPath.forEach(folder => {
                        if (folder.id === folderId) {
                            folder.name = newName;
                        }
                    });
                    saveFiles();
                    await loadFiles();
                    close();
                    showToast(t('renameSuccess'), 'success');
                } else {
                    setError(`${t('renameFailed')}: ${result.message}`);
                }
            } catch (e) {
                setError(`${t('renameFailed')}: ${e.message}`);
            }
        }
    });
}

async function moveFolder(folderId, folderName) {
    const folder = folders.find(item => item.id === folderId);
    openMoveDialog({
        kind: 'folder',
        itemId: folderId,
        name: folderName || getFolderDisplayName(folder),
        currentParentId: folder?.parentId ?? 0
    });
}

async function deleteFolder(folderId, folderName) {
    openDeleteDialog({
        name: folderName,
        meta: t('deleteDialogFolderMeta'),
        onConfirm: async ({ setError, close }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/folders/${folderId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 404) {
                    close();
                    showToast(t('deleteDialogAlreadyGone'), 'error');
                    await loadFiles();
                    return;
                }

                const result = await res.json();
                if (result.code === 200) {
                    if (currentFolder === folderId || folderPath.some(f => f.id === folderId)) {
                        currentFolder = null;
                        folderPath = [];
                        currentCategory = 'all';
                        syncNetdiskHistoryState('replace');
                    }
                    close();
                    showToast(t('deleteSuccess'), 'success');
                    await loadFiles();
                } else {
                    setError(`${t('deleteFailed')}: ${result.message || t('deleteDialogUnknownError')}`);
                }
            } catch (e) {
                setError(`${t('deleteFailed')}: ${e.message}`);
            }
        }
    });
}

// ================== 文件操作 ==================
async function shareFile(index) {
    openShareDialog(index);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
    } catch (e) {
        showAppCopyDialog(
            t('manualCopyFallback'),
            text
        );
    }
    document.body.removeChild(ta);
}

async function deleteFile(index) {
    const file = files[index];
    if (!file) return;

    openDeleteDialog({
        name: file.originalName || file.fileName || '-',
        meta: t('deleteDialogFileMeta'),
        onConfirm: async ({ setError, close }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/files/${file.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 404) {
                    close();
                    showToast(t('deleteDialogAlreadyGone'), 'error');
                    await loadFiles();
                    return;
                }

                const result = await res.json();

                if (result.code === 200) {
                    close();
                    showToast(t('deleteSuccess'), 'success');
                    await loadFiles();
                } else {
                    setError(`${t('deleteFailed')}: ${result.message}`);
                }
            } catch (e) {
                setError(`${t('deleteFailed')}: ${e.message}`);
            }
        }
    });
}

async function moveFile(index) {
    const file = files[index];
    if (!file) return;

    openMoveDialog({
        kind: 'file',
        itemId: file.id,
        name: file.originalName || file.fileName || '-',
        currentParentId: file.folderId ?? file.parentId ?? 0
    });
}

async function renameFile(index) {
    const file = files[index];
    if (!file) return;

    const oldName = file.originalName || file.fileName;
    openRenameDialog({
        currentName: oldName,
        onSubmit: async (newName, { setError, close }) => {
            const token = ensureAuthenticatedForAction();
            if (!token) {
                close();
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/files/${file.id}/rename`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newName })
                });
                const result = await res.json();

                if (result.code === 200) {
                    close();
                    showToast(t('renameSuccess'), 'success');
                    await loadFiles();
                } else {
                    setError(`${t('renameFailed')}: ${result.message}`);
                }
            } catch (e) {
                setError(`${t('renameFailed')}: ${e.message}`);
            }
        }
    });
}

function sortFiles(sortBy) {
    if (sortBy === 'name') {
        folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        files.sort((a, b) => (a.originalName || a.fileName || '').localeCompare(b.originalName || b.fileName || ''));
    } else if (sortBy === 'time') {
        folders.sort((a, b) => new Date(b.createTime || b.createdAt || 0) - new Date(a.createTime || a.createdAt || 0));
        files.sort((a, b) => new Date(b.uploadTime || b.time) - new Date(a.uploadTime || a.time));
    } else if (sortBy === 'size') {
        folders.sort((a, b) => (b.fileCount || 0) - (a.fileCount || 0));
        files.sort((a, b) => (b.fileSize || b.size || 0) - (a.fileSize || a.size || 0));
    } else if (sortBy === 'type') {
        files.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    }
    renderFiles();
}

// ================== 工具函数 ==================
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const lang = getCurrentLanguage();
    return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================== 页面初始化 ==================
async function initNetdisk() {
    bindActionDialogEvents();
    bindNetdiskHistoryEvents();
    bindRowMenuGlobalEvents();

    if (!await checkLogin()) {
        await showAppAlert(t('loginRequired'), {
            icon: 'fa-right-to-bracket'
        });
        window.location.href = 'login.html';
        return;
    }

    restoreNetdiskNavigationState(getNetdiskNavigationStateFromUrl(), { loadFiles: false });
    syncNetdiskHistoryState('replace');
    await loadPreviewPolicy();

    loadFiles();
}

// ================== 搜索功能 ==================
let searchTimeout = null;

function handleSearch(event) {
    const keyword = event.target.value.trim().toLowerCase();

    // 防抖：延迟 300ms 执行搜索
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchFiles(keyword);
    }, 300);
}

function searchFiles(keyword) {
    pruneNetdiskSelection();

    if (!keyword) {
        // 关键词为空，显示当前文件夹的所有文件
        const currentViewTitle = document.getElementById('currentViewTitle');
        if (currentViewTitle) {
            currentViewTitle.textContent = t('foldersAndFiles');
        }
        renderFiles();
        return;
    }

    const listContent = document.getElementById('listContent');
    const gridView = document.getElementById('gridView');
    const emptyState = document.getElementById('emptyState');

    // 搜索所有文件和文件夹
    const matchedFolders = folders.filter(folder => {
        const name = (folder.name || '').toLowerCase();
        return name.includes(keyword);
    });

    const matchedFiles = files.filter(file => {
        const name = (file.originalName || file.fileName || '').toLowerCase();
        return name.includes(keyword);
    });

    // 按分类筛选
    let filteredFiles;
    let displayFolders;

    if (currentCategory === 'all') {
        filteredFiles = matchedFiles;
        displayFolders = matchedFolders;
    } else {
        filteredFiles = matchedFiles.filter(file => file.type === currentCategory);
        displayFolders = [];
    }

    const allItems = [...displayFolders, ...filteredFiles];

    // 更新标题显示搜索结果数量
    const currentViewTitle = document.getElementById('currentViewTitle');
    if (currentViewTitle) {
        currentViewTitle.textContent = t('searchResultsTitle').replace('{count}', allItems.length);
    }

    // 空状态处理
    if (allItems.length === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.add('hidden');

        emptyState.querySelector('h3').textContent = t('noMatchingFiles');
        emptyState.querySelector('p').textContent = t('tryDifferentKeywords');

        listContent.innerHTML = '';
        gridView.innerHTML = '';
        updateNetdiskSelectionUI();
        return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('gridView').classList.add('hidden');
        renderListView(listContent, displayFolders, filteredFiles);
    } else {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.remove('hidden');
        renderGridView(gridView, displayFolders, filteredFiles);
    }

    updateNetdiskSelectionUI();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    const currentViewTitle = document.getElementById('currentViewTitle');
    if (currentViewTitle) {
        currentViewTitle.textContent = t('foldersAndFiles');
    }
    renderFiles();
}

// 页面加载
document.addEventListener('DOMContentLoaded', initNetdisk);

// ESC 关闭预览
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        var openMenus = document.querySelectorAll('.row-action-menu.is-open');
        if (openMenus.length > 0) {
            closeAllRowMenus();
            return;
        }
        closePreview();
    }
});

document.addEventListener('quickshare:languagechange', () => {
    rerenderNetdiskCurrentView();
});

window.getFilePreviewDecision = getFilePreviewDecision;
