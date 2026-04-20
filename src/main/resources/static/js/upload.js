/**
 * upload.js - 上传逻辑
 */

// 已选择的文件列表
let selectedFiles = [];

function getSelectedDisplayName(file) {
    return file?.webkitRelativePath || file?.name || '';
}

function normalizeUploadFileName(file) {
    const displayName = getSelectedDisplayName(file);
    const normalized = String(displayName || file?.name || '')
        .replace(/[\\/]+/g, '__')
        .trim();
    return normalized || `quickshare-${Date.now()}`;
}

/**
 * 初始化上传区域的拖拽事件
 */
function initUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;

    ['dragenter', 'dragover'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(Array.from(files));
        }
    });
}

/**
 * 处理文件选择事件
 * @param {Event} event - 文件选择事件
 */
function handleFileSelect(event) {
    if (event.target.files.length > 0) {
        handleFiles(Array.from(event.target.files));
    }
}

function openFolderPicker() {
    const input = document.getElementById('folderInput');
    if (input) {
        input.click();
    }
}

/**
 * 处理选中的文件
 * @param {File[]} files - 文件数组
 */
function handleFiles(files) {
    selectedFiles = [...selectedFiles, ...files];
    displayFileList();

    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        uploadBtn.disabled = false;
    }

    const resultBox = document.getElementById('resultBox');
    if (resultBox) {
        resultBox.classList.remove('show');
    }

    showToast(
        t('filesAdded').replace('{count}', files.length),
        'success'
    );
}

/**
 * 显示待上传文件列表
 */
function displayFileList() {
    const fileList = document.getElementById('fileList');
    const fileItems = document.getElementById('fileItems');

    if (!fileList || !fileItems) return;

    if (selectedFiles.length === 0) {
        fileList.style.display = 'none';
        return;
    }

    fileList.style.display = 'block';
    fileItems.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-item-info">
                <strong><i class="fa-regular fa-file"></i> ${getSelectedDisplayName(file)}</strong>
                <small>${formatFileSize(file.size)}</small>
            </div>
            <button class="remove-file-btn" onclick="removeFile(${index})">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        fileItems.appendChild(item);
    });
}

/**
 * 从列表中移除文件
 * @param {number} index - 文件索引
 */
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();

    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn && selectedFiles.length === 0) {
        uploadBtn.disabled = true;
    }
}

/**
 * 上传并分享文件
 */
async function uploadAndShare() {
    if (selectedFiles.length === 0) return;

    const uploadBtn = document.getElementById('uploadBtn');
    const originalBtnContent = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<div class="loading-spinner"></div> ${t('processing')}`;

    const resultBox = document.getElementById('resultBox');
    resultBox.classList.remove('show');

    const shareLinks = [];

    try {
        const token = getAuthToken();

        for (const file of selectedFiles) {
            // 上传文件
            const formData = new FormData();
            formData.append('file', file, normalizeUploadFileName(file));

            const upRes = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            const upData = await upRes.json();

            if (upData.code !== 200) {
                throw new Error(upData.message || 'Upload failed');
            }

            // 创建分享
            const sharePayload = {
                fileId: upData.data.id,
                guestUploadToken: upData.data.guestUploadToken || null,
                extractCode: document.getElementById('extractCode').value || null,
                expireHours: parseInt(document.getElementById('expireHours').value) || null,
                maxDownload: parseInt(document.getElementById('maxDownload').value) || null
            };

            const shareRes = await fetch(`${API_BASE}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(sharePayload)
            });
            const shareData = await shareRes.json();

            if (shareData.code !== 200) {
                throw new Error(shareData.message || 'Share failed');
            }

            shareLinks.push({ fileName: getSelectedDisplayName(file), ...shareData.data });
        }

        // 显示分享链接
        displayShareLinks(shareLinks);

        // 清空已选文件
        selectedFiles = [];
        displayFileList();

        showToast(t('filesSharedSuccessfully'), 'success');

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        uploadBtn.innerHTML = originalBtnContent;
        uploadBtn.disabled = selectedFiles.length === 0;
    }
}

/**
 * 显示分享链接结果
 * @param {Array} links - 分享链接数组
 */
function displayShareLinks(links) {
    const resultBox = document.getElementById('resultBox');

    let html = `<h3 style="color:var(--success); text-align:center; margin-bottom:20px;">
        <i class="fa-regular fa-circle-check"></i> ${t('createSuccess')}
    </h3>`;

    links.forEach((link, idx) => {
        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        let fullUrl = `${baseUrl}#share=${link.shareCode}`;
        if (link.extractCode) {
            fullUrl += `&code=${link.extractCode}`;
        }

        html += `
            <div class="result-card-container">
                <h4 style="color:var(--text-main); margin-bottom:15px; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-regular fa-file-lines" style="color: var(--accent);"></i>
                    <span>${idx + 1}. ${link.fileName}</span>
                </h4>

                <div class="result-item full-link">
                    <span class="result-label" data-i18n="fullLink">
                        <i class="fa-solid fa-link"></i> ${t('fullLink')}
                    </span>
                    <div class="result-value-row">
                        <span class="result-value" id="fullUrl${idx}">${fullUrl}</span>
                        <button class="copy-btn" onclick="copyText('fullUrl${idx}', this)">
                            <i class="fa-regular fa-copy"></i>
                            <span class="copy-btn-text" data-i18n="copy">${t('copy')}</span>
                        </button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="result-item">
                        <span class="result-label" data-i18n="shareCode">
                            <i class="fa-solid fa-hashtag"></i> ${t('shareCode')}
                        </span>
                        <div class="result-value-row">
                            <span class="result-value" id="shareCode${idx}">${link.shareCode}</span>
                            <button class="copy-btn" onclick="copyText('shareCode${idx}', this)">
                                <i class="fa-regular fa-copy"></i>
                                <span class="copy-btn-text" data-i18n="copy">${t('copy')}</span>
                            </button>
                        </div>
                    </div>

                    <div class="result-item">
                        <span class="result-label" data-i18n="extractCode">
                            <i class="fa-solid fa-key"></i> ${t('extractCode')}
                        </span>
                        <div class="result-value-row">
                            <span class="result-value" id="extractCode${idx}">${link.extractCode || t('none')}</span>
                            ${link.extractCode ? `
                                <button class="copy-btn" onclick="copyText('extractCode${idx}', this)">
                                    <i class="fa-regular fa-copy"></i>
                                    <span class="copy-btn-text" data-i18n="copy">${t('copy')}</span>
                                </button>
                            ` : `<span style="color: var(--text-sub); font-size: 0.75rem; padding: 8px;">-</span>`}
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: center; margin-top: 15px;">
                    <div class="qrcode-container">
                        <div id="qrcode${idx}"></div>
                        <p class="qrcode-hint" data-i18n="scanToAccess">
                            <i class="fa-solid fa-qrcode"></i>
                            ${t('scanToAccess')}
                        </p>
                    </div>
                </div>
            </div>
        `;
    });

    resultBox.innerHTML = html;
    resultBox.classList.add('show');

    // 生成二维码
    generateQRCodes(links);
}

/**
 * 获取已选文件列表
 * @returns {File[]}
 */
function getSelectedFiles() {
    return selectedFiles;
}

/**
 * 清空已选文件
 */
function clearSelectedFiles() {
    selectedFiles = [];
    displayFileList();
}

window.openFolderPicker = openFolderPicker;
