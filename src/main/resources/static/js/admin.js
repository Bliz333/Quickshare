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
    isRedirecting: false
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
        { icon: 'fa-users', label: t('adminStatUsers'), value: overview.userCount || 0 },
        { icon: 'fa-file-lines', label: t('adminStatFiles'), value: overview.fileCount || 0 },
        { icon: 'fa-folder-tree', label: t('adminStatFolders'), value: overview.folderCount || 0 },
        { icon: 'fa-share-nodes', label: t('adminStatShares'), value: overview.shareCount || 0 },
        { icon: 'fa-signal', label: t('adminStatActiveShares'), value: overview.activeShareCount || 0 },
        { icon: 'fa-hard-drive', label: t('adminStatStorage'), value: formatBytes(overview.totalStorageBytes || 0) }
    ];

    container.innerHTML = cards.map(card => `
        <article class="stat-card glass-card">
            <div class="flex items-start justify-between gap-4 relative z-10">
                <div class="space-y-4">
                    <div class="stat-icon">
                        <i class="fa-solid ${card.icon}"></i>
                    </div>
                    <div>
                        <p class="text-sm text-text-sub">${escapeHtml(card.label)}</p>
                        <h3 class="text-2xl md:text-3xl font-semibold mt-2">${escapeHtml(card.value)}</h3>
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
    const siteKeyEl = document.getElementById('registrationRecaptchaSiteKey');
    const secretKeyEl = document.getElementById('registrationRecaptchaSecretKey');
    const verifyUrlEl = document.getElementById('registrationRecaptchaVerifyUrl');

    if (emailVerificationEl) emailVerificationEl.checked = !!settings.emailVerificationEnabled;
    if (recaptchaEnabledEl) recaptchaEnabledEl.checked = !!settings.recaptchaEnabled;
    if (siteKeyEl) siteKeyEl.value = settings.recaptchaSiteKey || '';
    if (secretKeyEl) secretKeyEl.value = settings.recaptchaSecretKey || '';
    if (verifyUrlEl) verifyUrlEl.value = settings.recaptchaVerifyUrl || 'https://www.google.com/recaptcha/api/siteverify';
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
        const [rateLimits, adminConsoleAccess, registrationSettings, fileUploadPolicy, filePreviewPolicy, corsPolicy] = await Promise.all([
            adminRequest('/admin/settings/rate-limits'),
            adminRequest('/admin/settings/admin-console'),
            adminRequest('/admin/settings/registration'),
            adminRequest('/admin/settings/file-upload'),
            adminRequest('/admin/settings/file-preview'),
            adminRequest('/admin/settings/cors')
        ]);

        adminState.rateLimits = rateLimits || [];
        adminState.adminConsoleAccess = adminConsoleAccess || null;
        adminState.registrationSettings = registrationSettings || null;
        adminState.fileUploadPolicy = fileUploadPolicy || null;
        adminState.filePreviewPolicy = filePreviewPolicy || null;
        adminState.corsPolicy = corsPolicy || null;
        renderRateLimitPolicies();
        renderAdminConsoleAccessForm();
        renderRegistrationSettingsForm();
        renderUploadPolicyForm();
        renderPreviewPolicyForm();
        renderCorsPolicyForm();

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
        const [overview, users, files, shares] = await Promise.all([
            adminRequest('/admin/overview'),
            adminRequest('/admin/users'),
            adminRequest('/admin/files'),
            adminRequest('/admin/shares')
        ]);

        adminState.overview = overview || {};
        adminState.users = users || [];
        adminState.files = files || [];
        adminState.shares = shares || [];

        renderOverview();
        renderUsers();
        renderFiles();
        renderShares();
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
    const recaptchaSiteKey = document.getElementById('registrationRecaptchaSiteKey')?.value.trim() || '';
    const recaptchaSecretKey = document.getElementById('registrationRecaptchaSecretKey')?.value.trim() || '';
    const recaptchaVerifyUrl = document.getElementById('registrationRecaptchaVerifyUrl')?.value.trim()
        || 'https://www.google.com/recaptcha/api/siteverify';

    button.disabled = true;

    try {
        await adminRequest('/admin/settings/registration', {
            method: 'PUT',
            body: JSON.stringify({
                emailVerificationEnabled,
                recaptchaEnabled,
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

async function toggleUserRole(userId, targetRole, button) {
    const users = adminState.users || [];
    const targetUser = users.find(user => user.id === userId);
    if (!targetUser) return;

    const userName = targetUser.nickname || targetUser.username || `#${userId}`;
    const roleText = getRoleLabel(targetRole);
    const confirmMessage = getCurrentLanguage() === 'en'
        ? `Change ${userName} to ${roleText}?`
        : `确定将 ${userName} 调整为 ${roleText} 吗？`;

    if (!confirm(confirmMessage)) return;

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

    if (!confirm(confirmMessage)) return;

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

    if (!confirm(confirmMessage)) return;

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

    if (!confirm(confirmMessage)) return;

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

function goToNetdisk() {
    window.location.href = 'netdisk.html';
}

function handleAdminLogout() {
    if (confirm(t('logoutConfirm'))) {
        clearSession();
        window.location.href = 'index.html';
    }
}

function rerenderForLanguageChange() {
    updateAdminProfile();
    renderOverview();
    renderUsers();
    renderFiles();
    renderShares();
    renderRateLimitPolicies();
    renderAdminConsoleAccessForm();
    renderRegistrationSettingsForm();
    renderUploadPolicyForm();
    renderPreviewPolicyForm();
    renderCorsPolicyForm();
}

async function initAdminPage() {
    if (!await ensureAdminAccess()) return;
    renderOverview();
    renderUsers();
    renderFiles();
    renderShares();
    renderRateLimitPolicies();
    renderAdminConsoleAccessForm();
    renderRegistrationSettingsForm();
    renderUploadPolicyForm();
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
