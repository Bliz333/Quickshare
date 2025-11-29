/**
 * ui.js - UI 工具函数
 */

/**
 * 显示 Toast 通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型: 'success' | 'error'
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success'
        ? '<i class="fa-solid fa-check-circle"></i>'
        : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 切换标签页
 * @param {string} tab - 标签页名称: 'upload' | 'download'
 */
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tabButtons = document.querySelectorAll('.tab');
    if (tab === 'upload') {
        tabButtons[0].classList.add('active');
    } else {
        tabButtons[1].classList.add('active');
    }

    document.getElementById(tab + '-tab').classList.add('active');
}

/**
 * 复制文本到剪贴板
 * @param {string} id - 元素ID
 * @param {HTMLElement} btn - 复制按钮元素
 */
function copyText(id, btn) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Copy Error: Element with id '${id}' not found.`);
        showToast('内部错误：无法找到文本元素', 'error');
        return;
    }

    const text = (element.innerText || element.textContent).trim();
    console.log('Attempting to copy:', text);

    const originalHTML = btn.innerHTML;
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';

    const handleSuccess = () => {
        console.log('Copy success!');
        btn.classList.add('copied');
        btn.innerHTML = `
            <i class="fa-solid fa-check"></i>
            <span class="copy-btn-text">${lang === 'zh' ? '已复制' : 'Copied'}</span>
        `;
        showToast(lang === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard!', 'success');

        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalHTML;
        }, 2000);
    };

    const handleError = () => {
        console.error('All copy methods failed');
        showToast(lang === 'zh' ? '复制失败，请长按文字手动复制' : 'Copy failed', 'error');

        if (window.getSelection && document.createRange) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);

            setTimeout(() => {
                const userAgent = navigator.userAgent.toLowerCase();
                const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
                if (isMobile) {
                    alert(lang === 'zh' ? "请长按已选中的文字进行复制" : "Please long press to copy the selected text");
                } else {
                    prompt(lang === 'zh' ? "复制失败，请手动复制以下文本：" : "Copy failed. Please copy manually:", text);
                }
            }, 100);
        } else {
            prompt(lang === 'zh' ? "请手动复制以下文本：" : "Please copy manually:", text);
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(handleSuccess)
            .catch((err) => {
                console.warn('Clipboard API failed, trying legacy method:', err);
                tryLegacyCopy(text, handleSuccess, handleError);
            });
    } else {
        tryLegacyCopy(text, handleSuccess, handleError);
    }
}

/**
 * 使用传统方法复制文本（兼容旧浏览器）
 * @param {string} text - 要复制的文本
 * @param {Function} onSuccess - 成功回调
 * @param {Function} onFail - 失败回调
 */
function tryLegacyCopy(text, onSuccess, onFail) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";
        textArea.setAttribute('readonly', '');

        document.body.appendChild(textArea);

        const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isiOS) {
            const range = document.createRange();
            range.selectNodeContents(textArea);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textArea.setSelectionRange(0, 999999);
        } else {
            textArea.select();
            textArea.focus();
        }

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
            onSuccess();
        } else {
            console.warn('execCommand returned false');
            onFail();
        }
    } catch (err) {
        console.error('Legacy copy method error:', err);
        onFail();
    }
}