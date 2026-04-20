/**
 * qrcode-handler.js - 二维码生成处理
 */

const QRCODE_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
let qrcodeLibraryPromise = null;

/**
 * 检测是否为暗黑模式
 */
function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

function getQRCodeStatusText(type) {
    if (type === 'loading') {
        return t('generatingQrCode');
    }

    return t('qrCodeFailed');
}

function renderQRCodeStatus(container, type) {
    if (!container) {
        return;
    }

    const color = type === 'error' ? '#ef4444' : 'var(--text-sub)';
    container.innerHTML = `<p style="color:${color}; font-size:0.8rem; padding:48px 0; text-align:center;">${getQRCodeStatusText(type)}</p>`;
}

function ensureQRCodeLibrary() {
    if (typeof QRCode !== 'undefined') {
        return Promise.resolve(QRCode);
    }

    if (qrcodeLibraryPromise) {
        return qrcodeLibraryPromise;
    }

    qrcodeLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = QRCODE_LIBRARY_URL;
        script.async = true;
        script.onload = () => {
            if (typeof QRCode === 'undefined') {
                reject(new Error('QRCode library not available after load'));
                return;
            }
            resolve(QRCode);
        };
        script.onerror = () => {
            reject(new Error('Failed to load QRCode library'));
        };
        document.head.appendChild(script);
    }).catch((error) => {
        qrcodeLibraryPromise = null;
        throw error;
    });

    return qrcodeLibraryPromise;
}

/**
 * 获取二维码颜色配置
 */
function getQRCodeColors() {
    if (isDarkMode()) {
        return {
            colorDark: '#f1f5f9',
            colorLight: '#1e293b'
        };
    }
    return {
        colorDark: '#000000',
        colorLight: '#ffffff'
    };
}

function buildShareLinkUrl(link) {
    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    let fullUrl = `${baseUrl}#share=${link.shareCode}`;
    if (link.extractCode) {
        fullUrl += `&code=${link.extractCode}`;
    }
    return fullUrl;
}

/**
 * 为分享链接生成二维码
 * @param {Array} links - 分享链接数组
 */
async function generateQRCodes(links) {
    const containers = [];
    links.forEach((link, idx) => {
        const container = document.getElementById(`qrcode${idx}`);
        if (!container) {
            return;
        }
        renderQRCodeStatus(container, 'loading');
        containers.push({ container, url: buildShareLinkUrl(link) });
    });

    if (!containers.length) {
        return;
    }

    try {
        await ensureQRCodeLibrary();
    } catch (error) {
        console.error('QRCode library not loaded:', error);
        containers.forEach(({ container }) => renderQRCodeStatus(container, 'error'));
        return;
    }

    const colors = getQRCodeColors();
    containers.forEach(({ container, url }) => {
        container.innerHTML = '';
        try {
            new QRCode(container, {
                text: url,
                width: 128,
                height: 128,
                colorDark: colors.colorDark,
                colorLight: colors.colorLight,
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (error) {
            console.error('QRCode generation error:', error);
            renderQRCodeStatus(container, 'error');
        }
    });
}

/**
 * 重新生成所有二维码（主题切换时调用）
 */
async function regenerateQRCodes() {
    const containers = document.querySelectorAll('[id^="qrcode"]');
    if (!containers.length) {
        return;
    }

    try {
        await ensureQRCodeLibrary();
    } catch (error) {
        console.error('QRCode library not loaded:', error);
        containers.forEach(container => renderQRCodeStatus(container, 'error'));
        return;
    }

    const colors = getQRCodeColors();

    containers.forEach(container => {
        const index = container.id.replace('qrcode', '');
        const fullUrlEl = document.getElementById(`fullUrl${index}`);
        if (!fullUrlEl) {
            return;
        }

        container.innerHTML = '';
        try {
            new QRCode(container, {
                text: fullUrlEl.textContent,
                width: 128,
                height: 128,
                colorDark: colors.colorDark,
                colorLight: colors.colorLight,
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (error) {
            console.error('QRCode regeneration error:', error);
            renderQRCodeStatus(container, 'error');
        }
    });
}

/**
 * 生成单个二维码
 */
async function generateSingleQRCode(containerId, url, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`QRCode container not found: ${containerId}`);
        return;
    }

    renderQRCodeStatus(container, 'loading');

    try {
        await ensureQRCodeLibrary();
    } catch (error) {
        console.error('QRCode library not loaded:', error);
        renderQRCodeStatus(container, 'error');
        return;
    }

    const colors = getQRCodeColors();
    const defaultOptions = {
        text: url,
        width: 128,
        height: 128,
        colorDark: colors.colorDark,
        colorLight: colors.colorLight,
        correctLevel: QRCode.CorrectLevel.M
    };

    container.innerHTML = '';
    try {
        new QRCode(container, { ...defaultOptions, ...options });
    } catch (error) {
        console.error('QRCode generation error:', error);
        renderQRCodeStatus(container, 'error');
    }
}
