/**
 * register.js - 注册页面逻辑
 */

let countdown = 0;
let registrationSettings = {
    emailVerificationEnabled: true,
    recaptchaEnabled: false,
    captchaProvider: 'recaptcha',
    recaptchaSiteKey: ''
};
let captchaScriptLoaded = false;
let captchaRenderQueued = false;
let captchaWidgetId = null;

function getSafeAuthRedirectTarget(defaultTarget) {
    const fallback = defaultTarget || 'netdisk.html';
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

function getLoginUrlWithRedirect() {
    const target = getSafeAuthRedirectTarget('');
    return target ? 'login.html?redirect=' + encodeURIComponent(target) : 'login.html';
}

function syncLoginLinkRedirect() {
    const link = document.querySelector('[data-auth-login-link]');
    if (link) {
        link.href = getLoginUrlWithRedirect();
    }
}

function localizeRegisterErrorMessage(message) {
    const normalized = (message || '').trim();
    const directMap = {
        '用户名已存在': 'usernameExists',
        '用户名至少 3 个字符': 'usernameTooShort',
        '请输入验证码': 'verificationCodeRequired',
        '验证码错误或已过期': 'verificationCodeInvalid',
        '请填写邮箱': 'emailRequired',
        '邮箱不能为空': 'emailRequired',
        'Email is required': 'emailRequired',
        'Username already exists': 'usernameExists'
    };

    if (directMap[normalized]) {
        return t(directMap[normalized]);
    }

    if (normalized.includes('用户名已存在')) {
        return t('usernameExists');
    }
    if (normalized.includes('验证码错误')) {
        return t('verificationCodeInvalid');
    }

    return normalized || t('registerFailed');
}

async function loadRegistrationSettings() {
    try {
        const response = await fetch(`${API_BASE}/public/registration-settings`);
        const result = await response.json();
        if (response.ok && result?.code === 200 && result.data) {
            registrationSettings = {
                ...registrationSettings,
                ...result.data
            };
        }
    } catch (error) {
        console.warn('Failed to load registration settings:', error);
    }

    applyRegistrationSettings();
}

function applyRegistrationSettings() {
    const emailInput = document.getElementById('email');
    const verificationCodeInput = document.getElementById('verificationCode');
    const verificationCodeGroup = document.getElementById('verificationCodeGroup');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const captchaContainer = document.getElementById('captchaContainer');

    const emailVerificationEnabled = !!registrationSettings.emailVerificationEnabled;
    if (emailInput) {
        emailInput.required = emailVerificationEnabled;
    }
    if (verificationCodeInput) {
        verificationCodeInput.required = emailVerificationEnabled;
        if (!emailVerificationEnabled) {
            verificationCodeInput.value = '';
        }
    }
    if (verificationCodeGroup) {
        verificationCodeGroup.classList.toggle('hidden', !emailVerificationEnabled);
    }
    if (sendCodeBtn) {
        sendCodeBtn.classList.toggle('hidden', !emailVerificationEnabled);
        sendCodeBtn.disabled = !emailVerificationEnabled;
        if (!emailVerificationEnabled) {
            sendCodeBtn.textContent = t('sendCodeBtn');
        }
    }

    const recaptchaEnabled = !!registrationSettings.recaptchaEnabled && !!registrationSettings.recaptchaSiteKey;
    if (captchaContainer) {
        captchaContainer.classList.toggle('hidden', !recaptchaEnabled);
        if (!recaptchaEnabled) {
            captchaContainer.innerHTML = '';
        }
    }

    if (recaptchaEnabled) {
        loadCaptchaScript();
    }
}

function getCaptchaProvider() {
    return registrationSettings.captchaProvider || 'recaptcha';
}

function loadCaptchaScript() {
    const provider = getCaptchaProvider();
    if (captchaScriptLoaded) {
        renderCaptcha();
        return;
    }

    const scriptAttr = 'data-captcha-script';
    if (document.querySelector(`script[${scriptAttr}="true"]`)) {
        captchaRenderQueued = true;
        return;
    }

    captchaRenderQueued = true;
    const script = document.createElement('script');
    if (provider === 'turnstile') {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onCaptchaApiReady';
    } else {
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onCaptchaApiReady';
    }
    script.async = true;
    script.defer = true;
    script.dataset.captchaScript = 'true';
    document.head.appendChild(script);
}

window.onCaptchaApiReady = function() {
    captchaScriptLoaded = true;
    renderCaptcha();
};

function renderCaptcha() {
    if (!registrationSettings.recaptchaEnabled || !registrationSettings.recaptchaSiteKey) {
        return;
    }

    const container = document.getElementById('captchaContainer');
    if (!container) return;

    container.innerHTML = '';
    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'captcha-widget';
    container.appendChild(widgetDiv);

    const isDark = document.documentElement.classList.contains('dark-mode');
    const provider = getCaptchaProvider();

    if (provider === 'turnstile' && typeof turnstile !== 'undefined') {
        captchaWidgetId = turnstile.render('#captcha-widget', {
            sitekey: registrationSettings.recaptchaSiteKey,
            theme: isDark ? 'dark' : 'light'
        });
    } else if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
        captchaWidgetId = grecaptcha.render('captcha-widget', {
            sitekey: registrationSettings.recaptchaSiteKey,
            theme: isDark ? 'dark' : 'light'
        });
    }
    captchaRenderQueued = false;
}

function getCaptchaResponse() {
    if (!registrationSettings.recaptchaEnabled) return null;
    const provider = getCaptchaProvider();

    try {
        if (provider === 'turnstile' && typeof turnstile !== 'undefined') {
            return turnstile.getResponse(captchaWidgetId);
        }
        if (typeof grecaptcha !== 'undefined') {
            return grecaptcha.getResponse(captchaWidgetId);
        }
    } catch (error) {
        console.warn('Captcha getResponse error:', error);
    }
    return null;
}

function resetCaptcha() {
    if (!registrationSettings.recaptchaEnabled) return;
    try {
        renderCaptcha();
    } catch (error) {
        console.warn('Captcha reset error:', error);
    }
}

async function sendVerificationCode() {
    if (!registrationSettings.emailVerificationEnabled) {
        showToast(t('sendCodeFailed'), 'error');
        return;
    }

    const email = document.getElementById('email').value.trim();

    if (!email) {
        showToast(t('emailRequired'), 'error');
        return;
    }

    if (countdown > 0) return;

    const captchaResponse = getCaptchaResponse();
    if (registrationSettings.recaptchaEnabled && !captchaResponse) {
        showToast(t('captchaRequired'), 'error');
        return;
    }

    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        const payload = {
            email,
            recaptchaToken: captchaResponse,
            locale: typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en'
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
            resetCaptcha();
        } else {
            throw new Error(data.message || t('sendCodeFailed'));
        }
    } catch (err) {
        showToast(localizeRegisterErrorMessage(err.message), 'error');
        btn.disabled = false;
        btn.textContent = t('sendCodeBtn');
        resetCaptcha();
    }
}

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
        email: document.getElementById('email').value.trim() || null,
        verificationCode: document.getElementById('verificationCode').value.trim() || null,
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

            // 跳转回受保护入口，默认进入网盘。
            setTimeout(() => {
                window.location.href = getSafeAuthRedirectTarget('netdisk.html');
            }, 1500);
        } else {
            throw new Error(result.message || t('registerFailed'));
        }
    } catch (err) {
        showToast(localizeRegisterErrorMessage(err.message), 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function checkAlreadyLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        window.location.href = getSafeAuthRedirectTarget('netdisk.html');
    }
}

async function initRegisterPage() {
    syncLoginLinkRedirect();
    checkAlreadyLoggedIn();
    await loadRegistrationSettings();

    const originalToggleTheme = window.toggleTheme;
    if (typeof originalToggleTheme === 'function') {
        window.toggleTheme = function() {
            originalToggleTheme();
            if (registrationSettings.recaptchaEnabled) {
                setTimeout(renderCaptcha, 100);
            }
        };
    }
}

if (document.readyState === 'complete') {
    initRegisterPage();
} else {
    window.addEventListener('load', initRegisterPage);
}
