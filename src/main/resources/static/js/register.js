/**
 * register.js - 注册页面逻辑
 */

let countdown = 0;
let registrationSettings = {
    emailVerificationEnabled: true,
    recaptchaEnabled: false,
    recaptchaSiteKey: ''
};
let recaptchaScriptLoaded = false;
let recaptchaRenderQueued = false;

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
        loadRecaptchaScript();
    }
}

function loadRecaptchaScript() {
    if (recaptchaScriptLoaded) {
        renderRecaptcha();
        return;
    }

    if (document.querySelector('script[data-recaptcha-script="true"]')) {
        recaptchaRenderQueued = true;
        return;
    }

    recaptchaRenderQueued = true;
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaScript = 'true';
    script.onload = () => {
        recaptchaScriptLoaded = true;
        renderRecaptcha();
    };
    document.head.appendChild(script);
}

function renderRecaptcha() {
    if (!registrationSettings.recaptchaEnabled || !registrationSettings.recaptchaSiteKey) {
        return;
    }

    const container = document.getElementById('captchaContainer');
    if (!container || typeof grecaptcha === 'undefined' || typeof grecaptcha.render !== 'function') {
        return;
    }

    container.innerHTML = '';
    const recaptchaDiv = document.createElement('div');
    recaptchaDiv.id = 'recaptcha-widget';
    container.appendChild(recaptchaDiv);

    const isDark = document.documentElement.classList.contains('dark-mode');
    grecaptcha.render('recaptcha-widget', {
        sitekey: registrationSettings.recaptchaSiteKey,
        theme: isDark ? 'dark' : 'light'
    });
    recaptchaRenderQueued = false;
}

function getRecaptchaResponse() {
    if (!registrationSettings.recaptchaEnabled) return null;
    if (typeof grecaptcha === 'undefined') return null;

    try {
        return grecaptcha.getResponse();
    } catch (error) {
        console.warn('reCAPTCHA getResponse error:', error);
        return null;
    }
}

function resetRecaptcha() {
    if (registrationSettings.recaptchaEnabled && typeof grecaptcha !== 'undefined' && typeof renderRecaptcha === 'function') {
        try {
            renderRecaptcha();
        } catch (error) {
            console.warn('reCAPTCHA reset error:', error);
        }
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

    const recaptchaResponse = getRecaptchaResponse();
    if (registrationSettings.recaptchaEnabled && !recaptchaResponse) {
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

function checkAlreadyLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        window.location.href = 'netdisk.html';
    }
}

window.addEventListener('load', async () => {
    checkAlreadyLoggedIn();
    await loadRegistrationSettings();

    const originalToggleTheme = window.toggleTheme;
    if (typeof originalToggleTheme === 'function') {
        window.toggleTheme = function() {
            originalToggleTheme();
            if (registrationSettings.recaptchaEnabled) {
                setTimeout(renderRecaptcha, 100);
            }
        };
    }
});
