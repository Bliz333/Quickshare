/**
 * register.js - 注册页面逻辑
 */

// 验证码倒计时
let countdown = 0;

/**
 * 获取 reCAPTCHA 响应
 * @returns {string|null}
 */
function getRecaptchaResponse() {
    if (typeof grecaptcha === 'undefined') return null;

    try {
        // 尝试获取响应
        return grecaptcha.getResponse();
    } catch (e) {
        console.warn('reCAPTCHA getResponse error:', e);
        return null;
    }
}

/**
 * 重置 reCAPTCHA
 */
function resetRecaptcha() {
    if (typeof grecaptcha !== 'undefined' && typeof renderRecaptcha === 'function') {
        try {
            renderRecaptcha();
        } catch (e) {
            console.warn('reCAPTCHA reset error:', e);
        }
    }
}

/**
 * 发送邮箱验证码
 */
async function sendVerificationCode() {
    const email = document.getElementById('email').value.trim();

    if (!email) {
        showToast(t('emailRequired'), 'error');
        return;
    }

    if (countdown > 0) return;

    // 检查 reCAPTCHA
    const recaptchaResponse = getRecaptchaResponse();
    if (!recaptchaResponse) {
        showToast(t('captchaRequired'), 'error');
        return;
    }

    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        const payload = {
            email,
            recaptchaToken: recaptchaResponse
        };

        const res = await fetch(`${API_BASE}/auth/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.code === 200) {
            showToast(t('codeSent'), 'success');
            startCountdown(btn);
            resetRecaptcha();
        } else {
            throw new Error(data.message || t('sendCodeFailed'));
        }
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = t('sendCodeBtn');
        resetRecaptcha();
    }
}

/**
 * 开始倒计时
 * @param {HTMLElement} btn
 */
function startCountdown(btn) {
    countdown = 60;

    const timer = setInterval(() => {
        countdown--;
        btn.textContent = `${countdown}s`;

        if (countdown <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = t('sendCodeBtn');
        }
    }, 1000);
}

/**
 * 处理注册表单提交
 * @param {Event} event
 */
async function handleRegister(event) {
    event.preventDefault();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证密码匹配
    if (password !== confirmPassword) {
        showToast(t('passwordMismatch'), 'error');
        return;
    }

    // 验证密码长度
    if (password.length < 6) {
        showToast(t('passwordTooShort'), 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>' + t('registering') + '</span>';

    const payload = {
        username: document.getElementById('username').value.trim(),
        password: password,
        email: document.getElementById('email').value.trim(),
        verificationCode: document.getElementById('verificationCode').value.trim(),
        nickname: document.getElementById('nickname').value.trim() || null
    };

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (result.code === 200) {
            // 保存登录信息
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data));

            showToast(t('registerSuccess'), 'success');

            // 跳转到网盘
            setTimeout(() => {
                window.location.href = 'netdisk.html';
            }, 1500);
        } else {
            throw new Error(result.message || t('registerFailed'));
        }
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

/**
 * 检查是否已登录
 */
function checkAlreadyLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        window.location.href = 'netdisk.html';
    }
}

// 页面加载时检查登录状态
window.addEventListener('load', checkAlreadyLoggedIn);