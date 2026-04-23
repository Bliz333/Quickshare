/**
 * login.js - 登录页面逻辑
 */

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

            // 跳转到首页
            setTimeout(() => {
                window.location.href = 'index.html';
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
        // 已登录，跳转到首页
        window.location.href = 'index.html';
    }
}

// 页面加载时检查登录状态
if (document.readyState === 'complete') {
    checkAlreadyLoggedIn();
} else {
    window.addEventListener('load', checkAlreadyLoggedIn);
}
