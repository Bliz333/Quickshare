/**
 * spa-router.js - Seamless PJAX navigation between mascot pages
 *
 * Intercepts <a> clicks between index/login/register/share pages.
 * Fetches target page, swaps body content while preserving the mascot layer.
 * Mascots smoothly transition between scenes via spring physics.
 */
'use strict';
(function () {
    if (window.__QUICKSHARE_DISABLE_SPA__ === true) {
        window.spaNavigate = function () { return false; };
        return;
    }
    var SPA_PAGES = {
        'index.html': 'home',
        'login.html': 'login',
        'register.html': 'register',
        'share.html': 'share',
        '': 'home'
    };

    var loaded = {};
    var cache = {};
    var busy = false;
    var queuedTransition = null;
    var curtain = null;
    var currentTarget = normalizeTarget(location.href) || { file: 'index.html', url: 'index.html' };
    var currentFile = currentTarget.file;
    var currentUrl = currentTarget.url;

    /* ── helpers ── */

    function getFile(url) {
        var target = normalizeTarget(url);
        return target ? target.file : '';
    }

    function normalizeTarget(url) {
        try {
            var parsed = new URL(url, location.href);
            if (parsed.origin !== location.origin) return null;
            var file = (parsed.pathname.split('/').pop() || 'index.html').toLowerCase();
            return {
                file: file,
                url: file + parsed.search + parsed.hash
            };
        } catch (e) { return null; }
    }

    function targetFromState(state) {
        if (!state || !state.spa) return normalizeTarget(location.href);
        return {
            file: String(state.spa || '').split('?')[0].split('#')[0].toLowerCase(),
            url: state.spaUrl || state.spa
        };
    }

    function isSpa(file) { return SPA_PAGES.hasOwnProperty(file); }

    function fetchPage(file) {
        if (cache[file]) return Promise.resolve(cache[file]);
        return fetch(file).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.text();
        }).then(function (html) {
            cache[file] = html;
            return html;
        });
    }

    function scriptPath(src) {
        try { return new URL(src, location.href).pathname; } catch (e) { return src; }
    }

    /* ── curtain (fade overlay) ── */

    function ensureCurtain() {
        if (curtain) return curtain;
        curtain = document.createElement('div');
        curtain.id = 'spa-curtain';
        curtain.style.cssText =
            'position:fixed;inset:0;pointer-events:none;opacity:0;' +
            'transition:opacity .18s ease;z-index:99999';
        document.documentElement.appendChild(curtain);
        return curtain;
    }

    function updateCurtainBg() {
        if (!curtain) return;
        curtain.style.background = getComputedStyle(document.body).backgroundColor || '#f0f4fa';
    }

    function stylesheetKey(link) {
        var href = link.getAttribute('href');
        if (!href) return '';
        try { return new URL(href, location.href).href; } catch (e) { return href; }
    }

    function ensureStylesheets(doc) {
        var existing = {};
        var currentLinks = document.querySelectorAll('head link[rel~="stylesheet"][href]');
        for (var i = 0; i < currentLinks.length; i++) {
            existing[stylesheetKey(currentLinks[i])] = true;
        }

        var links = doc.querySelectorAll('head link[rel~="stylesheet"][href]');
        var loads = [];
        for (var j = 0; j < links.length; j++) {
            var source = links[j];
            var key = stylesheetKey(source);
            if (!key || existing[key]) continue;

            var clone = source.cloneNode(true);
            existing[key] = true;
            loads.push(new Promise(function (resolve) {
                clone.onload = resolve;
                clone.onerror = resolve;
                document.head.appendChild(clone);
            }));
        }
        return Promise.all(loads);
    }

    /* ── script loading ── */

    function recordLoaded() {
        var scripts = document.querySelectorAll('script[src]');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src');
            if (src) loaded[scriptPath(src)] = true;
        }
    }

    function loadScript(src) {
        var key = scriptPath(src);
        if (loaded[key]) return Promise.resolve();
        loaded[key] = true;
        return new Promise(function (resolve) {
            var el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = resolve;
            document.body.appendChild(el);
        });
    }

    function execInline(code) {
        try { (new Function(code))(); } catch (e) { console.warn('[SPA]', e); }
    }

    /* ── transition ── */

    function transition(target, options) {
        options = options || {};
        target = typeof target === 'string' ? normalizeTarget(target) : target;
        if (!target || !isSpa(target.file)) return;

        var targetFile = target.file;
        var targetUrl = target.url || target.file;
        if (busy) {
            queuedTransition = { target: target, options: options };
            return;
        }
        if (targetUrl === currentUrl) return;
        busy = true;

        var mcRoot = document.getElementById('mc-root');
        var mcCss = document.getElementById('mc-css');

        // Raise mascots above curtain so they stay visible
        if (mcRoot) mcRoot.style.zIndex = '9999999';

        // Show curtain
        var c = ensureCurtain();
        updateCurtainBg();
        c.style.pointerEvents = 'auto';
        c.style.opacity = '1';

        fetchPage(targetFile).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            return ensureStylesheets(doc).then(function () { return doc; });
        }).then(function (doc) {
            setTimeout(function () {
                // 0. Give current page a chance to clean up long-lived resources
                if (typeof window.__spaBeforeNavigate === 'function') {
                    try { window.__spaBeforeNavigate(targetFile); } catch (e) {}
                }

                // 1. Replace <head> styles (keep mc-css)
                var old = document.querySelectorAll('head > style:not(#mc-css)');
                for (var i = 0; i < old.length; i++) old[i].remove();
                var hStyles = doc.querySelectorAll('head > style');
                for (var j = 0; j < hStyles.length; j++) {
                    document.head.appendChild(document.adoptNode(hStyles[j]));
                }

                // 2. Detach preserved elements
                if (mcRoot) mcRoot.remove();
                if (mcCss) mcCss.remove();

                // 3. Replace body
                document.body.innerHTML = '';
                document.body.className = doc.body.className || '';

                var sceneAttr = doc.body.getAttribute('data-mascot-scene');
                if (sceneAttr) document.body.setAttribute('data-mascot-scene', sceneAttr);
                else document.body.removeAttribute('data-mascot-scene');

                // Move non-script children from parsed doc
                var children = [];
                for (var k = 0; k < doc.body.childNodes.length; k++) {
                    var node = doc.body.childNodes[k];
                    if (node.nodeType === 1 && node.tagName === 'SCRIPT') continue;
                    if (node.nodeType === 1 && node.id === 'mc-root') continue;
                    children.push(node);
                }
                children.forEach(function (n) {
                    document.body.appendChild(document.adoptNode(n));
                });

                // Re-append mascot layer
                if (mcCss) document.head.appendChild(mcCss);
                if (mcRoot) document.body.appendChild(mcRoot);

                // 4. Title
                document.title = doc.title || 'QuickShare';

                // 5. Mascot scene
                var scene = SPA_PAGES[targetFile] || 'default';
                if (typeof setMascotScene === 'function') setMascotScene(scene);

                // 6. Load scripts sequentially
                var scripts = doc.querySelectorAll('body script');
                var chain = Promise.resolve();

                for (var s = 0; s < scripts.length; s++) {
                    (function (script) {
                        var src = script.getAttribute('src');

                        // Always skip mascots.js and spa-router.js
                        if (src && (src.indexOf('mascots.js') >= 0 || src.indexOf('spa-router.js') >= 0)) return;

                        if (src) {
                            chain = chain.then(function () { return loadScript(src); });
                        } else if (script.textContent.trim()) {
                            chain = chain.then(function () { execInline(script.textContent); });
                        }
                    })(scripts[s]);
                }

                chain.then(function () {
                    // 7. Re-init theme and language for new DOM
                    if (typeof initTheme === 'function') {
                        try { initTheme(); } catch (e) {}
                    }
                    if (typeof setLanguage === 'function') {
                        try {
                            var lang = typeof getCurrentLanguage === 'function'
                                ? getCurrentLanguage()
                                : (localStorage.getItem('quickshare-lang') || 'zh');
                            setLanguage(lang);
                        } catch (e) {}
                    }

                    // 8. Re-hook mascot scene hooks (upload area etc.)
                    if (typeof window._mascotSceneHooksFn === 'function') {
                        try { window._mascotSceneHooksFn(); } catch (e) {}
                    }

                    // 8.5 Re-init page-specific runtime for already-loaded scripts
                    if (typeof window.__spaAfterNavigate === 'function') {
                        try { window.__spaAfterNavigate(targetFile); } catch (e) {}
                    }

                    // 9. Fade out curtain
                    requestAnimationFrame(function () {
                        updateCurtainBg();
                        c.style.opacity = '0';
                        c.style.pointerEvents = 'none';

                        setTimeout(function () {
                            if (mcRoot) mcRoot.style.zIndex = '';
                            currentFile = targetFile;
                            currentUrl = targetUrl;
                            busy = false;
                            if (queuedTransition) {
                                var queued = queuedTransition;
                                queuedTransition = null;
                                transition(queued.target, queued.options);
                            }
                        }, 220);
                    });
                });

                // 10. Update history only for direct navigations, not browser back/forward
                if (!options.fromHistory) {
                    history.pushState({ spa: targetFile, spaUrl: targetUrl }, doc.title, targetUrl);
                }

            }, 200); // wait for curtain fade-in
        }).catch(function (err) {
            console.error('[SPA] Navigation failed:', err);
            c.style.opacity = '0';
            c.style.pointerEvents = 'none';
            if (mcRoot) mcRoot.style.zIndex = '';
            busy = false;
            location.href = targetFile;
        });
    }

    /* ── event interception ── */

    // Intercept <a href> clicks
    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) return; // allow modifier-key opens
        if (link.target && link.target !== '_self') return;
        if (link.hasAttribute('download') || link.dataset.noSpa === 'true') return;
        var target = normalizeTarget(href);
        if (target && isSpa(target.file)) {
            e.preventDefault();
            e.stopPropagation();
            transition(target);
        }
    }, true);

    // Back / forward
    window.addEventListener('popstate', function (e) {
        var target = targetFromState(e.state);
        if (target && isSpa(target.file)) {
            transition(target, { fromHistory: true });
        }
    });

    // Expose for programmatic navigation
    window.spaNavigate = function (url) {
        var target = normalizeTarget(url || 'index.html');
        if (target && isSpa(target.file)) { transition(target); return true; }
        return false;
    };

    /* ── init ── */

    recordLoaded();
    history.replaceState({ spa: currentFile, spaUrl: currentUrl }, document.title);

    // Prefetch other mascot pages on idle
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () {
            Object.keys(SPA_PAGES).forEach(function (file) {
                if (file && file !== currentFile) fetchPage(file);
            });
        });
    }
})();
