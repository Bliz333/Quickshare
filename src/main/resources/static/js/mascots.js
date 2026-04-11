/**
 * mascots.js — Interactive mascot characters with rich form reactions
 *
 * Modes: idle | username | password | toggle-pw | cheer
 *
 * idle     — each character does its own idle loop (bob, sway, breathe)
 * username — purple+yellow lean forward curiously, all eyes watch input
 * password — all look away shyly, black turns head most
 * toggle-pw— black quickly covers/turns away, recovers slowly
 * cheer    — all bounce/celebrate together for 1.5s
 */

'use strict';

(function () {

    var mX = 0, mY = 0, t = 0;
    var chars = [];
    var mode = 'idle';
    var modeT = 0;               // timestamp when mode changed
    var cheerTimer = null;

    /* ═══════════════════════════════════════════════════════════════
       Character definitions
    ═══════════════════════════════════════════════════════════════ */

    var DEFS = [
        {
            id: 'orange', label: 'Orange dome',
            css: 'left:-10px;bottom:-10px;width:280px;z-index:52;',
            vb: '0 0 280 200',
            body: '<ellipse cx="140" cy="190" rx="140" ry="140" fill="var(--mc-orange,#fb923c)"/>',
            eyeL: { cx: 100, cy: 118, er: 9, pr: 4 },
            eyeR: { cx: 172, cy: 118, er: 9, pr: 4 },
            mouth: '',
            blinkBase: 2200,
            // Idle: bouncy squish
            idle: function (t) {
                var b = Math.sin(t * 0.8);
                return { ty: Math.abs(b) * -8, sx: 1 + b * 0.018, sy: 1 - b * 0.018, tx: 0, rot: 0 };
            }
        },
        {
            id: 'purple', label: 'Purple block',
            css: 'left:80px;bottom:40px;width:160px;z-index:51;',
            vb: '0 0 160 320',
            body: '<rect x="0" y="0" width="160" height="320" rx="40" fill="var(--mc-purple,#818cf8)"/>',
            eyeL: { cx: 55, cy: 110, er: 8, pr: 3.5 },
            eyeR: { cx: 105, cy: 110, er: 8, pr: 3.5 },
            mouth: '',
            blinkBase: 3000,
            idle: function (t) {
                return { ty: Math.sin(t * 0.65) * 6, sx: 1 + Math.sin(t * 0.8) * 0.012, sy: 1 - Math.sin(t * 0.8) * 0.012, tx: 0, rot: 0 };
            }
        },
        {
            id: 'yellow', label: 'Yellow capsule',
            css: 'right:10px;bottom:-5px;width:150px;z-index:52;',
            vb: '0 0 150 250',
            body: '<rect x="10" y="10" width="130" height="230" rx="65" fill="var(--mc-yellow,#fbbf24)"/>',
            eyeL: { cx: 50, cy: 95, er: 7.5, pr: 3.2 },
            eyeR: { cx: 100, cy: 95, er: 7.5, pr: 3.2 },
            mouth: '<line x1="55" y1="125" x2="95" y2="125" stroke="var(--mc-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>',
            blinkBase: 1800,
            idle: function (t) {
                return { ty: Math.sin(t * 0.7) * 5, tx: Math.sin(t * 0.55) * 3, rot: Math.sin(t * 0.45) * 3, sx: 1, sy: 1 };
            }
        },
        {
            id: 'black', label: 'Black block',
            css: 'right:60px;bottom:30px;width:120px;z-index:51;',
            vb: '0 0 120 280',
            body: '<rect x="0" y="0" width="120" height="280" rx="36" fill="var(--mc-black,#1f2937)"/>',
            eyeL: { cx: 40, cy: 96, er: 7, pr: 3 },
            eyeR: { cx: 80, cy: 96, er: 7, pr: 3 },
            mouth: '',
            blinkBase: 3500,
            idle: function (t) {
                return { tx: Math.sin(t * 0.5) * 4, rot: Math.sin(t * 0.35) * 2.5, ty: 0, sx: 1, sy: 1 };
            }
        }
    ];

    /* ═══════════════════════════════════════════════════════════════
       Build SVG
    ═══════════════════════════════════════════════════════════════ */

    function buildSvg(d) {
        var eL = d.eyeL, eR = d.eyeR;
        return [
            '<svg viewBox="' + d.vb + '" class="mc-svg" preserveAspectRatio="xMidYMax meet" style="overflow:visible">',
            '<g class="mc-body-g">', d.body, '</g>',
            '<g class="mc-eye mc-eye-l" data-cx="'+eL.cx+'" data-cy="'+eL.cy+'" data-er="'+eL.er+'" data-pr="'+eL.pr+'">',
            '<circle cx="'+eL.cx+'" cy="'+eL.cy+'" r="'+eL.er+'" fill="white"/>',
            '<circle class="mc-pupil" cx="'+eL.cx+'" cy="'+eL.cy+'" r="'+eL.pr+'" fill="var(--mc-face,#1e293b)"/>',
            '</g>',
            '<g class="mc-eye mc-eye-r" data-cx="'+eR.cx+'" data-cy="'+eR.cy+'" data-er="'+eR.er+'" data-pr="'+eR.pr+'">',
            '<circle cx="'+eR.cx+'" cy="'+eR.cy+'" r="'+eR.er+'" fill="white"/>',
            '<circle class="mc-pupil" cx="'+eR.cx+'" cy="'+eR.cy+'" r="'+eR.pr+'" fill="var(--mc-face,#1e293b)"/>',
            '</g>',
            d.mouth || '',
            '</svg>'
        ].join('');
    }

    /* ═══════════════════════════════════════════════════════════════
       Create
    ═══════════════════════════════════════════════════════════════ */

    function create(d) {
        var el = document.createElement('div');
        el.className = 'mc mc-' + d.id;
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = d.css;
        el.innerHTML = buildSvg(d);

        var eyes = [];
        var gs = el.querySelectorAll('.mc-eye');
        for (var i = 0; i < gs.length; i++) {
            var g = gs[i];
            eyes.push({ g: g, pupil: g.querySelector('.mc-pupil'),
                cx: +g.dataset.cx, cy: +g.dataset.cy, er: +g.dataset.er, pr: +g.dataset.pr,
                // Smooth pupil position
                px: +g.dataset.cx, py: +g.dataset.cy
            });
        }

        return {
            el: el, d: d, eyes: eyes,
            svg: el.querySelector('.mc-svg'),
            bodyG: el.querySelector('.mc-body-g'),
            // Smooth state
            rot: 0, tx: 0, ty: 0, extraRot: 0, extraTx: 0, extraTy: 0
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       Interaction state: compute target eye position & body offset
    ═══════════════════════════════════════════════════════════════ */

    function getInteractionState(c) {
        // Returns target overrides: { gazeX, gazeY, bodyTx, bodyTy, bodyRot, eyeScale }
        // gazeX/gazeY: -1..1 normalized direction for pupils (null = follow mouse)
        var elapsed = (t - modeT);
        var id = c.d.id;

        if (mode === 'username') {
            // Purple + yellow lean forward curiously, eyes look at input area (center-right)
            var curious = (id === 'purple' || id === 'yellow');
            return {
                gazeX: 0.6, gazeY: 0.4,   // look toward form area
                bodyTx: curious ? 12 : 5,
                bodyTy: curious ? -4 : -1,
                bodyRot: curious ? (id === 'purple' ? 4 : -3) : 1,
                eyeScale: curious ? 1.12 : 1.05
            };
        }

        if (mode === 'password') {
            // All look away shyly — black most dramatically
            var shyFactor = id === 'black' ? 1.0 : (id === 'purple' ? 0.6 : 0.4);
            var dir = (c.el.getBoundingClientRect().left < window.innerWidth / 2) ? -1 : 1;
            return {
                gazeX: dir * shyFactor,
                gazeY: -0.3 * shyFactor,
                bodyTx: dir * 8 * shyFactor,
                bodyTy: 0,
                bodyRot: dir * 6 * shyFactor,
                eyeScale: 0.9
            };
        }

        if (mode === 'toggle-pw') {
            // Black dramatically turns away, others mild
            if (id === 'black') {
                var dir2 = (c.el.getBoundingClientRect().left < window.innerWidth / 2) ? -1 : 1;
                return { gazeX: null, gazeY: null, bodyTx: dir2 * 18, bodyTy: -6, bodyRot: dir2 * 15, eyeScale: 0.05 };
            }
            return { gazeX: null, gazeY: null, bodyTx: 0, bodyTy: 0, bodyRot: 0, eyeScale: 0.7 };
        }

        if (mode === 'cheer') {
            // Each character has unique celebration
            var cheerPhase = Math.min(elapsed / 1.5, 1); // 0..1 over 1.5s
            var bounce = Math.sin(elapsed * 8) * (1 - cheerPhase) * 12;
            if (id === 'orange') return { gazeX: 0, gazeY: -0.5, bodyTx: 0, bodyTy: -16 * (1-cheerPhase) + bounce, bodyRot: 0, eyeScale: 1.25 * (1-cheerPhase*0.2) };
            if (id === 'purple') return { gazeX: 0.3, gazeY: -0.3, bodyTx: bounce * 0.5, bodyTy: bounce * 0.7, bodyRot: Math.sin(elapsed * 6) * 5 * (1-cheerPhase), eyeScale: 1.15 };
            if (id === 'yellow') return { gazeX: -0.2, gazeY: -0.4, bodyTx: 0, bodyTy: bounce * 0.8, bodyRot: Math.sin(elapsed * 7) * 4 * (1-cheerPhase), eyeScale: 1.3 * (1-cheerPhase*0.2) };
            if (id === 'black') return { gazeX: 0, gazeY: -0.2, bodyTx: Math.sin(elapsed * 5) * 6 * (1-cheerPhase), bodyTy: bounce * 0.5, bodyRot: Math.sin(elapsed * 4) * 3 * (1-cheerPhase), eyeScale: 1.1 };
        }

        // idle — no override
        return null;
    }

    /* ═══════════════════════════════════════════════════════════════
       Per-frame update
    ═══════════════════════════════════════════════════════════════ */

    function tick() {
        t = performance.now() / 1000;

        for (var i = 0; i < chars.length; i++) {
            var c = chars[i];
            var rect = c.el.getBoundingClientRect();
            if (!rect.width) continue;

            var vb = c.d.vb.split(' ');
            var vbW = +vb[2];
            var sx = rect.width / vbW;

            // ── Idle animation ──
            var idle = c.d.idle(t);

            // ── Interaction override ──
            var inter = getInteractionState(c);
            var targetETx = 0, targetETy = 0, targetERot = 0;
            var eyeScale = 1;

            if (inter) {
                targetETx = inter.bodyTx || 0;
                targetETy = inter.bodyTy || 0;
                targetERot = inter.bodyRot || 0;
                eyeScale = inter.eyeScale || 1;
            }

            // Smooth easing toward targets
            c.extraTx += (targetETx - c.extraTx) * 0.06;
            c.extraTy += (targetETy - c.extraTy) * 0.06;
            c.extraRot += (targetERot - c.extraRot) * 0.06;

            // Mouse lean (subtle, additive)
            var cx0 = rect.left + rect.width / 2;
            var cy0 = rect.top + rect.height / 2;
            var dx = mX - cx0, dy = mY - cy0;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var mLeanRot = (dx / dist) * Math.min(dist * 0.003, 2);
            var mLeanTx = (dx / dist) * Math.min(dist * 0.005, 3);
            c.rot += (mLeanRot - c.rot) * 0.03;
            c.tx += (mLeanTx - c.tx) * 0.03;

            // Compose SVG transform
            var finalTx = (idle.tx || 0) + c.tx + c.extraTx;
            var finalTy = (idle.ty || 0) + c.extraTy;
            var finalRot = (idle.rot || 0) + c.rot + c.extraRot;

            c.svg.style.transform =
                'translate(' + finalTx.toFixed(1) + 'px,' + finalTy.toFixed(1) + 'px)' +
                ' rotate(' + finalRot.toFixed(2) + 'deg)';

            // Body squish
            if (c.bodyG) {
                c.bodyG.style.transformOrigin = '50% 100%';
                c.bodyG.style.transform = 'scaleX(' + (idle.sx || 1).toFixed(4) + ') scaleY(' + (idle.sy || 1).toFixed(4) + ')';
            }

            // ── Eye tracking ──
            for (var j = 0; j < c.eyes.length; j++) {
                var e = c.eyes[j];

                // Eye scale (for curious/shy)
                e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                var curScale = e._scale || 1;
                curScale += (eyeScale - curScale) * 0.08;
                e._scale = curScale;
                if (mode !== 'toggle-pw' || c.d.id !== 'black') {
                    e.g.style.transition = '';
                    e.g.style.transform = 'scale(' + curScale.toFixed(3) + ')';
                }

                // Pupil target
                var targetPx, targetPy;
                if (inter && inter.gazeX !== null && inter.gazeX !== undefined) {
                    // Forced gaze direction
                    var maxM = e.er - e.pr - 1;
                    targetPx = e.cx + inter.gazeX * maxM;
                    targetPy = e.cy + (inter.gazeY || 0) * maxM;
                } else if (mode !== 'toggle-pw') {
                    // Mouse tracking
                    var ex = rect.left + e.cx * sx;
                    var ey = rect.top + e.cy * sx;
                    var edx = mX - ex, edy = mY - ey;
                    var ed = Math.sqrt(edx * edx + edy * edy) || 1;
                    var maxM2 = e.er - e.pr - 1;
                    var mv = Math.min(ed * 0.018, maxM2);
                    targetPx = e.cx + (edx / ed) * mv;
                    targetPy = e.cy + (edy / ed) * mv;
                } else {
                    targetPx = e.cx;
                    targetPy = e.cy;
                }

                // Smooth pupil movement
                e.px += (targetPx - e.px) * 0.1;
                e.py += (targetPy - e.py) * 0.1;
                e.pupil.setAttribute('cx', e.px.toFixed(1));
                e.pupil.setAttribute('cy', e.py.toFixed(1));
            }
        }

        requestAnimationFrame(tick);
    }

    /* ═══════════════════════════════════════════════════════════════
       Blinking
    ═══════════════════════════════════════════════════════════════ */

    function startBlink(c) {
        var base = c.d.blinkBase;
        function blink() {
            if (mode === 'toggle-pw' && c.d.id === 'black') { c._bt = setTimeout(blink, 2000); return; }
            c.eyes.forEach(function (e) {
                e.g.style.transition = 'transform .06s ease-in';
                e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                e.g.style.transform = 'scaleY(0.04)';
            });
            setTimeout(function () {
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .08s ease-out';
                    e.g.style.transform = 'scaleY(' + (e._scale || 1).toFixed(3) + ')';
                });
            }, 70);
            // Yellow: occasional double-blink
            if (c.d.id === 'yellow' && Math.random() < 0.35) {
                setTimeout(function () {
                    c.eyes.forEach(function (e) {
                        e.g.style.transition = 'transform .04s ease-in';
                        e.g.style.transform = 'scaleY(0.04)';
                    });
                    setTimeout(function () {
                        c.eyes.forEach(function (e) {
                            e.g.style.transition = 'transform .06s ease-out';
                            e.g.style.transform = 'scaleY(' + (e._scale || 1).toFixed(3) + ')';
                        });
                    }, 45);
                }, 160);
            }
            c._bt = setTimeout(blink, base + Math.random() * base * 0.5);
        }
        c._bt = setTimeout(blink, 400 + Math.random() * base);
    }

    /* ═══════════════════════════════════════════════════════════════
       Random micro-behaviors (idle only)
    ═══════════════════════════════════════════════════════════════ */

    function startRandom() {
        function act() {
            if (mode !== 'idle' || !chars.length) { setTimeout(act, 3000); return; }
            var c = chars[Math.floor(Math.random() * chars.length)];
            var r = Math.random();
            if (r < 0.3) {
                // Surprise wide eyes
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .15s cubic-bezier(.34,1.4,.64,1)';
                    e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                    e.g.style.transform = 'scale(1.2)';
                });
                setTimeout(function () { c.eyes.forEach(function (e) { e.g.style.transition = 'transform .35s ease'; e.g.style.transform = 'scale(1)'; }); }, 700);
            } else if (r < 0.6) {
                // Quick bounce via CSS
                c.el.style.transition = 'transform .18s cubic-bezier(.4,0,.2,1)';
                c.el.style.transform = 'translateY(-14px)';
                setTimeout(function () { c.el.style.transition = 'transform .35s ease'; c.el.style.transform = ''; }, 180);
            } else {
                // Head tilt
                var a = (Math.random() - 0.5) * 8;
                c.el.style.transition = 'transform .5s ease'; c.el.style.transform = 'rotate(' + a + 'deg)';
                setTimeout(function () { c.el.style.transition = 'transform .6s ease'; c.el.style.transform = ''; }, 800);
            }
            setTimeout(act, 4000 + Math.random() * 4000);
        }
        setTimeout(act, 3000);
    }

    /* ═══════════════════════════════════════════════════════════════
       Mode transitions
    ═══════════════════════════════════════════════════════════════ */

    function setMode(m) {
        if (mode === m) return;
        mode = m;
        modeT = performance.now() / 1000;

        // toggle-pw: black dramatically closes eyes
        if (m === 'toggle-pw') {
            var black = chars.find(function (c) { return c.d.id === 'black'; });
            if (black) {
                black.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .12s ease-in';
                    e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                    e.g.style.transform = 'scaleY(0.04)';
                });
                // Recover slowly after 0.8s
                setTimeout(function () {
                    if (mode === 'idle' || mode === 'toggle-pw') {
                        black.eyes.forEach(function (e) {
                            e.g.style.transition = 'transform .5s ease-out';
                            e.g.style.transform = 'scaleY(1)';
                        });
                        if (mode === 'toggle-pw') setMode('idle');
                    }
                }, 800);
            }
        }

        // cheer: auto-return to idle after 1.5s
        if (m === 'cheer') {
            if (cheerTimer) clearTimeout(cheerTimer);
            cheerTimer = setTimeout(function () { setMode('idle'); }, 1500);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       Form hooks — detect username, password, toggle, submit
    ═══════════════════════════════════════════════════════════════ */

    function hookForms() {
        // Password fields
        document.querySelectorAll('input[type="password"]').forEach(function (f) {
            f.addEventListener('focus', function () { setMode('password'); });
            f.addEventListener('blur', function () { if (mode === 'password') setMode('idle'); });
        });

        // Text/email fields (username)
        document.querySelectorAll('input[type="text"], input[type="email"]').forEach(function (f) {
            // Skip pair code inputs
            if (f.id === 'homePairCodeInput') return;
            f.addEventListener('focus', function () { setMode('username'); });
            f.addEventListener('blur', function () { if (mode === 'username') setMode('idle'); });
        });

        // Password toggle buttons (eye icon)
        document.querySelectorAll('[onclick*="togglePassword"], .toggle-password, .password-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () { setMode('toggle-pw'); });
        });

        // Submit buttons
        document.querySelectorAll('button[type="submit"], .btn[onclick*="login"], .btn[onclick*="Login"], #loginBtn').forEach(function (btn) {
            btn.addEventListener('click', function () { setMode('cheer'); });
        });

        // Also hook form submit event
        document.querySelectorAll('form').forEach(function (f) {
            f.addEventListener('submit', function () { setMode('cheer'); });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       Background: grid + wave parallax
    ═══════════════════════════════════════════════════════════════ */

    function createBg() {
        if (document.querySelector('.mc-backdrop')) return;
        var bg = document.createElement('div');
        bg.className = 'mc-backdrop';
        bg.setAttribute('aria-hidden', 'true');
        bg.innerHTML = '<div class="mc-grid"></div><div class="mc-wave"></div>';
        document.body.appendChild(bg);
    }

    /* ═══════════════════════════════════════════════════════════════
       CSS
    ═══════════════════════════════════════════════════════════════ */

    function injectCSS() {
        if (document.getElementById('mc-css')) return;
        var s = document.createElement('style');
        s.id = 'mc-css';
        s.textContent = [
            '.mc{position:fixed;z-index:49;pointer-events:none;will-change:transform}',
            '.mc-svg{display:block;width:100%;height:auto}',
            '.mc-body-g{transform-origin:50% 100%}',
            '.mc-backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
            '.mc-grid{position:absolute;inset:-20%;width:140%;height:140%;' +
            'background-image:linear-gradient(rgba(59,130,246,.035) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(59,130,246,.035) 1px,transparent 1px);' +
            'background-size:48px 48px;animation:mc-gdrift 60s linear infinite}',
            '.dark-mode .mc-grid{background-image:linear-gradient(rgba(129,140,248,.05) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(129,140,248,.05) 1px,transparent 1px)}',
            '@keyframes mc-gdrift{to{transform:translate(48px,48px)}}',
            '.mc-wave{position:absolute;inset:-10%;width:120%;height:120%;opacity:.02;' +
            'background:repeating-linear-gradient(135deg,transparent,transparent 30px,rgba(59,130,246,.3) 30px,rgba(59,130,246,.3) 31px);' +
            'animation:mc-wdrift 80s linear infinite}',
            '.dark-mode .mc-wave{opacity:.025}',
            '@keyframes mc-wdrift{to{transform:translate(-60px,60px)}}',
            ':root{--mc-orange:#fb923c;--mc-purple:#818cf8;--mc-yellow:#fbbf24;--mc-black:#1f2937;--mc-face:#1e293b}',
            '.dark-mode{--mc-orange:#f97316;--mc-purple:#6366f1;--mc-yellow:#f59e0b;--mc-black:#e5e7eb;--mc-face:#1e293b}',
            '@media(max-width:1200px){.mc{transform:scale(.55)!important;transform-origin:bottom}}',
            '@media(max-width:800px){.mc{transform:scale(.4)!important}}',
            '@media(max-width:600px){.mc,.mc-backdrop{display:none!important}}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ═══════════════════════════════════════════════════════════════
       Public
    ═══════════════════════════════════════════════════════════════ */

    window.initMascots = function () {
        injectCSS();
        createBg();

        DEFS.forEach(function (d) {
            var c = create(d);
            document.body.appendChild(c.el);
            chars.push(c);
            startBlink(c);
        });

        document.addEventListener('mousemove', function (e) { mX = e.clientX; mY = e.clientY; });
        tick();
        startRandom();
        hookForms();
    };

    window.setMascotMode = setMode;
})();
