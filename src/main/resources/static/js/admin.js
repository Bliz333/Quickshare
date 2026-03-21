/**
 * admin.js - 管理员后台页面逻辑
 */

const adminState = {
    currentUser: null,
    overview: null,
    users: [],
    files: [],
    shares: [],
    rateLimits: [],
    adminConsoleAccess: null,
    registrationSettings: null,
    fileUploadPolicy: null,
    filePreviewPolicy: null,
    corsPolicy: null,
    smtpPolicy: null,
    emailTemplates: [],
    storagePolicy: null,
    plans: [],
    paymentProviders: [],
    orders: [],
    editingPlanId: null,
    editingProviderId: null,
    isRedirecting: false
};

const ADMIN_PAGE_STORAGE_KEY = 'quickshare-admin-page';
const ADMIN_PAGE_NAMES = new Set([
    'overview',
    'users',
    'files',
    'shares',
    'plans',
    'payment',
    'security',
    'upload-preview',
    'storage',
    'email',
    'system'
]);
const CAPTCHA_VERIFY_DEFAULTS = {
    recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
    turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
};

function getStoredAdminUser() {
    if (window.QuickShareSession && typeof window.QuickShareSession.getStoredUser === 'function') {
        return window.QuickShareSession.getStoredUser();
    }

    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
        return {};
    }
}

function isAdminUser(user) {
    if (window.QuickShareSession && typeof window.QuickShareSession.hasAdminRole === 'function') {
        return window.QuickShareSession.hasAdminRole(user);
    }
    return !!user && typeof user.role === 'string' && user.role.toUpperCase() === 'ADMIN';
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function getCurrentLocale() {
    return getCurrentLanguage() === 'en' ? 'en-US' : 'zh-CN';
}

function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString(getCurrentLocale(), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatBytes(value) {
    if (typeof formatFileSize === 'function') {
        return formatFileSize(value || 0);
    }

    if (!value) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / Math.pow(1024, index);
    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatMegabytes(value) {
    if (!value || value <= 0) return '';

    const megabytes = value / (1024 * 1024);
    if (Number.isInteger(megabytes)) {
        return String(megabytes);
    }

    return String(Number(megabytes.toFixed(megabytes >= 10 ? 1 : 2)));
}

function formatPercent(value) {
    if (value == null || Number.isNaN(Number(value))) return '-';

    const numeric = Number(value);
    if (Number.isInteger(numeric)) {
        return `${numeric}%`;
    }

    return `${numeric.toFixed(1)}%`;
}

function getStorageRiskLabel(level) {
    switch (level) {
        case 'critical':
            return t('adminStorageRiskCritical');
        case 'warning':
            return t('adminStorageRiskWarning');
        case 'healthy':
            return t('adminStorageRiskHealthy');
        default:
            return t('adminStorageRiskUnknown');
    }
}

function getStorageRiskValueClass(level) {
    switch (level) {
        case 'critical':
            return 'text-rose-600 dark:text-rose-300';
        case 'warning':
            return 'text-amber-600 dark:text-amber-300';
        case 'healthy':
            return 'text-emerald-600 dark:text-emerald-300';
        default:
            return 'text-text-main';
    }
}

function getStorageRiskIcon(level) {
    switch (level) {
        case 'critical':
            return 'fa-triangle-exclamation';
        case 'warning':
            return 'fa-gauge-high';
        default:
            return 'fa-shield-heart';
    }
}

function getStorageConnectionLabel(connectionStatus) {
    return connectionStatus === 'connected'
        ? t('adminStorageConnected')
        : connectionStatus === 'local'
            ? t('adminStorageTestLocal')
            : connectionStatus === 'not_configured'
                ? t('adminStorageNotConfigured')
                : (connectionStatus || '-');
}

function getStorageRuntimeHint(policy) {
    if (!policy || policy.type === 's3') {
        return t('adminStorageRuntimeS3Hint');
    }

    if (policy.localDiskRiskLevel === 'critical') {
        return t('adminStorageRuntimeLocalHintCritical');
    }

    if (policy.localDiskRiskLevel === 'warning') {
        return t('adminStorageRuntimeLocalHintWarning');
    }

    return t('adminStorageRuntimeLocalHint');
}

function buildOverviewStorageCard(policy) {
    if (!policy) return null;

    if (policy.type === 's3') {
        return {
            key: 'storage-runtime',
            icon: 'fa-cloud',
            label: t('adminStatStorageRuntime'),
            value: getStorageConnectionLabel(policy.connectionStatus),
            meta: policy.s3Bucket || policy.s3Endpoint || '-'
        };
    }

    return {
        key: 'storage-risk',
        icon: getStorageRiskIcon(policy.localDiskRiskLevel),
        iconClass: getStorageRiskValueClass(policy.localDiskRiskLevel),
        label: t('adminStatStorageRisk'),
        value: `${getStorageRiskLabel(policy.localDiskRiskLevel)} · ${formatPercent(policy.localDiskUsablePercent)}`,
        valueClass: getStorageRiskValueClass(policy.localDiskRiskLevel),
        meta: policy.localUploadDir || '-'
    };
}

async function confirmAdminAction(message, options = {}) {
    const tone = options.tone || 'danger';
    return showAppConfirm(message, {
        tone,
        icon: options.icon || (tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-question'),
        ...options
    });
}

async function promptAdminInput(message, options = {}) {
    return showAppPrompt(message, {
        icon: options.icon || 'fa-pen',
        ...options
    });
}

function getRoleLabel(role) {
    return role === 'ADMIN' ? t('adminRoleAdmin') : t('adminRoleUser');
}

function getCurrentUserName() {
    const user = adminState.currentUser || {};
    return user.nickname || user.username || '-';
}

function updateAdminProfile() {
    const user = adminState.currentUser || {};
    const name = user.nickname || user.username || '-';
    const roleText = getRoleLabel((user.role || 'USER').toUpperCase());
    const email = user.email || '';
    const metaText = email ? `${roleText} · ${email}` : roleText;

    const nameEl = document.getElementById('adminUserName');
    const metaEl = document.getElementById('adminUserMeta');
    const avatarEl = document.getElementById('adminAvatar');

    if (nameEl) nameEl.textContent = name;
    if (metaEl) metaEl.textContent = metaText;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase() || 'A';
}

function setLoading(loading) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.toggle('hidden', !loading);
}

function clearSession() {
    if (window.QuickShareSession && typeof window.QuickShareSession.clear === 'function') {
        window.QuickShareSession.clear();
        return;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function redirectWithToast(message, target) {
    if (adminState.isRedirecting) return;
    adminState.isRedirecting = true;

    if (typeof showToast === 'function' && message) {
        showToast(message, 'error');
    }

    setTimeout(() => {
        window.location.href = target;
    }, 900);
}

async function ensureAdminAccess() {
    const token = localStorage.getItem('token');
    const user = getStoredAdminUser();

    if (!token || !user.username) {
        window.location.href = 'login.html';
        return false;
    }

    adminState.currentUser = {
        ...user,
        role: (user.role || 'USER').toUpperCase()
    };
    updateAdminProfile();

    if (window.QuickShareSession && typeof window.QuickShareSession.fetchProfile === 'function') {
        try {
            const freshUser = await window.QuickShareSession.fetchProfile();
            if (!freshUser || !freshUser.username) {
                window.location.href = 'login.html';
                return false;
            }

            adminState.currentUser = {
                ...freshUser,
                role: (freshUser.role || 'USER').toUpperCase()
            };
            updateAdminProfile();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast(error.message || t('adminLoadFailed'), 'error');
            }
            return false;
        }
    }

    if (!isAdminUser(adminState.currentUser)) {
        redirectWithToast(t('adminAccessDenied'), 'netdisk.html');
        return false;
    }

    return true;
}

async function adminRequest(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    });

    const rawText = await response.text();
    let result = null;

    if (rawText) {
        try {
            result = JSON.parse(rawText);
        } catch (error) {
            result = null;
        }
    }

    if (response.status === 401 || result?.code === 401) {
        clearSession();
        redirectWithToast(t('adminSessionExpired'), 'login.html');
        throw new Error(t('adminSessionExpired'));
    }

    if (response.status === 403 || result?.code === 403) {
        redirectWithToast(t('adminAccessDenied'), 'netdisk.html');
        throw new Error(t('adminAccessDenied'));
    }

    if (!response.ok || (result && result.code !== 200)) {
        throw new Error(result?.message || t('adminLoadFailed'));
    }

    return result ? result.data : null;
}

function renderOverview() {
    const container = document.getElementById('overviewCards');
    if (!container) return;

    const overview = adminState.overview || {
        userCount: 0,
        fileCount: 0,
        folderCount: 0,
        shareCount: 0,
        activeShareCount: 0,
        totalStorageBytes: 0
    };

    const cards = [
        { key: 'users', icon: 'fa-users', label: t('adminStatUsers'), value: overview.userCount || 0 },
        { key: 'files', icon: 'fa-file-lines', label: t('adminStatFiles'), value: overview.fileCount || 0 },
        { key: 'folders', icon: 'fa-folder-tree', label: t('adminStatFolders'), value: overview.folderCount || 0 },
        { key: 'shares', icon: 'fa-share-nodes', label: t('adminStatShares'), value: overview.shareCount || 0 },
        { key: 'active-shares', icon: 'fa-signal', label: t('adminStatActiveShares'), value: overview.activeShareCount || 0 },
        { key: 'storage-used', icon: 'fa-hard-drive', label: t('adminStatStorage'), value: formatBytes(overview.totalStorageBytes || 0) }
    ];
    const storageCard = buildOverviewStorageCard(adminState.storagePolicy);
    if (storageCard) {
        cards.push(storageCard);
    }

    container.innerHTML = cards.map(card => `
        <article class="stat-card glass-card" data-overview-card="${escapeHtml(card.key || '')}">
            <div class="flex items-start justify-between gap-4 relative z-10">
                <div class="space-y-4">
                    <div class="stat-icon ${card.iconClass || ''}">
                        <i class="fa-solid ${card.icon}"></i>
                    </div>
                    <div>
                        <p class="text-sm text-text-sub">${escapeHtml(card.label)}</p>
                        <h3 class="text-2xl md:text-3xl font-semibold mt-2 ${card.valueClass || ''}">${escapeHtml(card.value)}</h3>
                        ${card.meta ? `<p class="text-xs text-text-sub mt-3 break-all">${escapeHtml(card.meta)}</p>` : ''}
                    </div>
                </div>
            </div>
        </article>
    `).join('');
}

function renderUsers() {
    const body = document.getElementById('usersTableBody');
    const badge = document.getElementById('usersCountBadge');
    if (!body || !badge) return;

    const users = [...adminState.users].sort((left, right) => {
        return new Date(right.createTime || 0).getTime() - new Date(left.createTime || 0).getTime();
    });

    badge.textContent = String(users.length);

    if (users.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">${escapeHtml(t('adminEmptyUsers'))}</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map(user => {
        const normalizedRole = (user.role || 'USER').toUpperCase();
        const isSelf = adminState.currentUser && user.id === adminState.currentUser.id;
        const nextRole = normalizedRole === 'ADMIN' ? 'USER' : 'ADMIN';
        const actionText = normalizedRole === 'ADMIN' ? t('adminDemote') : t('adminPromote');
        const roleClass = normalizedRole === 'ADMIN' ? 'role-admin' : 'role-user';
        const nameText = escapeHtml(user.username || '-');
        const emailText = escapeHtml(user.email || '-');
        const nicknameText = escapeHtml(user.nickname || '-');
        const currentMarker = isSelf ? ` <span class="text-xs text-text-sub">(${escapeHtml(t('adminYou'))})</span>` : '';

        return `
            <tr>
                <td>
                    <div class="font-medium text-text-main">${nameText}${currentMarker}</div>
                </td>
                <td class="text-text-sub">${nicknameText}</td>
                <td class="text-text-sub">${emailText}</td>
                <td class="text-text-sub">${escapeHtml(formatDateTime(user.createTime))}</td>
                <td>
                    <span class="role-chip ${roleClass}">
                        <i class="fa-solid ${normalizedRole === 'ADMIN' ? 'fa-shield' : 'fa-user'}"></i>
                        ${escapeHtml(getRoleLabel(normalizedRole))}
                    </span>
                </td>
                <td>
                    <div class="flex flex-wrap gap-2">
                        <button type="button"
                                class="action-btn ${normalizedRole === 'ADMIN' ? 'danger' : ''}"
                                onclick="toggleUserRole(${user.id}, '${nextRole}', this)">
                            <i class="fa-solid ${normalizedRole === 'ADMIN' ? 'fa-user-minus' : 'fa-user-shield'}"></i>
                            <span>${escapeHtml(actionText)}</span>
                        </button>
                        <button type="button"
                                class="action-btn danger"
                                onclick="deleteAdminUser(${user.id}, this)"
                                ${isSelf ? 'disabled' : ''}>
                            <i class="fa-solid fa-user-xmark"></i>
                            <span>${escapeHtml(t('adminDeleteUser'))}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getFileTypeLabel(file) {
    if (file.isFolder === 1) return t('folder');
    return file.fileType ? String(file.fileType).toUpperCase() : '-';
}

function renderFiles() {
    const body = document.getElementById('filesTableBody');
    const badge = document.getElementById('filesCountBadge');
    if (!body || !badge) return;

    const files = [...adminState.files].sort((left, right) => {
        return new Date(right.uploadTime || 0).getTime() - new Date(left.uploadTime || 0).getTime();
    });

    badge.textContent = String(files.length);

    if (files.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">${escapeHtml(t('adminEmptyFiles'))}</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = files.map(file => {
        const displayName = file.originalName || `${t('folder')} #${file.id}`;
        const owner = file.username || t('adminUnknownUser');
        const size = file.isFolder === 1 ? '-' : formatBytes(file.fileSize || 0);

        return `
            <tr>
                <td>
                    <div class="font-medium text-text-main">${escapeHtml(displayName)}</div>
                    <div class="text-xs text-text-sub mono mt-1">#${escapeHtml(file.id)}</div>
                </td>
                <td class="text-text-sub">${escapeHtml(owner)}</td>
                <td class="text-text-sub">${escapeHtml(getFileTypeLabel(file))}</td>
                <td class="text-text-sub">${escapeHtml(size)}</td>
                <td class="text-text-sub">${escapeHtml(formatDateTime(file.uploadTime))}</td>
                <td>
                    <button type="button" class="action-btn danger" onclick="deleteAdminFile(${file.id}, this)">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>${escapeHtml(t('adminForceDelete'))}</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getShareStatus(share) {
    if ((share.status || 0) !== 1) {
        return {
            className: 'status-disabled',
            icon: 'fa-ban',
            label: t('adminStatusDisabled')
        };
    }

    if (share.expireTime && new Date(share.expireTime).getTime() < Date.now()) {
        return {
            className: 'status-expired',
            icon: 'fa-clock',
            label: t('adminStatusExpired')
        };
    }

    return {
        className: 'status-active',
        icon: 'fa-circle-check',
        label: t('adminStatusActive')
    };
}

function formatDownloads(share) {
    const used = share.downloadCount || 0;
    const total = share.maxDownload == null ? t('unlimited') : share.maxDownload;
    return `${used} / ${total}`;
}

function renderShares() {
    const body = document.getElementById('sharesTableBody');
    const badge = document.getElementById('sharesCountBadge');
    if (!body || !badge) return;

    const shares = [...adminState.shares].sort((left, right) => {
        return new Date(right.createTime || 0).getTime() - new Date(left.createTime || 0).getTime();
    });

    badge.textContent = String(shares.length);

    if (shares.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="8" class="empty-row">${escapeHtml(t('adminEmptyShares'))}</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = shares.map(share => {
        const status = getShareStatus(share);
        const owner = share.username || t('adminUnknownUser');
        const fileName = share.fileName || `#${share.fileId}`;
        const extractCode = share.extractCode || t('none');

        return `
            <tr>
                <td>
                    <div class="mono font-medium text-text-main">${escapeHtml(share.shareCode || '-')}</div>
                    <div class="text-xs text-text-sub mono mt-1">#${escapeHtml(share.id)}</div>
                </td>
                <td class="text-text-sub">${escapeHtml(fileName)}</td>
                <td class="text-text-sub">${escapeHtml(owner)}</td>
                <td class="mono text-text-sub">${escapeHtml(extractCode)}</td>
                <td class="text-text-sub">${escapeHtml(formatDateTime(share.expireTime))}</td>
                <td class="text-text-sub">${escapeHtml(formatDownloads(share))}</td>
                <td>
                    <span class="status-chip ${status.className}">
                        <i class="fa-solid ${status.icon}"></i>
                        ${escapeHtml(status.label)}
                    </span>
                </td>
                <td>
                    <button type="button"
                            class="action-btn danger"
                            onclick="disableAdminShare(${share.id}, this)"
                            ${share.status === 1 ? '' : 'disabled'}>
                        <i class="fa-solid fa-link-slash"></i>
                        <span>${escapeHtml(t('adminDisableShare'))}</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getRateLimitSceneLabel(scene) {
    switch (scene) {
        case 'guest-upload':
            return t('adminSceneGuestUpload');
        case 'public-share-info':
            return t('adminScenePublicShareInfo');
        case 'public-download':
            return t('adminScenePublicDownload');
        case 'public-share-extract-code-error':
            return t('adminScenePublicShareExtractCodeError');
        default:
            return scene;
    }
}

function toSceneDomId(scene) {
    return String(scene || '').replace(/[^a-z0-9]+/ig, '-').toLowerCase();
}

function renderRateLimitPolicies() {
    const body = document.getElementById('rateLimitTableBody');
    if (!body) return;

    const policies = [...(adminState.rateLimits || [])];
    if (policies.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="empty-row">${escapeHtml(t('adminLoading'))}</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = policies.map(policy => {
        const sceneId = toSceneDomId(policy.scene);

        return `
            <tr>
                <td>
                    <div class="font-medium text-text-main">${escapeHtml(getRateLimitSceneLabel(policy.scene))}</div>
                    <div class="text-xs text-text-sub mono mt-1">${escapeHtml(policy.scene)}</div>
                </td>
                <td>
                    <input id="rate-enabled-${sceneId}" type="checkbox" class="settings-checkbox" ${policy.enabled ? 'checked' : ''}>
                </td>
                <td>
                    <input id="rate-max-${sceneId}" type="number" min="1" class="settings-field" value="${escapeHtml(policy.maxRequests)}">
                </td>
                <td>
                    <input id="rate-window-${sceneId}" type="number" min="1" class="settings-field" value="${escapeHtml(policy.windowSeconds)}">
                </td>
                <td>
                    <button type="button" class="action-btn" onclick="saveRateLimitPolicy('${escapeHtml(policy.scene)}', this)">
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>${escapeHtml(t('adminSaveSettings'))}</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function buildAdminConsolePath(entrySlug) {
    const normalizedSlug = String(entrySlug || '').trim().toLowerCase();
    return `/console/${normalizedSlug || 'quickshare-admin'}`;
}

function updateAdminConsolePathPreview() {
    const input = document.getElementById('adminConsoleSlug');
    const preview = document.getElementById('adminConsolePathPreviewValue');
    if (!preview) return;

    preview.textContent = buildAdminConsolePath(input?.value);
}

function getSelectedCaptchaProvider() {
    const provider = document.getElementById('registrationCaptchaProvider')?.value;
    return provider === 'turnstile' ? 'turnstile' : 'recaptcha';
}

function updateRegistrationCaptchaCopy() {
    const provider = getSelectedCaptchaProvider();
    const siteKeyLabel = document.getElementById('registrationCaptchaSiteKeyLabel');
    const secretKeyLabel = document.getElementById('registrationCaptchaSecretKeyLabel');
    const verifyUrlLabel = document.getElementById('registrationCaptchaVerifyUrlLabel');
    const verifyUrlInput = document.getElementById('registrationRecaptchaVerifyUrl');
    const verifyHint = document.getElementById('registrationCaptchaVerifyHint');
    const defaultUrl = CAPTCHA_VERIFY_DEFAULTS[provider];

    if (siteKeyLabel) {
        siteKeyLabel.textContent = t(provider === 'turnstile'
            ? 'adminCaptchaTurnstileSiteKey'
            : 'adminCaptchaRecaptchaSiteKey');
    }
    if (secretKeyLabel) {
        secretKeyLabel.textContent = t(provider === 'turnstile'
            ? 'adminCaptchaTurnstileSecretKey'
            : 'adminCaptchaRecaptchaSecretKey');
    }
    if (verifyUrlLabel) {
        verifyUrlLabel.textContent = t('adminCaptchaVerifyUrlLabel');
    }
    if (verifyUrlInput) {
        verifyUrlInput.placeholder = defaultUrl;
    }
    if (verifyHint) {
        verifyHint.textContent = t(provider === 'turnstile'
            ? 'adminCaptchaVerifyUrlHintTurnstile'
            : 'adminCaptchaVerifyUrlHintRecaptcha').replace('{url}', defaultUrl);
    }
}

function bindRegistrationSettingsEvents() {
    const providerEl = document.getElementById('registrationCaptchaProvider');
    if (!providerEl || providerEl.dataset.bound === 'true') return;

    providerEl.addEventListener('change', updateRegistrationCaptchaCopy);
    providerEl.dataset.bound = 'true';
}

function renderAdminConsoleAccessForm() {
    const config = adminState.adminConsoleAccess;
    if (!config) return;

    const slugEl = document.getElementById('adminConsoleSlug');
    if (slugEl) {
        slugEl.value = config.entrySlug || '';
    }
    updateAdminConsolePathPreview();
}

function renderRegistrationSettingsForm() {
    const settings = adminState.registrationSettings;
    if (!settings) return;

    const emailVerificationEl = document.getElementById('registrationEmailVerificationEnabled');
    const recaptchaEnabledEl = document.getElementById('registrationRecaptchaEnabled');
    const providerEl = document.getElementById('registrationCaptchaProvider');
    const siteKeyEl = document.getElementById('registrationRecaptchaSiteKey');
    const secretKeyEl = document.getElementById('registrationRecaptchaSecretKey');
    const verifyUrlEl = document.getElementById('registrationRecaptchaVerifyUrl');

    if (emailVerificationEl) emailVerificationEl.checked = !!settings.emailVerificationEnabled;
    if (recaptchaEnabledEl) recaptchaEnabledEl.checked = !!settings.recaptchaEnabled;
    if (providerEl) providerEl.value = settings.captchaProvider || 'recaptcha';
    if (siteKeyEl) siteKeyEl.value = settings.recaptchaSiteKey || '';
    if (secretKeyEl) secretKeyEl.value = settings.recaptchaSecretKey || '';
    if (verifyUrlEl) verifyUrlEl.value = settings.recaptchaVerifyUrl || '';
    updateRegistrationCaptchaCopy();
}

function renderCorsPolicyForm() {
    const policy = adminState.corsPolicy;
    if (!policy) return;

    const originsEl = document.getElementById('corsAllowedOrigins');
    const methodsEl = document.getElementById('corsAllowedMethods');
    const headersEl = document.getElementById('corsAllowedHeaders');
    const credentialsEl = document.getElementById('corsAllowCredentials');
    const maxAgeEl = document.getElementById('corsMaxAgeSeconds');

    if (originsEl) originsEl.value = (policy.allowedOrigins || []).join('\n');
    if (methodsEl) methodsEl.value = (policy.allowedMethods || []).join(',');
    if (headersEl) headersEl.value = (policy.allowedHeaders || []).join(',');
    if (credentialsEl) credentialsEl.checked = !!policy.allowCredentials;
    if (maxAgeEl) maxAgeEl.value = policy.maxAgeSeconds || 3600;
}

function buildUploadPolicyHint(policy) {
    const hardLimitText = policy?.hardMaxFileSizeBytes > 0
        ? formatBytes(policy.hardMaxFileSizeBytes)
        : '-';
    const runtimeLimitText = policy?.maxFileSizeBytes > 0
        ? formatBytes(policy.maxFileSizeBytes)
        : null;

    if (getCurrentLanguage() === 'en') {
        return runtimeLimitText
            ? `Runtime upload limit: ${runtimeLimitText}. Current server hard cap: ${hardLimitText}.`
            : `No extra runtime size limit. Current server hard cap: ${hardLimitText}.`;
    }

    return runtimeLimitText
        ? `当前服务层上传限制：${runtimeLimitText}。当前服务硬上限：${hardLimitText}。`
        : `当前未启用额外服务层大小限制。当前服务硬上限：${hardLimitText}。`;
}

function toggleUploadSizeLimit() {
    const enabledEl = document.getElementById('uploadSizeLimitEnabled');
    const valueEl = document.getElementById('uploadMaxFileSizeMb');
    if (!enabledEl || !valueEl) return;

    valueEl.disabled = !enabledEl.checked;
    if (!enabledEl.checked) {
        valueEl.value = '';
    } else if (!valueEl.value) {
        const currentBytes = adminState.fileUploadPolicy?.maxFileSizeBytes || 0;
        if (currentBytes > 0) {
            valueEl.value = formatMegabytes(currentBytes);
        }
    }
}

function renderUploadPolicyForm() {
    const policy = adminState.fileUploadPolicy;
    if (!policy) return;

    const guestUploadEl = document.getElementById('guestUploadEnabled');
    const enabledEl = document.getElementById('uploadSizeLimitEnabled');
    const maxEl = document.getElementById('uploadMaxFileSizeMb');
    const extensionsEl = document.getElementById('uploadAllowedExtensions');
    const hintEl = document.getElementById('uploadPolicyHint');

    if (guestUploadEl) guestUploadEl.checked = policy.guestUploadEnabled !== false;
    if (enabledEl) enabledEl.checked = (policy.maxFileSizeBytes || 0) > 0;
    if (maxEl) {
        maxEl.value = policy.maxFileSizeBytes > 0 ? formatMegabytes(policy.maxFileSizeBytes) : '';
    }
    if (extensionsEl) extensionsEl.value = (policy.allowedExtensions || []).join('\n');
    if (hintEl) hintEl.textContent = buildUploadPolicyHint(policy);

    toggleUploadSizeLimit();
}

function buildPreviewPolicyHint() {
    return t('adminPreviewPolicyHint');
}

function renderPreviewPolicyForm() {
    const policy = adminState.filePreviewPolicy;
    if (!policy) return;

    const enabledEl = document.getElementById('previewEnabled');
    const imageEl = document.getElementById('previewImageEnabled');
    const videoEl = document.getElementById('previewVideoEnabled');
    const audioEl = document.getElementById('previewAudioEnabled');
    const pdfEl = document.getElementById('previewPdfEnabled');
    const textEl = document.getElementById('previewTextEnabled');
    const officeEl = document.getElementById('previewOfficeEnabled');
    const extensionsEl = document.getElementById('previewAllowedExtensions');
    const hintEl = document.getElementById('previewPolicyHint');

    if (enabledEl) enabledEl.checked = policy.enabled !== false;
    if (imageEl) imageEl.checked = policy.imageEnabled !== false;
    if (videoEl) videoEl.checked = policy.videoEnabled !== false;
    if (audioEl) audioEl.checked = policy.audioEnabled !== false;
    if (pdfEl) pdfEl.checked = policy.pdfEnabled !== false;
    if (textEl) textEl.checked = policy.textEnabled !== false;
    if (officeEl) officeEl.checked = policy.officeEnabled !== false;
    if (extensionsEl) extensionsEl.value = (policy.allowedExtensions || []).join('\n');
    if (hintEl) hintEl.textContent = buildPreviewPolicyHint();
}

async function refreshPolicySettings(showSuccess = false, silentFailure = false) {
    try {
        const [rateLimits, adminConsoleAccess, registrationSettings, fileUploadPolicy, filePreviewPolicy, corsPolicy, smtpPolicy, emailTemplates, storagePolicy, plans, paymentProviders] = await Promise.all([
            adminRequest('/admin/settings/rate-limits'),
            adminRequest('/admin/settings/admin-console'),
            adminRequest('/admin/settings/registration'),
            adminRequest('/admin/settings/file-upload'),
            adminRequest('/admin/settings/file-preview'),
            adminRequest('/admin/settings/cors'),
            adminRequest('/admin/settings/smtp'),
            adminRequest('/admin/settings/email-templates'),
            adminRequest('/admin/settings/storage'),
            adminRequest('/admin/plans'),
            adminRequest('/admin/payment-providers')
        ]);

        adminState.rateLimits = rateLimits || [];
        adminState.adminConsoleAccess = adminConsoleAccess || null;
        adminState.registrationSettings = registrationSettings || null;
        adminState.fileUploadPolicy = fileUploadPolicy || null;
        adminState.filePreviewPolicy = filePreviewPolicy || null;
        adminState.corsPolicy = corsPolicy || null;
        adminState.smtpPolicy = smtpPolicy || null;
        adminState.emailTemplates = emailTemplates || [];
        adminState.storagePolicy = storagePolicy || null;
        adminState.plans = plans || [];
        adminState.paymentProviders = paymentProviders || [];
        renderRateLimitPolicies();
        renderAdminConsoleAccessForm();
        renderRegistrationSettingsForm();
        renderUploadPolicyForm();
        renderPreviewPolicyForm();
        renderCorsPolicyForm();
        renderStoragePolicyForm();
        renderOverview();
        renderEmailTemplates();
        renderSmtpPolicyForm();
        renderPlans();
        renderPaymentProviders();

        if (showSuccess && typeof showToast === 'function') {
            showToast(t('adminRefreshSuccess'), 'success');
        }
    } catch (error) {
        if (!silentFailure && !adminState.isRedirecting && typeof showToast === 'function') {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    }
}

async function refreshAdminData(showSuccess = false, skipAccessCheck = false) {
    if (!skipAccessCheck && !await ensureAdminAccess()) return;

    setLoading(true);
    try {
        const [overview, users, files, shares, orders] = await Promise.all([
            adminRequest('/admin/overview'),
            adminRequest('/admin/users'),
            adminRequest('/admin/files'),
            adminRequest('/admin/shares'),
            adminRequest('/admin/orders')
        ]);

        adminState.overview = overview || {};
        adminState.users = users || [];
        adminState.files = files || [];
        adminState.shares = shares || [];
        adminState.orders = orders || [];

        renderOverview();
        renderUsers();
        renderFiles();
        renderShares();
        renderOrders();
        await refreshPolicySettings(showSuccess, true);
    } catch (error) {
        if (!adminState.isRedirecting && typeof showToast === 'function') {
            showToast(error.message || t('adminLoadFailed'), 'error');
        }
    } finally {
        setLoading(false);
    }
}

async function saveRegistrationSettings(button) {
    const emailVerificationEnabled = !!document.getElementById('registrationEmailVerificationEnabled')?.checked;
    const recaptchaEnabled = !!document.getElementById('registrationRecaptchaEnabled')?.checked;
    const captchaProvider = document.getElementById('registrationCaptchaProvider')?.value || 'recaptcha';
    const recaptchaSiteKey = document.getElementById('registrationRecaptchaSiteKey')?.value.trim() || '';
    const recaptchaSecretKey = document.getElementById('registrationRecaptchaSecretKey')?.value.trim() || '';
    const recaptchaVerifyUrl = document.getElementById('registrationRecaptchaVerifyUrl')?.value.trim() || '';

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/registration', {
            method: 'PUT',
            body: JSON.stringify({
                emailVerificationEnabled,
                recaptchaEnabled,
                captchaProvider,
                recaptchaSiteKey,
                recaptchaSecretKey,
                recaptchaVerifyUrl
            })
        });

        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function saveAdminConsoleAccess(button) {
    const slugEl = document.getElementById('adminConsoleSlug');
    const entrySlug = slugEl?.value.trim().toLowerCase() || '';

    if (!entrySlug) {
        showToast(t('adminPolicySaveFailed'), 'error');
        return;
    }

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/admin-console', {
            method: 'PUT',
            body: JSON.stringify({ entrySlug })
        });

        await refreshPolicySettings(false, false);
        showToast(t('adminPolicySaved'), 'success');

        const nextPath = adminState.adminConsoleAccess?.entryPath || buildAdminConsolePath(entrySlug);
        if (window.location.pathname !== nextPath) {
            window.location.href = nextPath;
        }
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function saveRateLimitPolicy(scene, button) {
    const sceneId = toSceneDomId(scene);
    const enabledEl = document.getElementById(`rate-enabled-${sceneId}`);
    const maxEl = document.getElementById(`rate-max-${sceneId}`);
    const windowEl = document.getElementById(`rate-window-${sceneId}`);

    const maxRequests = Number(maxEl?.value);
    const windowSeconds = Number(windowEl?.value);

    if (!enabledEl || !Number.isFinite(maxRequests) || maxRequests <= 0 || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
        showToast(t('adminPolicySaveFailed'), 'error');
        return;
    }

    button.disabled = true;

    try {
        await adminRequest(`/admin/settings/rate-limits/${scene}`, {
            method: 'PUT',
            body: JSON.stringify({
                enabled: enabledEl.checked,
                maxRequests,
                windowSeconds
            })
        });

        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

function parseMultiLineList(rawValue) {
    return String(rawValue || '')
        .split(/\n|,/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

async function saveUploadPolicySettings(button) {
    const guestUploadEnabled = !!document.getElementById('guestUploadEnabled')?.checked;
    const enabledEl = document.getElementById('uploadSizeLimitEnabled');
    const maxEl = document.getElementById('uploadMaxFileSizeMb');
    const allowedExtensions = parseMultiLineList(document.getElementById('uploadAllowedExtensions')?.value)
        .map(item => item.startsWith('.') ? item.substring(1) : item)
        .map(item => item.toLowerCase());

    let maxFileSizeBytes = -1;
    if (enabledEl?.checked) {
        const maxFileSizeMb = Number(maxEl?.value);
        if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb <= 0) {
            showToast(t('adminPolicySaveFailed'), 'error');
            return;
        }
        maxFileSizeBytes = Math.round(maxFileSizeMb * 1024 * 1024);
    }

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/file-upload', {
            method: 'PUT',
            body: JSON.stringify({
                guestUploadEnabled,
                maxFileSizeBytes,
                allowedExtensions
            })
        });

        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function savePreviewPolicySettings(button) {
    const enabled = !!document.getElementById('previewEnabled')?.checked;
    const imageEnabled = !!document.getElementById('previewImageEnabled')?.checked;
    const videoEnabled = !!document.getElementById('previewVideoEnabled')?.checked;
    const audioEnabled = !!document.getElementById('previewAudioEnabled')?.checked;
    const pdfEnabled = !!document.getElementById('previewPdfEnabled')?.checked;
    const textEnabled = !!document.getElementById('previewTextEnabled')?.checked;
    const officeEnabled = !!document.getElementById('previewOfficeEnabled')?.checked;
    const allowedExtensions = parseMultiLineList(document.getElementById('previewAllowedExtensions')?.value)
        .map(item => item.startsWith('.') ? item.substring(1) : item)
        .map(item => item.toLowerCase());

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/file-preview', {
            method: 'PUT',
            body: JSON.stringify({
                enabled,
                imageEnabled,
                videoEnabled,
                audioEnabled,
                pdfEnabled,
                textEnabled,
                officeEnabled,
                allowedExtensions
            })
        });

        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function saveCorsPolicySettings(button) {
    const allowedOrigins = parseMultiLineList(document.getElementById('corsAllowedOrigins')?.value);
    const allowedMethods = parseMultiLineList(document.getElementById('corsAllowedMethods')?.value);
    const allowedHeaders = parseMultiLineList(document.getElementById('corsAllowedHeaders')?.value);
    const allowCredentials = !!document.getElementById('corsAllowCredentials')?.checked;
    const maxAgeSeconds = Number(document.getElementById('corsMaxAgeSeconds')?.value);

    if (allowedOrigins.length === 0 || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
        showToast(t('adminPolicySaveFailed'), 'error');
        return;
    }

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/cors', {
            method: 'PUT',
            body: JSON.stringify({
                allowedOrigins,
                allowedMethods,
                allowedHeaders,
                allowCredentials,
                maxAgeSeconds
            })
        });

        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

function toggleS3Fields() {
    const type = document.getElementById('storageType')?.value;
    const s3Fields = document.getElementById('s3Fields');
    if (s3Fields) s3Fields.style.display = type === 's3' ? '' : 'none';
}

function renderStorageRuntimeSummary() {
    const policy = adminState.storagePolicy;
    const container = document.getElementById('storageRuntimeSummary');
    const hintEl = document.getElementById('storageRuntimeHint');
    if (!policy || !container) return;

    const isS3 = policy.type === 's3';
    const cards = [
        {
            key: 'backend',
            label: t('adminStorageRuntimeBackend'),
            value: isS3 ? t('adminStorageBackendS3') : t('adminStorageBackendLocal')
        },
        {
            key: 'connection',
            label: t('adminStorageRuntimeConnection'),
            value: getStorageConnectionLabel(policy.connectionStatus)
        },
        {
            key: isS3 ? 's3-bucket' : 'local-upload-dir',
            label: isS3 ? t('adminStorageRuntimeBucket') : t('adminStorageRuntimeUploadDir'),
            value: isS3
                ? (policy.s3Bucket || '-')
                : (policy.localUploadDir || '-')
        },
        {
            key: isS3 ? 's3-endpoint' : 'local-usable',
            label: isS3 ? t('adminStorageRuntimeEndpoint') : t('adminStorageRuntimeUsable'),
            value: isS3
                ? (policy.s3Endpoint || '-')
                : (policy.localDiskUsableBytes != null ? formatBytes(policy.localDiskUsableBytes) : '-')
        }
    ];

    if (!isS3) {
        cards.push({
            key: 'local-total',
            label: t('adminStorageRuntimeTotal'),
            value: policy.localDiskTotalBytes != null ? formatBytes(policy.localDiskTotalBytes) : '-'
        });
        cards.push({
            key: 'local-risk',
            label: t('adminStorageRuntimeRisk'),
            value: `${getStorageRiskLabel(policy.localDiskRiskLevel)} · ${formatPercent(policy.localDiskUsablePercent)}`,
            valueClass: getStorageRiskValueClass(policy.localDiskRiskLevel),
            riskLevel: policy.localDiskRiskLevel || 'unknown'
        });
        cards.push({
            key: 'local-path-status',
            label: t('adminStorageRuntimePathStatus'),
            value: policy.localUploadDirExists
                ? t('adminStoragePathReady')
                : t('adminStoragePathMissing')
        });
    }

    container.innerHTML = cards.map(card => `
        <div class="rounded-[20px] border border-border bg-white/30 dark:bg-slate-950/30 p-4"
             data-runtime-card="${escapeHtml(card.key || '')}">
            <div class="text-xs uppercase tracking-[0.14em] text-text-sub font-semibold">${escapeHtml(card.label)}</div>
            <div class="mt-3 text-sm font-semibold break-all ${card.valueClass || ''}"
                 data-risk-level="${escapeHtml(card.riskLevel || '')}">${escapeHtml(card.value)}</div>
        </div>
    `).join('');

    if (hintEl) {
        hintEl.textContent = getStorageRuntimeHint(policy);
    }
}

function renderStoragePolicyForm() {
    const policy = adminState.storagePolicy;
    if (!policy) return;

    const typeEl = document.getElementById('storageType');
    if (typeEl) typeEl.value = policy.type || 'local';

    const endpointEl = document.getElementById('s3Endpoint');
    const bucketEl = document.getElementById('s3Bucket');
    const accessKeyEl = document.getElementById('s3AccessKey');
    const secretKeyEl = document.getElementById('s3SecretKey');
    const regionEl = document.getElementById('s3Region');
    const pathStyleEl = document.getElementById('s3PathStyleAccess');
    const hintEl = document.getElementById('s3SecretKeyHint');
    const statusEl = document.getElementById('storageConnectionStatus');

    if (endpointEl) endpointEl.value = policy.s3Endpoint || '';
    if (bucketEl) bucketEl.value = policy.s3Bucket || '';
    if (accessKeyEl) accessKeyEl.value = policy.s3AccessKey || '';
    if (secretKeyEl) secretKeyEl.value = '';
    if (regionEl) regionEl.value = policy.s3Region || 'auto';
    if (pathStyleEl) pathStyleEl.checked = policy.s3PathStyleAccess !== false;
    if (hintEl) hintEl.textContent = policy.s3HasSecretKey
        ? t('adminS3SecretKeySet')
        : t('adminS3SecretKeyNotSet');

    if (statusEl) {
        if (policy.connectionStatus === 'connected') {
            statusEl.textContent = t('adminStorageConnected');
            statusEl.className = 'text-sm text-green-600';
        } else if (policy.connectionStatus === 'local') {
            statusEl.textContent = '';
        } else if (policy.connectionStatus === 'not_configured') {
            statusEl.textContent = t('adminStorageNotConfigured');
            statusEl.className = 'text-sm text-yellow-600';
        } else {
            statusEl.textContent = policy.connectionStatus;
            statusEl.className = 'text-sm text-red-600';
        }
    }

    toggleS3Fields();
    renderStorageRuntimeSummary();
}

async function saveStoragePolicy(button) {
    const type = document.getElementById('storageType')?.value || 'local';
    const body = { type };

    if (type === 's3') {
        body.s3Endpoint = document.getElementById('s3Endpoint')?.value.trim() || '';
        body.s3Bucket = document.getElementById('s3Bucket')?.value.trim() || '';
        body.s3AccessKey = document.getElementById('s3AccessKey')?.value.trim() || '';
        body.s3Region = document.getElementById('s3Region')?.value.trim() || 'auto';
        body.s3PathStyleAccess = !!document.getElementById('s3PathStyleAccess')?.checked;
        const secretRaw = document.getElementById('s3SecretKey')?.value;
        if (secretRaw) body.s3SecretKey = secretRaw;
    }

    button.disabled = true;
    try {
        await adminRequest('/admin/settings/storage', {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function testStorageConnection(button) {
    button.disabled = true;
    try {
        const result = await adminRequest('/admin/settings/storage/test', { method: 'POST' });
        if (result === 'connected') {
            showToast(t('adminStorageTestSuccess'), 'success');
        } else if (result === 'local') {
            showToast(t('adminStorageTestLocal'), 'success');
        } else {
            showToast(result, 'error');
        }
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminStorageTestFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

function renderEmailTemplates() {
    const container = document.getElementById('emailTemplatesContainer');
    if (!container) return;

    const templates = adminState.emailTemplates || [];
    if (templates.length === 0) {
        container.innerHTML = '<p class="text-sm text-text-sub">' + t('adminEmailTemplatesNone') + '</p>';
        return;
    }

    container.innerHTML = templates.map(tpl => {
        const locales = tpl.locales || {};
        const localeKeys = Object.keys(locales).sort((a, b) => a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b));

        return `
        <div class="space-y-4 border border-border rounded-[18px] p-4">
            <div>
                <h3 class="font-medium text-text-main">${escapeHtml(tpl.description || tpl.templateType)}</h3>
                <p class="text-xs text-text-sub mt-1">${t('adminEmailTemplateVars')}: <code>${escapeHtml(tpl.availableVariables || '')}</code></p>
            </div>
            ${localeKeys.map(locale => {
                const lt = locales[locale];
                const prefix = 'emailTpl_' + tpl.templateType + '_' + locale;
                return `
                <div class="space-y-2">
                    <p class="text-sm font-medium text-text-sub">${locale.toUpperCase()}</p>
                    <div>
                        <label class="block text-xs text-text-sub mb-1" for="${prefix}_subject">${t('adminEmailTemplateSubject')}</label>
                        <input id="${prefix}_subject" type="text" class="settings-field" value="${escapeHtml(lt.subject || '')}">
                    </div>
                    <div>
                        <label class="block text-xs text-text-sub mb-1" for="${prefix}_body">${t('adminEmailTemplateBody')}</label>
                        <textarea id="${prefix}_body" rows="5" class="settings-field">${escapeHtml(lt.body || '')}</textarea>
                    </div>
                </div>`;
            }).join('')}
            <button type="button" class="action-btn" onclick="saveEmailTemplate('${escapeHtml(tpl.templateType)}', this)">
                <i class="fa-solid fa-floppy-disk"></i>
                <span data-i18n="adminSaveSettings">${t('adminSaveSettings')}</span>
            </button>
        </div>`;
    }).join('');
}

async function saveEmailTemplate(templateType, button) {
    const templates = adminState.emailTemplates || [];
    const tpl = templates.find(t => t.templateType === templateType);
    if (!tpl) return;

    const locales = {};
    for (const locale of Object.keys(tpl.locales || {})) {
        const prefix = 'emailTpl_' + templateType + '_' + locale;
        const subjectEl = document.getElementById(prefix + '_subject');
        const bodyEl = document.getElementById(prefix + '_body');
        if (!subjectEl || !bodyEl) continue;
        locales[locale] = {
            subject: subjectEl.value,
            body: bodyEl.value
        };
    }

    if (Object.keys(locales).length === 0) return;

    button.disabled = true;
    try {
        await adminRequest('/admin/settings/email-templates/' + encodeURIComponent(templateType), {
            method: 'PUT',
            body: JSON.stringify({ locales })
        });
        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function sendAnnouncement(button) {
    const subject = document.getElementById('announcementSubject')?.value.trim();
    const body = document.getElementById('announcementBody')?.value;
    const userIdsRaw = document.getElementById('announcementUserIds')?.value.trim();
    const resultEl = document.getElementById('announcementResult');

    if (!subject || !body) {
        showToast(t('adminAnnouncementEmpty'), 'error');
        return;
    }

    const payload = { subject, body };
    if (userIdsRaw) {
        payload.userIds = userIdsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    const recipientDesc = payload.userIds
        ? (getCurrentLanguage() === 'en'
            ? `${payload.userIds.length} selected user(s)`
            : `选中的 ${payload.userIds.length} 个用户`)
        : t('adminAnnouncementAllUsers');
    const confirmed = await confirmAdminAction(t('adminAnnouncementConfirm').replace('{target}', recipientDesc), {
        tone: 'default',
        icon: 'fa-bullhorn',
        confirmText: getCurrentLanguage() === 'en' ? 'Send' : '发送'
    });
    if (!confirmed) return;

    button.disabled = true;
    if (resultEl) resultEl.textContent = t('adminAnnouncementSending');

    try {
        const result = await adminRequest('/admin/announcement', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const msg = t('adminAnnouncementDone')
            .replace('{total}', result.totalRecipients)
            .replace('{deliverable}', result.deliverableCount)
            .replace('{success}', result.successCount)
            .replace('{fail}', result.failCount)
            .replace('{skipped}', result.skippedCount);
        if (resultEl) resultEl.textContent = msg;
        showToast(msg, result.failCount > 0 || result.skippedCount > 0 ? 'warning' : 'success');
    } catch (error) {
        if (resultEl) resultEl.textContent = error.message || t('adminAnnouncementFailed');
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminAnnouncementFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

function renderSmtpPolicyForm() {
    const policy = adminState.smtpPolicy;
    if (!policy) return;

    const hostEl = document.getElementById('smtpHost');
    const portEl = document.getElementById('smtpPort');
    const usernameEl = document.getElementById('smtpUsername');
    const passwordEl = document.getElementById('smtpPassword');
    const senderEl = document.getElementById('smtpSenderAddress');
    const starttlsEl = document.getElementById('smtpStarttlsEnabled');
    const hintEl = document.getElementById('smtpPasswordHint');

    if (hostEl) hostEl.value = policy.host || '';
    if (portEl) portEl.value = policy.port || 587;
    if (usernameEl) usernameEl.value = policy.username || '';
    if (passwordEl) passwordEl.value = '';
    if (senderEl) senderEl.value = policy.senderAddress || '';
    if (starttlsEl) starttlsEl.checked = policy.starttlsEnabled !== false;
    if (hintEl) hintEl.textContent = policy.hasPassword
        ? t('adminSmtpPasswordSet')
        : t('adminSmtpPasswordNotSet');
}

async function saveSmtpSettings(button) {
    const host = document.getElementById('smtpHost')?.value.trim();
    const port = Number(document.getElementById('smtpPort')?.value);
    const username = document.getElementById('smtpUsername')?.value.trim() || '';
    const passwordRaw = document.getElementById('smtpPassword')?.value;
    const senderAddress = document.getElementById('smtpSenderAddress')?.value.trim() || '';
    const starttlsEnabled = !!document.getElementById('smtpStarttlsEnabled')?.checked;

    if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
        showToast(t('adminSmtpInvalid'), 'error');
        return;
    }

    const body = { host, port, username, starttlsEnabled, senderAddress };
    if (passwordRaw) body.password = passwordRaw;

    button.disabled = true;
    try {
        await adminRequest('/admin/settings/smtp', {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        showToast(t('adminPolicySaved'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminPolicySaveFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function sendSmtpTestEmail(button) {
    const lang = getCurrentLanguage();
    const toEmail = await promptAdminInput(t('adminSmtpTestPrompt'), {
        title: lang === 'en' ? 'Send Test Email' : '发送测试邮件',
        label: lang === 'en' ? 'Recipient email' : '收件邮箱',
        placeholder: 'name@example.com',
        inputType: 'email',
        icon: 'fa-envelope',
        confirmText: lang === 'en' ? 'Send' : '发送',
        validate: (value) => {
            if (!value || !value.includes('@')) {
                return lang === 'en' ? 'Enter a valid email address.' : '请输入有效的邮箱地址。';
            }
            return '';
        }
    });
    if (!toEmail) return;

    button.disabled = true;
    try {
        await adminRequest('/admin/settings/smtp/test', {
            method: 'POST',
            body: JSON.stringify({ toEmail })
        });
        showToast(t('adminSmtpTestSuccess'), 'success');
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminSmtpTestFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function toggleUserRole(userId, targetRole, button) {
    const users = adminState.users || [];
    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) return;

    const userName = targetUser.nickname || targetUser.username || `#${userId}`;
    const roleText = getRoleLabel(targetRole);
    const confirmMessage = getCurrentLanguage() === 'en'
        ? `Change ${userName} to ${roleText}?`
        : `确定将 ${userName} 调整为 ${roleText} 吗？`;

    if (!await confirmAdminAction(confirmMessage, {
        tone: 'default',
        icon: 'fa-user-gear',
        confirmText: getCurrentLanguage() === 'en' ? 'Apply' : '确认调整'
    })) return;

    button.disabled = true;

    try {
        await adminRequest(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role: targetRole })
        });

        if (adminState.currentUser && adminState.currentUser.id === userId) {
            const updatedUser = {
                ...adminState.currentUser,
                role: targetRole
            };
            if (window.QuickShareSession && typeof window.QuickShareSession.setUser === 'function') {
                window.QuickShareSession.setUser(updatedUser);
            } else {
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
            adminState.currentUser = updatedUser;
            updateAdminProfile();

            if (targetRole === 'USER') {
                clearSession();
                redirectWithToast(t('adminSelfDemotedRelogin'), 'login.html');
                return;
            }
        }

        showToast(t('adminRoleUpdated'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminRoleUpdateFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function createAdminUser(button) {
    const username = document.getElementById('newUserUsername')?.value.trim() || '';
    const nickname = document.getElementById('newUserNickname')?.value.trim() || '';
    const email = document.getElementById('newUserEmail')?.value.trim() || '';
    const password = document.getElementById('newUserPassword')?.value || '';
    const role = document.getElementById('newUserRole')?.value || 'USER';

    if (!username || !password) {
        showToast(t('adminCreateUserFailed'), 'error');
        return;
    }

    button.disabled = true;

    try {
        await adminRequest('/admin/users', {
            method: 'POST',
            body: JSON.stringify({
                username,
                password,
                email: email || null,
                nickname: nickname || null,
                role
            })
        });

        ['newUserUsername', 'newUserNickname', 'newUserEmail', 'newUserPassword'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });

        const roleElement = document.getElementById('newUserRole');
        if (roleElement) {
            roleElement.value = 'USER';
        }

        showToast(t('adminCreateUserSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminCreateUserFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function deleteAdminUser(userId, button) {
    const targetUser = (adminState.users || []).find(user => user.id === userId);
    if (!targetUser) return;

    const userName = targetUser.nickname || targetUser.username || `#${userId}`;
    const confirmMessage = getCurrentLanguage() === 'en'
        ? `Delete user "${userName}" and all owned files?`
        : `确定删除用户「${userName}」以及该用户名下的全部文件吗？`;

    if (!await confirmAdminAction(confirmMessage)) return;

    button.disabled = true;

    try {
        await adminRequest(`/admin/users/${userId}`, { method: 'DELETE' });
        showToast(t('adminDeleteUserSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminDeleteUserFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function deleteAdminFile(fileId, button) {
    const targetFile = (adminState.files || []).find(file => file.id === fileId);
    const fileName = targetFile?.originalName || `${t('folder')} #${fileId}`;
    const confirmMessage = getCurrentLanguage() === 'en'
        ? `Force delete "${fileName}"?`
        : `确定强制删除「${fileName}」吗？`;

    if (!await confirmAdminAction(confirmMessage)) return;

    button.disabled = true;

    try {
        await adminRequest(`/admin/files/${fileId}`, { method: 'DELETE' });
        showToast(t('adminDeleteSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminDeleteFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

async function disableAdminShare(shareId, button) {
    const share = (adminState.shares || []).find(item => item.id === shareId);
    const shareCode = share?.shareCode || `#${shareId}`;
    const confirmMessage = getCurrentLanguage() === 'en'
        ? `Disable share ${shareCode}?`
        : `确定失效分享 ${shareCode} 吗？`;

    if (!await confirmAdminAction(confirmMessage)) return;

    button.disabled = true;

    try {
        await adminRequest(`/admin/shares/${shareId}/disable`, { method: 'PUT' });
        showToast(t('adminDisableSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        if (!adminState.isRedirecting) {
            showToast(error.message || t('adminDisableFailed'), 'error');
        }
    } finally {
        button.disabled = false;
    }
}

// ========== Plan Management ==========

function formatPlanValue(type, value) {
    if (!value) return '-';
    if (type === 'storage') return formatBytes(value);
    if (type === 'downloads') return value.toLocaleString();
    if (type === 'vip') return value + ' ' + t('pricingVipUnit');
    return String(value);
}

function getPlanTypeLabel(type) {
    if (type === 'storage') return t('adminPlanTypeStorage');
    if (type === 'downloads') return t('adminPlanTypeDownloads');
    if (type === 'vip') return t('adminPlanTypeVip');
    return type || '-';
}

function renderPlans() {
    const body = document.getElementById('plansTableBody');
    const badge = document.getElementById('plansCountBadge');
    if (!body) return;

    const plans = (adminState.plans || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (badge) badge.textContent = plans.length;

    if (plans.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="empty-row">${escapeHtml(t('adminNoData') || '暂无数据')}</td></tr>`;
        return;
    }

    body.innerHTML = plans.map(p => `<tr>
        <td class="mono">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(getPlanTypeLabel(p.type))}</td>
        <td>${escapeHtml(formatPlanValue(p.type, p.value))}</td>
        <td class="mono">${escapeHtml(p.price)}</td>
        <td>${p.sortOrder || 0}</td>
        <td><span class="status-chip ${p.status === 1 ? 'status-active' : 'status-disabled'}">${p.status === 1 ? t('adminEnabled') : t('adminDisabled') || '禁用'}</span></td>
        <td class="flex gap-2">
            <button class="action-btn" onclick="editPlan(${p.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="action-btn danger" onclick="deletePlan(${p.id}, this)"><i class="fa-solid fa-trash"></i></button>
        </td>
    </tr>`).join('');
}

function editPlan(planId) {
    const plan = adminState.plans.find(p => p.id === planId);
    if (!plan) return;
    adminState.editingPlanId = planId;
    const el = id => document.getElementById(id);
    if (el('planName')) el('planName').value = plan.name || '';
    if (el('planDescription')) el('planDescription').value = plan.description || '';
    if (el('planType')) el('planType').value = plan.type || 'storage';
    if (el('planValue')) el('planValue').value = plan.value || '';
    if (el('planPrice')) el('planPrice').value = plan.price || '';
    if (el('planSortOrder')) el('planSortOrder').value = plan.sortOrder || 0;
    if (el('planStatus')) el('planStatus').checked = plan.status === 1;
    const saveBtn = el('planSaveBtn');
    if (saveBtn) saveBtn.querySelector('span').textContent = t('adminPlanSaveBtn');
    const cancelBtn = el('planCancelBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
}

function cancelEditPlan() {
    adminState.editingPlanId = null;
    const el = id => document.getElementById(id);
    ['planName', 'planDescription', 'planValue', 'planPrice'].forEach(id => { if (el(id)) el(id).value = ''; });
    if (el('planType')) el('planType').value = 'storage';
    if (el('planSortOrder')) el('planSortOrder').value = '0';
    if (el('planStatus')) el('planStatus').checked = true;
    const saveBtn = el('planSaveBtn');
    if (saveBtn) saveBtn.querySelector('span').textContent = t('adminPlanCreateBtn');
    const cancelBtn = el('planCancelBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function savePlan(button) {
    const el = id => document.getElementById(id);
    const name = el('planName')?.value.trim();
    const description = el('planDescription')?.value.trim();
    const type = el('planType')?.value;
    const value = el('planValue')?.value.trim();
    const price = el('planPrice')?.value.trim();
    const sortOrder = parseInt(el('planSortOrder')?.value) || 0;
    const status = el('planStatus')?.checked ? 1 : 0;

    if (!name || !type || !value || !price) {
        showToast(t('adminPlanSaveFailed'), 'error');
        return;
    }

    button.disabled = true;
    try {
        const body = { name, description, type, value: parseInt(value), price: parseFloat(price), sortOrder, status };
        if (adminState.editingPlanId) {
            await adminRequest(`/admin/plans/${adminState.editingPlanId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            await adminRequest('/admin/plans', { method: 'POST', body: JSON.stringify(body) });
        }
        showToast(t('adminPlanSaved'), 'success');
        cancelEditPlan();
        await refreshPolicySettings(false, false);
    } catch (error) {
        showToast(error.message || t('adminPlanSaveFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function deletePlan(planId, button) {
    const plan = adminState.plans.find(p => p.id === planId);
    const msg = t('adminPlanDeleteConfirm').replace('{name}', plan?.name || planId);
    if (!await confirmAdminAction(msg)) return;
    button.disabled = true;
    try {
        await adminRequest(`/admin/plans/${planId}`, { method: 'DELETE' });
        showToast(t('adminPlanDeleted'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        showToast(error.message || t('adminPlanDeleteFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

// ========== Payment Provider Management ==========

function renderPaymentProviders() {
    const body = document.getElementById('providersTableBody');
    const badge = document.getElementById('providersCountBadge');
    if (!body) return;

    const providers = (adminState.paymentProviders || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (badge) badge.textContent = providers.length;

    if (providers.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="empty-row">${escapeHtml(t('adminNoData') || '暂无数据')}</td></tr>`;
        return;
    }

    body.innerHTML = providers.map(p => `<tr>
        <td class="mono">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td class="mono text-xs">${escapeHtml(p.apiUrl)}</td>
        <td class="mono">${escapeHtml(p.pid)}</td>
        <td>${escapeHtml(p.payTypes)}</td>
        <td><span class="status-chip ${p.enabled === 1 ? 'status-active' : 'status-disabled'}">${p.enabled === 1 ? t('adminEnabled') : t('adminDisabled') || '禁用'}</span></td>
        <td>${p.sortOrder || 0}</td>
        <td class="flex gap-2">
            <button class="action-btn" onclick="editPaymentProvider(${p.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="action-btn danger" onclick="deletePaymentProvider(${p.id}, this)"><i class="fa-solid fa-trash"></i></button>
        </td>
    </tr>`).join('');
}

function editPaymentProvider(providerId) {
    const provider = adminState.paymentProviders.find(p => p.id === providerId);
    if (!provider) return;
    adminState.editingProviderId = providerId;
    const el = id => document.getElementById(id);
    if (el('providerName')) el('providerName').value = provider.name || '';
    if (el('providerApiUrl')) el('providerApiUrl').value = provider.apiUrl || '';
    if (el('providerPid')) el('providerPid').value = provider.pid || '';
    if (el('providerKey')) el('providerKey').value = '';
    if (el('providerPayTypes')) el('providerPayTypes').value = provider.payTypes || '';
    if (el('providerEnabled')) el('providerEnabled').checked = provider.enabled === 1;
    if (el('providerSortOrder')) el('providerSortOrder').value = provider.sortOrder || 0;
    const hint = el('providerKeyHint');
    if (hint) hint.textContent = provider.hasKey ? t('adminProviderKeySet') : t('adminProviderKeyNotSet');
    const saveBtn = el('providerSaveBtn');
    if (saveBtn) saveBtn.querySelector('span').textContent = t('adminProviderSaveBtn');
    const cancelBtn = el('providerCancelBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
}

function cancelEditProvider() {
    adminState.editingProviderId = null;
    const el = id => document.getElementById(id);
    ['providerName', 'providerApiUrl', 'providerPid', 'providerKey', 'providerPayTypes'].forEach(id => { if (el(id)) el(id).value = ''; });
    if (el('providerEnabled')) el('providerEnabled').checked = true;
    if (el('providerSortOrder')) el('providerSortOrder').value = '0';
    const hint = el('providerKeyHint');
    if (hint) hint.textContent = '';
    const saveBtn = el('providerSaveBtn');
    if (saveBtn) saveBtn.querySelector('span').textContent = t('adminProviderCreateBtn');
    const cancelBtn = el('providerCancelBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function savePaymentProvider(button) {
    const el = id => document.getElementById(id);
    const name = el('providerName')?.value.trim();
    const apiUrl = el('providerApiUrl')?.value.trim();
    const pid = el('providerPid')?.value.trim();
    const merchantKey = el('providerKey')?.value.trim() || null;
    const payTypes = el('providerPayTypes')?.value.trim();
    const enabled = el('providerEnabled')?.checked ? 1 : 0;
    const sortOrder = parseInt(el('providerSortOrder')?.value) || 0;

    if (!name || !apiUrl || !pid) {
        showToast(t('adminProviderSaveFailed'), 'error');
        return;
    }

    button.disabled = true;
    try {
        const body = { name, apiUrl, pid, merchantKey, payTypes, enabled, sortOrder };
        if (adminState.editingProviderId) {
            await adminRequest(`/admin/payment-providers/${adminState.editingProviderId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            await adminRequest('/admin/payment-providers', { method: 'POST', body: JSON.stringify(body) });
        }
        showToast(t('adminProviderSaved'), 'success');
        cancelEditProvider();
        await refreshPolicySettings(false, false);
    } catch (error) {
        showToast(error.message || t('adminProviderSaveFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function deletePaymentProvider(providerId, button) {
    const provider = adminState.paymentProviders.find(p => p.id === providerId);
    const msg = t('adminProviderDeleteConfirm').replace('{name}', provider?.name || providerId);
    if (!await confirmAdminAction(msg)) return;
    button.disabled = true;
    try {
        await adminRequest(`/admin/payment-providers/${providerId}`, { method: 'DELETE' });
        showToast(t('adminProviderDeleted'), 'success');
        await refreshPolicySettings(false, false);
    } catch (error) {
        showToast(error.message || t('adminProviderDeleteFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

// ========== Order Management ==========

function getOrderStatusChip(status) {
    const map = {
        pending: { cls: 'status-expired', label: t('adminOrderStatusPending') },
        paid: { cls: 'status-active', label: t('adminOrderStatusPaid') },
        expired: { cls: 'status-disabled', label: t('adminOrderStatusExpired') },
        refunded: { cls: 'status-disabled', label: t('adminOrderStatusRefunded') }
    };
    const info = map[status] || { cls: '', label: status };
    return `<span class="status-chip ${info.cls}">${escapeHtml(info.label)}</span>`;
}

function renderOrders() {
    const body = document.getElementById('ordersTableBody');
    const badge = document.getElementById('ordersCountBadge');
    if (!body) return;

    const orders = adminState.orders || [];
    if (badge) badge.textContent = orders.length;

    if (orders.length === 0) {
        body.innerHTML = `<tr><td colspan="10" class="empty-row">${escapeHtml(t('adminNoData') || '暂无数据')}</td></tr>`;
        return;
    }

    body.innerHTML = orders.map(o => `<tr>
        <td class="mono text-xs">${escapeHtml(o.orderNo)}</td>
        <td>${escapeHtml(o.username || o.userId)}</td>
        <td>${escapeHtml(o.planName || '-')}</td>
        <td class="mono">${escapeHtml(o.amount)}</td>
        <td>${getOrderStatusChip(o.status)}</td>
        <td>${escapeHtml(o.payType || '-')}</td>
        <td>${escapeHtml(o.providerName || '-')}</td>
        <td class="mono text-xs">${escapeHtml(o.tradeNo || '-')}</td>
        <td>${formatDateTime(o.createTime)}</td>
        <td class="flex gap-2">${o.status === 'pending' ? `<button class="action-btn" onclick="markOrderPaid(${o.id}, this)"><i class="fa-solid fa-check"></i> <span>${t('adminOrderMarkPaid')}</span></button>` : ''}${o.status === 'paid' ? `<button class="action-btn danger" onclick="markOrderRefunded(${o.id}, this)"><i class="fa-solid fa-rotate-left"></i> <span>${t('adminOrderMarkRefunded')}</span></button>` : ''}${o.status !== 'paid' ? `<button class="action-btn danger" onclick="deleteOrder(${o.id}, this)"><i class="fa-solid fa-trash"></i> <span>${t('adminOrderDelete')}</span></button>` : ''}</td>
    </tr>`).join('');
}

async function markOrderPaid(orderId, button) {
    const order = adminState.orders.find(o => o.id === orderId);
    const msg = t('adminOrderMarkPaidConfirm').replace('{orderNo}', order?.orderNo || orderId);
    if (!await confirmAdminAction(msg, {
        tone: 'default',
        icon: 'fa-badge-check',
        confirmText: getCurrentLanguage() === 'en' ? 'Mark Paid' : '确认已支付'
    })) return;
    button.disabled = true;
    try {
        await adminRequest(`/admin/orders/${orderId}/mark-paid`, { method: 'PUT' });
        showToast(t('adminOrderMarkPaidSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        showToast(error.message || t('adminOrderMarkFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function markOrderRefunded(orderId, button) {
    const order = adminState.orders.find(o => o.id === orderId);
    const msg = t('adminOrderMarkRefundedConfirm').replace('{orderNo}', order?.orderNo || orderId);
    if (!await confirmAdminAction(msg, {
        tone: 'default',
        icon: 'fa-rotate-left',
        confirmText: getCurrentLanguage() === 'en' ? 'Confirm Refund' : '确认退款'
    })) return;
    button.disabled = true;
    try {
        await adminRequest(`/admin/orders/${orderId}/mark-refunded`, { method: 'PUT' });
        showToast(t('adminOrderMarkRefundedSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        showToast(error.message || t('adminOrderMarkFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function deleteOrder(orderId, button) {
    const order = adminState.orders.find(o => o.id === orderId);
    const msg = t('adminOrderDeleteConfirm').replace('{orderNo}', order?.orderNo || orderId);
    if (!await confirmAdminAction(msg, {
        tone: 'danger',
        icon: 'fa-trash',
        confirmText: getCurrentLanguage() === 'en' ? 'Delete' : '删除'
    })) return;
    button.disabled = true;
    try {
        await adminRequest(`/admin/orders/${orderId}`, { method: 'DELETE' });
        showToast(t('adminOrderDeleteSuccess'), 'success');
        await refreshAdminData(false);
    } catch (error) {
        showToast(error.message || t('adminOrderDeleteFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

// ========== Page Navigation ==========

function showAdminPage(pageName, navEl) {
    const activePage = setActiveAdminPage(pageName);

    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    const target = document.querySelector(`.admin-page[data-page="${activePage}"]`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.admin-sidebar-nav a').forEach(a => a.classList.remove('active'));
    if (navEl && navEl.dataset.nav === activePage) {
        navEl.classList.add('active');
    } else {
        const link = document.querySelector(`.admin-sidebar-nav a[data-nav="${activePage}"]`);
        if (link) link.classList.add('active');
    }

    closeAdminSidebar();
}

function toggleAdminSidebar(forceOpen) {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : !sidebar.classList.contains('mobile-open');

    if (shouldOpen) {
        openAdminSidebar();
    } else {
        closeAdminSidebar();
    }
}

function closeAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('adminSidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('visible');
    document.body.classList.remove('admin-sidebar-open');
}

function openAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('adminSidebarBackdrop');
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('visible');
    document.body.classList.add('admin-sidebar-open');
}

function getInitialAdminPage() {
    const fromHash = window.location.hash.replace(/^#/, '').trim();
    if (ADMIN_PAGE_NAMES.has(fromHash)) {
        return fromHash;
    }

    const fromStorage = localStorage.getItem(ADMIN_PAGE_STORAGE_KEY);
    if (ADMIN_PAGE_NAMES.has(fromStorage)) {
        return fromStorage;
    }

    return 'overview';
}

function updateAdminPageHash(pageName) {
    const nextHash = `#${pageName}`;
    if (window.location.hash !== nextHash) {
        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        history.replaceState(null, '', nextUrl);
    }
}

function setActiveAdminPage(pageName) {
    if (!ADMIN_PAGE_NAMES.has(pageName)) {
        return 'overview';
    }

    localStorage.setItem(ADMIN_PAGE_STORAGE_KEY, pageName);
    updateAdminPageHash(pageName);
    return pageName;
}

function bindAdminLayoutEvents() {
    window.addEventListener('resize', () => {
        if (window.innerWidth > 960) {
            closeAdminSidebar();
        }
    });
}

function goToNetdisk() {
    window.location.href = 'netdisk.html';
}

async function handleAdminLogout() {
    const confirmed = await confirmAdminAction(t('logoutConfirm'), {
        title: getCurrentLanguage() === 'en' ? 'Log Out' : '退出登录',
        icon: 'fa-right-from-bracket',
        confirmText: getCurrentLanguage() === 'en' ? 'Log out' : '退出',
        tone: 'danger'
    });
    if (!confirmed) return;
    clearSession();
    window.location.href = 'index.html';
}

function rerenderForLanguageChange() {
    updateAdminProfile();
    renderOverview();
    renderUsers();
    renderFiles();
    renderShares();
    renderOrders();
    renderRateLimitPolicies();
    renderAdminConsoleAccessForm();
    renderRegistrationSettingsForm();
    renderUploadPolicyForm();
    renderPreviewPolicyForm();
    renderCorsPolicyForm();
    renderPlans();
    renderPaymentProviders();
}

async function initAdminPage() {
    if (!await ensureAdminAccess()) return;

    bindAdminLayoutEvents();
    bindRegistrationSettingsEvents();

    renderOverview();
    renderUsers();
    renderFiles();
    renderShares();
    renderRateLimitPolicies();
    renderAdminConsoleAccessForm();
    renderRegistrationSettingsForm();
    renderUploadPolicyForm();
    showAdminPage(getInitialAdminPage());
    refreshAdminData(false, true);
}

document.addEventListener('DOMContentLoaded', initAdminPage);
document.addEventListener('quickshare:languagechange', rerenderForLanguageChange);

window.refreshAdminData = refreshAdminData;
window.createAdminUser = createAdminUser;
window.toggleUserRole = toggleUserRole;
window.deleteAdminUser = deleteAdminUser;
window.deleteAdminFile = deleteAdminFile;
window.disableAdminShare = disableAdminShare;
window.goToNetdisk = goToNetdisk;
window.handleAdminLogout = handleAdminLogout;
window.saveRateLimitPolicy = saveRateLimitPolicy;
window.saveAdminConsoleAccess = saveAdminConsoleAccess;
window.saveRegistrationSettings = saveRegistrationSettings;
window.saveUploadPolicySettings = saveUploadPolicySettings;
window.savePreviewPolicySettings = savePreviewPolicySettings;
window.saveCorsPolicySettings = saveCorsPolicySettings;
window.toggleUploadSizeLimit = toggleUploadSizeLimit;
window.updateAdminConsolePathPreview = updateAdminConsolePathPreview;
window.savePlan = savePlan;
window.editPlan = editPlan;
window.cancelEditPlan = cancelEditPlan;
window.deletePlan = deletePlan;
window.savePaymentProvider = savePaymentProvider;
window.editPaymentProvider = editPaymentProvider;
window.cancelEditProvider = cancelEditProvider;
window.deletePaymentProvider = deletePaymentProvider;
window.markOrderPaid = markOrderPaid;
window.markOrderRefunded = markOrderRefunded;
window.deleteOrder = deleteOrder;
window.showAdminPage = showAdminPage;
window.toggleAdminSidebar = toggleAdminSidebar;
window.closeAdminSidebar = closeAdminSidebar;
