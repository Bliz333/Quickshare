/**
 * social-login.js - Dynamic social login buttons based on server config
 */
(function () {
    'use strict';

    var socialState = { googleClientId: null };

    function loadSocialConfig() {
        fetch(API_BASE + '/public/registration-settings')
            .then(function (r) { return r.json(); })
            .then(function (result) {
                if (result.code === 200 && result.data) {
                    socialState.googleClientId = result.data.googleClientId || null;
                    renderSocialButtons();
                }
            })
            .catch(function () {});
    }

    function renderSocialButtons() {
        var container = document.getElementById('socialButtons');
        var divider = document.getElementById('socialDivider');
        if (!container) return;

        var html = '';

        if (socialState.googleClientId) {
            html += '<button type="button" class="social-btn" id="googleLoginBtn">' +
                '<i class="fa-brands fa-google"></i>' +
                '<span>Google</span></button>';
        }

        container.innerHTML = html;

        var hasButtons = html.length > 0;
        if (divider) divider.style.display = hasButtons ? 'flex' : 'none';

        if (socialState.googleClientId) {
            loadGoogleGIS(socialState.googleClientId);
            var btn = document.getElementById('googleLoginBtn');
            if (btn) btn.addEventListener('click', handleGoogleLogin);
        }
    }

    function loadGoogleGIS(clientId) {
        if (window.google && window.google.accounts) return;
        var script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }

    function handleGoogleLogin() {
        var btn = document.getElementById('googleLoginBtn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

        try {
            var client = google.accounts.oauth2.initTokenClient({
                client_id: socialState.googleClientId,
                scope: 'openid email profile',
                callback: function (response) {
                    if (response.error) {
                        showToast(response.error, 'error');
                        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
                        return;
                    }
                    sendGoogleToken(response.access_token);
                },
                error_callback: function () {
                    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
                }
            });
            client.requestAccessToken();
        } catch (e) {
            showToast('Google login failed', 'error');
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
    }

    function sendGoogleToken(accessToken) {
        fetch(API_BASE + '/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: accessToken })
        })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (result.code === 200 && result.data) {
                localStorage.setItem('token', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data));
                var lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en';
                showToast(lang === 'zh' ? '登录成功' : 'Signed in', 'success');
                setTimeout(function () { window.location.href = 'netdisk.html'; }, 800);
            } else {
                throw new Error(result.message || 'Login failed');
            }
        })
        .catch(function (e) {
            showToast(e.message, 'error');
            var btn = document.getElementById('googleLoginBtn');
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        });
    }

    if (document.readyState === 'complete') {
        loadSocialConfig();
    } else {
        window.addEventListener('load', loadSocialConfig);
    }
})();
