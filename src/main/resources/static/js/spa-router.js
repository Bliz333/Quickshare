/**
 * spa-router.js - Seamless PJAX navigation between mascot pages
 *
 * Intercepts <a> clicks between index/login/register/share pages.
 * Fetches target page, swaps body content while preserving the mascot layer.
 * Mascots smoothly transition between scenes via spring physics.
 */
'use strict';
(function () {
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
    var curtain = null;
    var currentFile = getFile(location.href);

    /* ── helpers ── */

    function getFile(url) {
        try {
            var p = new URL(url, location.href).pathname;
            return (p.split('/').pop() || 'index.html').toLowerCase();
        } catch (e) { return ''; }
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

    function transition(targetFile) {
        if (busy || targetFile === currentFile) return;
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

            setTimeout(function () {
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
                    if (typeof applyLanguage === 'function') {
                        try { applyLanguage(); } catch (e) {}
                    }

                    // 8. Re-hook mascot scene hooks (upload area etc.)
                    if (typeof window._mascotSceneHooksFn === 'function') {
                        try { window._mascotSceneHooksFn(); } catch (e) {}
                    }

                    // 9. Fade out curtain
                    requestAnimationFrame(function () {
                        updateCurtainBg();
                        c.style.opacity = '0';
                        c.style.pointerEvents = 'none';

                        setTimeout(function () {
                            if (mcRoot) mcRoot.style.zIndex = '';
                            currentFile = targetFile;
                            busy = false;
                        }, 220);
                    });
                });

                // 10. Push to history
                history.pushState({ spa: targetFile }, doc.title, targetFile);

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
        var file = getFile(href);
        if (file && isSpa(file)) {
            e.preventDefault();
            e.stopPropagation();
            transition(file);
        }
    }, true);

    // Back / forward
    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.spa) {
            transition(e.state.spa);
        }
    });

    // Expose for programmatic navigation
    window.spaNavigate = function (file) {
        file = (file || '').split('/').pop().toLowerCase();
        if (isSpa(file)) { transition(file); return true; }
        return false;
    };

    /* ── init ── */

    recordLoaded();
    history.replaceState({ spa: currentFile }, document.title);

    // Prefetch other mascot pages on idle
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () {
            Object.keys(SPA_PAGES).forEach(function (file) {
                if (file && file !== currentFile) fetchPage(file);
            });
        });
    }
})();
