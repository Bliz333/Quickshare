/**
 * qrcode-handler.js - 二维码生成处理
 */

/**
 * 检测是否为暗黑模式
 */
function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

/**
 * 获取二维码颜色配置
 */
function getQRCodeColors() {
    if (isDarkMode()) {
        return {
            colorDark: "#f1f5f9",
            colorLight: "#1e293b"
        };
    }
    return {
        colorDark: "#000000",
        colorLight: "#ffffff"
    };
}

/**
 * 为分享链接生成二维码
 * @param {Array} links - 分享链接数组
 */
function generateQRCodes(links) {
    const colors = getQRCodeColors();

    links.forEach((link, idx) => {
        const qrcodeContainer = document.getElementById(`qrcode${idx}`);
        if (!qrcodeContainer) return;

        qrcodeContainer.innerHTML = '';

        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        let fullUrl = `${baseUrl}#share=${link.shareCode}`;
        if (link.extractCode) {
            fullUrl += `&code=${link.extractCode}`;
        }

        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded');
            qrcodeContainer.innerHTML = '<p style="color: #ef4444;">QRCode 加载失败</p>';
            return;
        }

        try {
            new QRCode(qrcodeContainer, {
                text: fullUrl,
                width: 128,
                height: 128,
                colorDark: colors.colorDark,
                colorLight: colors.colorLight,
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (error) {
            console.error('QRCode generation error:', error);
            qrcodeContainer.innerHTML = '<p style="color: #ef4444;">二维码生成失败</p>';
        }
    });
}

/**
 * 重新生成所有二维码（主题切换时调用）
 */
function regenerateQRCodes() {
    const colors = getQRCodeColors();

    // 找到所有二维码容器
    let idx = 0;
    while (true) {
        const container = document.getElementById(`qrcode${idx}`);
        if (!container) break;

        // 获取当前二维码的 URL（从相邻的 fullUrl 元素获取）
        const fullUrlEl = document.getElementById(`fullUrl${idx}`);
        if (fullUrlEl && typeof QRCode !== 'undefined') {
            const url = fullUrlEl.textContent;
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
                console.error('QRCode regeneration error:', error);
            }
        }
        idx++;
    }
}

/**
 * 生成单个二维码
 */
function generateSingleQRCode(containerId, url, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`QRCode container not found: ${containerId}`);
        return;
    }

    container.innerHTML = '';

    if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded');
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

    try {
        new QRCode(container, { ...defaultOptions, ...options });
    } catch (error) {
        console.error('QRCode generation error:', error);
    }
}