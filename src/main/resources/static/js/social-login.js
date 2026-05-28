/**
 * social-login.js - Dynamic social login buttons based on server config
 *
 * Uses Google Identity Services (GIS) OAuth 2.0 popup flow:
 *   google.accounts.oauth2.initTokenClient({ ux_mode: 'popup' })
 * The popup is the standard Google account-chooser dialog (not the One Tap
 * top-right notification produced by google.accounts.id.prompt()).
 * Falls back to the legacy id_token path if the OAuth2 client is unavailable.
 */
(function () {
    'use strict';

    var socialState = {
        googleClientId: null,
        configRequestId: 0,
        configRetryCount: 0,
        gisScriptRequested: false,
        gisRetryCount: 0,
        configRetryTimer: null,
        tokenClient: null
    };

    var MAX_CONFIG_RETRIES = 4;
    var MAX_GIS_RETRIES = 3;
    var GOOGLE_SCOPES = 'openid email profile';

    function t(zhText, enText) {
        var lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'en';
        return lang === 'zh' ? zhText : enText;
    }

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
            if (window.google && window.google.accounts) {
                initGoogleSignIn(clientId);
            }
        }

        if (window.google && window.google.accounts) {
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

    function patchWindowOpenForGoogleCentering() {
        if (typeof window === 'undefined' || window.__quickshareGoogleOpenPatched) {
            return;
        }
        var originalOpen = window.open;
        if (typeof originalOpen !== 'function') {
            return;
        }
        window.open = function patchedOpen(url, target, features) {
            try {
                if (typeof url === 'string' && url.indexOf('accounts.google.com') !== -1) {
                    var w = 500;
                    var h = 600;
                    var screenW = (window.screen && (window.screen.availWidth || window.screen.width)) || 1280;
                    var screenH = (window.screen && (window.screen.availHeight || window.screen.height)) || 800;
                    var baseLeft = (window.screen && window.screen.availLeft) || 0;
                    var baseTop = (window.screen && window.screen.availTop) || 0;
                    var left = Math.max(0, Math.round(baseLeft + (screenW - w) / 2));
                    var top = Math.max(0, Math.round(baseTop + (screenH - h) / 3));
                    var pos = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top;
                    features = features ? features + ',' + pos : pos;
                }
            } catch (e) {
                // best-effort positioning only
            }
            return originalOpen.call(window, url, target, features);
        };
        window.__quickshareGoogleOpenPatched = true;
    }

    function initGoogleSignIn(clientId) {
        socialState.tokenClient = null;
        patchWindowOpenForGoogleCentering();

        var hasOauth2 = window.google.accounts.oauth2
            && typeof window.google.accounts.oauth2.initTokenClient === 'function';
        var hasIdApi = window.google.accounts.id
            && typeof window.google.accounts.id.initialize === 'function';

        if (hasOauth2) {
            socialState.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: GOOGLE_SCOPES,
                ux_mode: 'popup',
                callback: function (tokenResponse) {
                    if (tokenResponse && tokenResponse.access_token) {
                        sendGoogleAccessToken(tokenResponse.access_token);
                    } else {
                        resetBtn();
                    }
                },
                error_callback: function (err) {
                    if (err && err.type !== 'popup_closed') {
                        showToast(t('Google 登录失败', 'Google login failed'), 'error');
                    }
                    resetBtn();
                }
            });
        }

        if (hasIdApi) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: function (response) {
                    if (response && response.credential) {
                        sendGoogleIdToken(response.credential);
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: true,
                use_fedcm_for_prompt: true
            });

            if (!socialState.oneTapShown) {
                socialState.oneTapShown = true;
                try {
                    window.google.accounts.id.prompt();
                } catch (e) {
                    // One Tap is opportunistic — if it can't show, the
                    // button-click OAuth2 popup remains available.
                }
            }
        }
    }

    function resetBtn() {
        var btn = document.getElementById('googleLoginBtn');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }

    function handleGoogleLogin() {
        var btn = document.getElementById('googleLoginBtn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

        try {
            if (socialState.tokenClient) {
                socialState.tokenClient.requestAccessToken({ prompt: 'select_account' });
                return;
            }

            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.prompt(function (notification) {
                    if (notification.isNotDisplayed && notification.isNotDisplayed()) {
                        var reason = notification.getNotDisplayedReason && notification.getNotDisplayedReason();
                        showToast(t('Google 登录不可用 (' + (reason || '未知') + ')',
                                    'Google sign-in unavailable (' + (reason || 'unknown') + ')'), 'error');
                        resetBtn();
                        return;
                    }
                    if (notification.isSkippedMoment && notification.isSkippedMoment()) {
                        resetBtn();
                    }
                });
                return;
            }

            showToast(t('Google 登录不可用', 'Google sign-in unavailable'), 'error');
            resetBtn();
        } catch (e) {
            showToast(t('Google 登录失败', 'Google login failed'), 'error');
            resetBtn();
        }
    }

    function postGoogleAuth(body) {
        return fetch(API_BASE + '/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (result.code === 200 && result.data) {
                localStorage.setItem('token', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data));
                showToast(t('登录成功', 'Signed in'), 'success');
                setTimeout(function () {
                    window.location.href = window.QuickShareRoutes && typeof window.QuickShareRoutes.cleanPageUrl === 'function'
                        ? window.QuickShareRoutes.cleanPageUrl('index.html')
                        : 'index.html';
                }, 800);
            } else {
                throw new Error(result.message || 'Login failed');
            }
        })
        .catch(function (e) {
            showToast(e.message, 'error');
            resetBtn();
        });
    }

    function sendGoogleAccessToken(accessToken) {
        return postGoogleAuth({ accessToken: accessToken });
    }

    function sendGoogleIdToken(idToken) {
        return postGoogleAuth({ idToken: idToken });
    }

    function initSocialLoginButtons() {
        if (!document.getElementById('socialButtons')) {
            return;
        }
        if (socialState.googleClientId) {
            renderSocialButtons();
            return;
        }
        loadSocialConfig();
    }

    window.initSocialLoginButtons = initSocialLoginButtons;
    window.addEventListener('quickshare:languagechange', renderSocialButtons);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initSocialLoginButtons();
    } else {
        document.addEventListener('DOMContentLoaded', initSocialLoginButtons);
    }
})();
