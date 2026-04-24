/**
 * login.js - 登录页面逻辑
 */

function getSafeAuthRedirectTarget(defaultTarget) {
    const fallback = defaultTarget || 'index.html';
    const raw = new URLSearchParams(window.location.search).get('redirect');
    if (!raw) return fallback;

    try {
        const decoded = decodeURIComponent(raw);
        if (!decoded || decoded.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
            return fallback;
        }
        return decoded.startsWith('/') ? decoded.slice(1) : decoded;
    } catch (error) {
        return fallback;
    }
}

function getRegisterUrlWithRedirect() {
    const target = getSafeAuthRedirectTarget('');
    return target ? 'register.html?redirect=' + encodeURIComponent(target) : 'register.html';
}

function syncRegisterLinkRedirect() {
    const link = document.querySelector('[data-auth-register-link]');
    if (link) {
        link.href = getRegisterUrlWithRedirect();
    }
}

/**
 * 处理登录表单提交
 * @param {Event} event
 */
function localizeLoginErrorMessage(message) {
    const normalized = (message || '').trim();
    const directMap = {
        '用户名或密码错误': 'invalidCredentials',
        'Missing username or password': 'missingCredentials',
        'Invalid username or password': 'invalidCredentials'
    };

    if (directMap[normalized]) {
        return t(directMap[normalized]);
    }

    if (normalized.includes('用户名或密码错误')) {
        return t('invalidCredentials');
    }

    return normalized || t('loginFailed');
}

async function handleLogin(event) {
    event.preventDefault();

    const lang = getCurrentLanguage();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // 验证输入
    if (!username || !password) {
        showToast(t('missingCredentials'), 'error');
        return;
    }

    const loginBtn = document.getElementById('loginBtn');
    const originalHTML = loginBtn.innerHTML;

    // 显示加载状态
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>' + t('loggingIn') + '</span>';

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.code === 200) {
            // 保存登录信息
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data));

            showToast(t('loginSuccess'), 'success');

            // 跳转回受保护入口，默认回首页。
            setTimeout(() => {
                window.location.href = getSafeAuthRedirectTarget('index.html');
            }, 1000);
        } else {
            throw new Error(result.message || t('loginFailed'));
        }
    } catch (error) {
        showToast(localizeLoginErrorMessage(error.message), 'error');
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalHTML;
    }
}

/**
 * 检查是否已登录
 */
function checkAlreadyLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        // 已登录，跳转回受保护入口，默认回首页。
        window.location.href = getSafeAuthRedirectTarget('index.html');
    }
}

// 页面加载时检查登录状态
if (document.readyState === 'complete') {
    syncRegisterLinkRedirect();
    checkAlreadyLoggedIn();
} else {
    window.addEventListener('load', () => {
        syncRegisterLinkRedirect();
        checkAlreadyLoggedIn();
    });
}
