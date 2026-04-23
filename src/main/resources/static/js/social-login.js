/**
 * social-login.js - Dynamic social login buttons based on server config
 *
 * Uses Google Identity Services (GIS) "Sign In With Google" flow:
 *   google.accounts.id.initialize() + prompt()
 * which returns a JWT id_token (credential) instead of an OAuth2 access_token.
 */
(function () {
    'use strict';

    var socialState = {
        googleClientId: null,
        configRequestId: 0,
        configRetryCount: 0,
        gisScriptRequested: false,
        gisRetryCount: 0,
        configRetryTimer: null
    };

    var MAX_CONFIG_RETRIES = 4;
    var MAX_GIS_RETRIES = 3;

    function scheduleConfigRetry() {
        if (socialState.configRetryTimer || socialState.configRetryCount >= MAX_CONFIG_RETRIES) {
            return;
        }
        socialState.configRetryCount += 1;
        socialState.configRetryTimer = window.setTimeout(function () {
            socialState.configRetryTimer = null;
            loadSocialConfig();
        }, 1500);
    }

    function loadSocialConfig() {
        var requestId = ++socialState.configRequestId;
        fetch(API_BASE + '/public/registration-settings')
            .then(function (r) { return r.json(); })
            .then(function (result) {
                if (requestId !== socialState.configRequestId) {
                    return;
                }
                if (result.code === 200 && result.data) {
                    socialState.googleClientId = result.data.googleClientId || null;
                    renderSocialButtons();
                    if (socialState.googleClientId) {
                        socialState.configRetryCount = 0;
                    }
                    if (!socialState.googleClientId) {
                        scheduleConfigRetry();
                    }
                    return;
                }
                scheduleConfigRetry();
            })
            .catch(function () {
                if (requestId !== socialState.configRequestId) {
                    return;
                }
                scheduleConfigRetry();
            });
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
        function onReady() {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                initGoogleSignIn(clientId);
            }
        }

        if (window.google && window.google.accounts && window.google.accounts.id) {
            socialState.gisScriptRequested = false;
            onReady();
            return;
        }

        if (socialState.gisScriptRequested || socialState.gisRetryCount >= MAX_GIS_RETRIES) {
            return;
        }

        socialState.gisScriptRequested = true;
        socialState.gisRetryCount += 1;

        var script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = function () {
            socialState.gisScriptRequested = false;
            onReady();
        };
        script.onerror = function () {
            socialState.gisScriptRequested = false;
            scheduleConfigRetry();
        };
        document.head.appendChild(script);
    }

    function initGoogleSignIn(clientId) {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: function (response) {
                if (response.credential) {
                    sendGoogleToken(response.credential);
                } else {
                    resetBtn();
                }
            },
            auto_select: false,
            cancel_on_tap_outside: true
        });
    }

    function resetBtn() {
        var btn = document.getElementById('googleLoginBtn');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }

    function handleGoogleLogin() {
        var btn = document.getElementById('googleLoginBtn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

        try {
            google.accounts.id.prompt(function (notification) {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    resetBtn();
                }
            });
        } catch (e) {
            showToast('Google login failed', 'error');
            resetBtn();
        }
    }

    function sendGoogleToken(idToken) {
        fetch(API_BASE + '/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: idToken })
        })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (result.code === 200 && result.data) {
                localStorage.setItem('token', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data));
                var lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en';
                showToast(lang === 'zh' ? '登录成功' : 'Signed in', 'success');
                setTimeout(function () { window.location.href = 'index.html'; }, 800);
            } else {
                throw new Error(result.message || 'Login failed');
            }
        })
        .catch(function (e) {
            showToast(e.message, 'error');
            resetBtn();
        });
    }

    window.addEventListener('quickshare:languagechange', renderSocialButtons);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadSocialConfig();
    } else {
        document.addEventListener('DOMContentLoaded', loadSocialConfig);
    }
})();
