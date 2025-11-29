/**
 * download.js - 下载逻辑
 */

/**
 * 初始化访客模式（从URL参数自动填充分享码和提取码）
 * @param {string} shareCode - 分享码
 * @param {string} extractCode - 提取码
 */
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

    // 如果两个码都有，自动获取文件信息
    if (shareCode && extractCode) {
        const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
        showToast(lang === 'zh' ? '正在获取文件信息...' : 'Fetching file info...', 'success');
        setTimeout(() => {
            getShareInfo();
        }, 500);
    }
}

/**
 * 解析URL中的分享参数
 * @returns {{shareCode: string|null, extractCode: string|null}}
 */
function parseShareParams() {
    let shareCode = null;
    let extractCode = null;

    // 优先从 hash 解析
    if (window.location.hash.includes('share=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        shareCode = params.get('share');
        extractCode = params.get('code');
    }
    // 其次从 query string 解析
    else if (window.location.search.includes('share=')) {
        const params = new URLSearchParams(window.location.search);
        shareCode = params.get('share');
        extractCode = params.get('code');
    }

    return { shareCode, extractCode };
}

/**
 * 获取分享文件信息
 */
async function getShareInfo() {
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';

    if (!sCode) {
        showToast(lang === 'zh' ? '请输入分享码' : 'Please enter share code', 'error');
        return;
    }

    try {
        let url = `${API_BASE}/share/${sCode}`;
        if (eCode) {
            url += `?extractCode=${eCode}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.code !== 200) {
            if (data.code === 403) {
                throw new Error(lang === 'zh' ? '提取码错误或必填' : 'Invalid or required extract code');
            }
            throw new Error(data.message || (lang === 'zh' ? '获取失败' : 'Failed to get info'));
        }

        const info = data.data;

        // 显示文件名
        const fileNameEl = document.getElementById('downloadFileName');
        if (fileNameEl) {
            fileNameEl.textContent = info.fileName;
        }

        // 显示过期时间
        let expireText = lang === 'zh' ? '永久有效' : 'Never expires';
        if (info.expireTime) {
            expireText = new Date(info.expireTime).toLocaleString();
        }
        const expireTimeEl = document.getElementById('downloadExpireTime');
        if (expireTimeEl) {
            expireTimeEl.textContent = expireText;
        }

        // 显示剩余下载次数
        const remainingEl = document.getElementById('downloadRemaining');
        if (remainingEl) {
            const unlimitedText = lang === 'zh' ? '无限制' : 'Unlimited';
            remainingEl.textContent = (info.maxDownload === -1 || info.maxDownload === null)
                ? unlimitedText
                : info.maxDownload;
        }

        // 显示下载信息区域
        const infoBox = document.getElementById('downloadInfo');
        if (infoBox) {
            infoBox.style.display = 'block';
            infoBox.style.animation = 'slideUp 0.5s ease-out';
        }

    } catch (err) {
        showToast(err.message, 'error');
        const infoBox = document.getElementById('downloadInfo');
        if (infoBox) {
            infoBox.style.display = 'none';
        }
    }
}

/**
 * 下载文件
 */
function downloadFile() {
    const sCode = document.getElementById('downloadShareCode').value.trim();
    const eCode = document.getElementById('downloadExtractCode').value.trim();

    const downloadUrl = `${API_BASE}/download/${sCode}?extractCode=${eCode}`;
    window.open(downloadUrl, '_blank');
}