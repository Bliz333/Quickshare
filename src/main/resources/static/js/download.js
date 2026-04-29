/**
 * download.js - 下载与预览逻辑
 */

let _shareFileType = null;
let _pickupShareToken = null;
let _pickupE2ee = null;

function localizeDownloadErrorMessage(message) {
    const normalized = (message || '').trim();
    const directMap = {
        '缺少取件参数': 'pickupTokenMissing',
        '获取取件信息失败': 'pickupInfoFailed',
        '保存失败': 'saveFailed',
        '获取失败': 'shareInfoFailed',
        '提取码错误': 'extractCodeError',
        '提取码错误或必填': 'extractCodeError',
        '分享链接已过期': 'shareExpired',
        '下载次数已达上限': 'downloadLimitReached',
        '文件不存在': 'fileNotFound',
        '文件不存在或已删除': 'fileGone',
        '无权限执行该操作': 'noPermissionAction'
    };

    if (directMap[normalized]) {
        return t(directMap[normalized]);
    }

    if (normalized.includes('提取码错误')) {
        return t('extractCodeError');
    }
    if (normalized.includes('分享链接已过期')) {
        return t('shareExpired');
    }
    if (normalized.includes('下载次数已达上限')) {
        return t('downloadLimitReached');
    }
    if (normalized.includes('文件不存在或已删除')) {
        return t('fileGone');
    }
    if (normalized.includes('文件不存在')) {
        return t('fileNotFound');
    }

    return normalized;
}

function initGuestMode(shareCode, extractCode) {
    console.log('进入访客模式:', shareCode, extractCode);
    _pickupShareToken = null;
    toggleDownloadMode(false);

    switchTab('download');

    if (shareCode) {
        const shareCodeInput = document.getElementById('downloadShareCode');
        if (shareCodeInput) {
            shareCodeInput.value = shareCode;
        }
    }

    if (extractCode) {
        const extractCodeInput = document.getElementById('downloadExtractCode');
        if (extractCodeInput) {
            extractCodeInput.value = extractCode;
        }
    }

    if (shareCode && extractCode) {
        const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
        showToast(lang === 'zh' ? '正在获取文件信息...' : 'Fetching file info...', 'success');
        setTimeout(() => {
            getShareInfo();
        }, 500);
    }
}

function parseShareParams() {
    let shareCode = null;
    let extractCode = null;
    let pickupToken = null;
    _pickupE2ee = window.QuickShareE2EE?.parseFragment?.() || null;

    if (window.location.hash.includes('pickup=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        pickupToken = params.get('pickup');
    } else if (window.location.search.includes('pickup=')) {
        const params = new URLSearchParams(window.location.search);
        pickupToken = params.get('pickup');
    } else if (window.location.hash.includes('share=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        shareCode = params.get('share');
        extractCode = params.get('code');
    } else if (window.location.search.includes('share=')) {
        const params = new URLSearchParams(window.location.search);
        shareCode = params.get('share');
        extractCode = params.get('code');
    }

    return { shareCode, extractCode, pickupToken };
}

function toggleDownloadMode(isPickupMode) {
    const shareField = document.getElementById('downloadShareCodeField');
    const extractField = document.getElementById('downloadExtractCodeField');
    const lookupBtn = document.getElementById('downloadLookupBtn');
    const shareInfo = document.getElementById('downloadInfo');
    const pickupInfo = document.getElementById('pickupInfo');

    if (shareField) shareField.style.display = isPickupMode ? 'none' : '';
    if (extractField) extractField.style.display = isPickupMode ? 'none' : '';
    if (lookupBtn) lookupBtn.style.display = isPickupMode ? 'none' : '';
    if (shareInfo && isPickupMode) shareInfo.style.display = 'none';
    if (pickupInfo && !isPickupMode) pickupInfo.style.display = 'none';
}

function formatPickupTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const locale = typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'en' ? 'en-US' : 'zh-CN';
    return date.toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function getPickupInfo() {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    if (!_pickupShareToken) {
        showToast(t('pickupTokenMissing'), 'error');
        return;
    }

    try {
        const headers = getAuthToken() ? getAuthHeaders() : {};
        const res = await fetch(`${API_BASE}/public/transfer/shares/${encodeURIComponent(_pickupShareToken)}`, { headers });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok || !data || data.code !== 200) {
            throw new Error(data?.message || (lang === 'zh' ? '获取取件信息失败' : 'Failed to fetch pickup info'));
        }

        const info = data.data || {};
        toggleDownloadMode(true);

        const fileNameEl = document.getElementById('pickupFileName');
        const senderEl = document.getElementById('pickupSender');
        const sizeEl = document.getElementById('pickupFileSize');
        const updatedEl = document.getElementById('pickupUpdatedAt');
        const pickupInfo = document.getElementById('pickupInfo');
        const pickupDownloadBtn = document.getElementById('pickupDownloadBtn');
        const pickupSaveBtn = document.getElementById('pickupSaveBtn');

        if (fileNameEl) fileNameEl.textContent = info.fileName || '-';
        if (senderEl) senderEl.textContent = info.senderLabel || '-';
        if (sizeEl) sizeEl.textContent = formatFileSize(info.fileSize || 0);
        if (updatedEl) updatedEl.textContent = formatPickupTime(info.updateTime);
        if (pickupDownloadBtn) pickupDownloadBtn.disabled = !info.ready;
        if (pickupSaveBtn) {
            pickupSaveBtn.style.display = isLoggedIn() && !_pickupE2ee?.encrypted ? '' : 'none';
            pickupSaveBtn.disabled = !info.ready || !isLoggedIn() || Boolean(_pickupE2ee?.encrypted);
        }
        if (pickupInfo) {
            pickupInfo.style.display = 'block';
            pickupInfo.style.animation = 'slideUp 0.5s ease-out';
        }
    } catch (err) {
        showToast(localizeDownloadErrorMessage(err.message), 'error');
        const pickupInfo = document.getElementById('pickupInfo');
        if (pickupInfo) pickupInfo.style.display = 'none';
    }
}

function downloadPickupFile() {
    if (!_pickupShareToken) return;
    const url = `${API_BASE}/public/transfer/shares/${encodeURIComponent(_pickupShareToken)}/download`;
    if (_pickupE2ee?.encrypted && window.QuickShareE2EE) {
        window.QuickShareE2EE.downloadDecrypted(url, _pickupE2ee, _pickupE2ee.fileName || 'download')
            .catch(error => showToast(error.message || 'Decrypt failed', 'error'));
        return;
    }
    window.open(url, '_blank');
}

async function savePickupToNetdisk() {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    if (!_pickupShareToken) return;
    if (_pickupE2ee?.encrypted) {
        showToast(lang === 'zh' ? '端到端加密文件暂不支持直接保存到网盘，请先下载解密文件' : 'End-to-end encrypted files cannot be saved to netdisk yet. Download and decrypt first.', 'warning');
        return;
    }
    if (!isLoggedIn()) {
        showToast(lang === 'zh' ? '请先登录' : 'Please log in first', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/transfer/public-shares/${encodeURIComponent(_pickupShareToken)}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ folderId: 0 })
        });
        const text = await response.text();
        const result = text ? JSON.parse(text) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || (lang === 'zh' ? '保存失败' : 'Save failed'));
        }
        showToast(t('savedToNetdisk'), 'success');
    } catch (err) {
        showToast(localizeDownloadErrorMessage(err.message), 'error');
    }
}

function isPreviewableFileName(fileName, fileType) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    const previewableExts = [
        'pdf',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp',
        'mp4', 'webm', 'ogg',
        'mp3', 'wav', 'flac', 'aac',
        'txt', 'md', 'json', 'xml', 'csv', 'log', 'yml', 'yaml', 'ini', 'conf',
        'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'sh', 'bash', 'css', 'html'
    ];
    return previewableExts.includes(ext);
}

function isPdfOrOffice(fileName) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext);
}

function isImageFile(fileName) {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

async function getShareInfo() {
    toggleDownloadMode(false);
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';

    if (!sCode) {
        showToast(t('shareCodeRequired'), 'error');
        return;
    }

    try {
        const url = `${API_BASE}/share/${sCode}?extractCode=${encodeURIComponent(eCode)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code !== 200) {
            throw new Error(data.message || (lang === 'zh' ? '获取失败' : 'Failed to get info'));
        }

        const info = data.data;
        _shareFileType = info.fileType;

        const fileNameEl = document.getElementById('downloadFileName');
        if (fileNameEl) fileNameEl.textContent = info.fileName;

        let expireText = lang === 'zh' ? '永久有效' : 'Never expires';
        if (info.expireTime) {
            expireText = new Date(info.expireTime).toLocaleString();
        }
        const expireTimeEl = document.getElementById('downloadExpireTime');
        if (expireTimeEl) expireTimeEl.textContent = expireText;

        const remainingEl = document.getElementById('downloadRemaining');
        if (remainingEl) {
            const unlimitedText = lang === 'zh' ? '无限制' : 'Unlimited';
            remainingEl.textContent = (info.maxDownload === -1 || info.maxDownload === null)
                ? unlimitedText
                : info.maxDownload;
        }

        // Show/hide preview button
        const previewBtn = document.getElementById('previewShareBtn');
        if (previewBtn) {
            previewBtn.style.display = isPreviewableFileName(info.fileName, info.fileType) ? '' : 'none';
        }

        // Hide preview container when info refreshes
        const previewContainer = document.getElementById('sharePreviewContainer');
        if (previewContainer) previewContainer.style.display = 'none';

        const infoBox = document.getElementById('downloadInfo');
        if (infoBox) {
            infoBox.style.display = 'block';
            infoBox.style.animation = 'slideUp 0.5s ease-out';
        }

    } catch (err) {
        showToast(localizeDownloadErrorMessage(err.message), 'error');
        const infoBox = document.getElementById('downloadInfo');
        if (infoBox) infoBox.style.display = 'none';
    }
}

function downloadFile() {
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();
    const downloadUrl = `${API_BASE}/download/${sCode}?extractCode=${eCode}`;
    window.open(downloadUrl, '_blank');
}

function previewShareFile() {
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();
    const fileName = document.getElementById('downloadFileName')?.textContent || '';

    const previewContainer = document.getElementById('sharePreviewContainer');
    const iframe = document.getElementById('sharePreviewIframe');
    if (!previewContainer || !iframe) return;

    const previewUrl = `${API_BASE}/preview/${sCode}?extractCode=${encodeURIComponent(eCode)}`;
    const downloadUrl = `${API_BASE}/download/${sCode}?extractCode=${encodeURIComponent(eCode)}`;

    if (isPdfOrOffice(fileName)) {
        // Use PDF.js viewer for PDF and Office files
        const kind = fileName.split('.').pop().toLowerCase() === 'pdf' ? 'pdf' : 'office';
        const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(previewUrl)}&download=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(fileName)}&kind=${kind}`;
        iframe.src = viewerUrl;
    } else if (isImageFile(fileName)) {
        // Direct image preview
        iframe.src = previewUrl;
    } else {
        // For text/code/media, use the preview URL directly
        iframe.src = previewUrl;
    }

    previewContainer.style.display = 'block';
    previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
