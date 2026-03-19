/**
 * download.js - 下载与预览逻辑
 */

let _shareFileType = null;

function initGuestMode(shareCode, extractCode) {
    console.log('进入访客模式:', shareCode, extractCode);

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

    if (window.location.hash.includes('share=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        shareCode = params.get('share');
        extractCode = params.get('code');
    } else if (window.location.search.includes('share=')) {
        const params = new URLSearchParams(window.location.search);
        shareCode = params.get('share');
        extractCode = params.get('code');
    }

    return { shareCode, extractCode };
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
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';

    if (!sCode) {
        showToast(lang === 'zh' ? '请输入分享码' : 'Please enter share code', 'error');
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
        showToast(err.message, 'error');
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
