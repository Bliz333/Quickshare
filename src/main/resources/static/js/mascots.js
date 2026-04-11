/**
 * mascots.js — Premium idle-animated mascot characters
 *
 * 4 characters with distinct personalities and seamless idle loops:
 *   Purple block — gentle bobbing + breathing squish (10s loop)
 *   Black block  — subtle swaying + head tilt (12s loop)
 *   Orange dome  — bouncy squish-stretch (8s loop)
 *   Yellow pill  — playful wobble + float (9s loop)
 *
 * Plus: eye tracking, password paw-cover, random micro-behaviors,
 *       deep blue grid background with slow parallax drift.
 */

'use strict';

(function () {

    var mX = 0, mY = 0, t = 0;
    var chars = [];
    var mode = 'idle';

    /* ═══════════════════════════════════════════════════════════════
       Character definitions
    ═══════════════════════════════════════════════════════════════ */

    var DEFS = [
        {
            id: 'orange',
            // Orange dome — the big friendly one, front-left
            css: 'left:-10px;bottom:-10px;width:280px;z-index:52;',
            vb: '0 0 280 200',
            body: '<ellipse cx="140" cy="190" rx="140" ry="140" fill="var(--mc-orange,#fb923c)"/>',
            eyeL: { cx: 100, cy: 118, er: 9, pr: 4 },
            eyeR: { cx: 172, cy: 118, er: 9, pr: 4 },
            mouth: '',
            // Animation personality
            anim: 'orange', blinkEvery: 2200
        },
        {
            id: 'purple',
            // Purple tall block — behind orange, left
            css: 'left:80px;bottom:40px;width:160px;z-index:51;',
            vb: '0 0 160 320',
            body: '<rect x="0" y="0" width="160" height="320" rx="40" fill="var(--mc-purple,#818cf8)"/>',
            eyeL: { cx: 55, cy: 110, er: 8, pr: 3.5 },
            eyeR: { cx: 105, cy: 110, er: 8, pr: 3.5 },
            mouth: '',
            anim: 'purple', blinkEvery: 3000
        },
        {
            id: 'yellow',
            // Yellow capsule — front-right
            css: 'right:10px;bottom:-5px;width:150px;z-index:52;',
            vb: '0 0 150 250',
            body: '<rect x="10" y="10" width="130" height="230" rx="65" fill="var(--mc-yellow,#fbbf24)"/>',
            eyeL: { cx: 50, cy: 95, er: 7.5, pr: 3.2 },
            eyeR: { cx: 100, cy: 95, er: 7.5, pr: 3.2 },
            mouth: '<line x1="55" y1="125" x2="95" y2="125" stroke="var(--mc-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>',
            anim: 'yellow', blinkEvery: 1800
        },
        {
            id: 'black',
            // Black tall block — behind yellow, right
            css: 'right:60px;bottom:30px;width:120px;z-index:51;',
            vb: '0 0 120 280',
            body: '<rect x="0" y="0" width="120" height="280" rx="36" fill="var(--mc-black,#1f2937)"/>',
            eyeL: { cx: 40, cy: 96, er: 7, pr: 3 },
            eyeR: { cx: 80, cy: 96, er: 7, pr: 3 },
            mouth: '',
            anim: 'black', blinkEvery: 3500
        }
    ];

    /* ═══════════════════════════════════════════════════════════════
       Build SVG
    ═══════════════════════════════════════════════════════════════ */

    function buildSvg(d) {
        var eL = d.eyeL, eR = d.eyeR;
        return [
            '<svg viewBox="' + d.vb + '" class="mc-svg" preserveAspectRatio="xMidYMax meet" style="overflow:visible">',
            // Body group — for breathing/squish transforms
            '<g class="mc-body-g">',
            d.body,
            '</g>',
            // Eyes
            '<g class="mc-eye mc-eye-l" data-cx="' + eL.cx + '" data-cy="' + eL.cy + '" data-er="' + eL.er + '" data-pr="' + eL.pr + '">',
            '<circle cx="' + eL.cx + '" cy="' + eL.cy + '" r="' + eL.er + '" fill="white"/>',
            '<circle class="mc-pupil" cx="' + eL.cx + '" cy="' + eL.cy + '" r="' + eL.pr + '" fill="var(--mc-face,#1e293b)"/>',
            '</g>',
            '<g class="mc-eye mc-eye-r" data-cx="' + eR.cx + '" data-cy="' + eR.cy + '" data-er="' + eR.er + '" data-pr="' + eR.pr + '">',
            '<circle cx="' + eR.cx + '" cy="' + eR.cy + '" r="' + eR.er + '" fill="white"/>',
            '<circle class="mc-pupil" cx="' + eR.cx + '" cy="' + eR.cy + '" r="' + eR.pr + '" fill="var(--mc-face,#1e293b)"/>',
            '</g>',
            d.mouth || '',
            // Paws for password cover
            '<g class="mc-paws" style="opacity:0">',
            '<ellipse class="mc-paw-l" cx="' + (eL.cx - eL.er * 3) + '" cy="' + eL.cy + '" rx="' + (eL.er * 2) + '" ry="' + (eL.er * 1.4) + '" fill="var(--mc-paw)"/>',
            '<ellipse class="mc-paw-r" cx="' + (eR.cx + eR.er * 3) + '" cy="' + eR.cy + '" rx="' + (eR.er * 2) + '" ry="' + (eR.er * 1.4) + '" fill="var(--mc-paw)"/>',
            '</g>',
            '</svg>'
        ].join('');
    }

    /* ═══════════════════════════════════════════════════════════════
       Create instance
    ═══════════════════════════════════════════════════════════════ */

    function create(d) {
        var el = document.createElement('div');
        el.className = 'mc mc-' + d.id;
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = d.css;
        el.innerHTML = buildSvg(d);

        var eyes = [];
        var eGroups = el.querySelectorAll('.mc-eye');
        for (var i = 0; i < eGroups.length; i++) {
            var g = eGroups[i];
            eyes.push({
                g: g, pupil: g.querySelector('.mc-pupil'),
                cx: +g.dataset.cx, cy: +g.dataset.cy,
                er: +g.dataset.er, pr: +g.dataset.pr
            });
        }

        return {
            el: el, d: d, eyes: eyes,
            svg: el.querySelector('.mc-svg'),
            bodyG: el.querySelector('.mc-body-g'),
            paws: el.querySelector('.mc-paws'),
            pawL: el.querySelector('.mc-paw-l'),
            pawR: el.querySelector('.mc-paw-r'),
            rot: 0, tx: 0, ty: 0
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       Per-frame update — idle animation + eye tracking
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
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = mX - cx, dy = mY - cy;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // ── Per-character idle animation ──
            var idleTy = 0, idleTx = 0, idleRot = 0;
            var bodySx = 1, bodySy = 1;

            if (c.d.anim === 'purple') {
                // Gentle bobbing + breathing squish
                idleTy = Math.sin(t * 0.65) * 6;
                bodySx = 1 + Math.sin(t * 0.8) * 0.012;
                bodySy = 1 - Math.sin(t * 0.8) * 0.012;
            } else if (c.d.anim === 'black') {
                // Subtle swaying + occasional head tilt
                idleTx = Math.sin(t * 0.5) * 4;
                idleRot = Math.sin(t * 0.35) * 2.5;
            } else if (c.d.anim === 'orange') {
                // Bouncy squish-stretch cycle
                var bounce = Math.sin(t * 0.8);
                idleTy = Math.abs(bounce) * -8;
                bodySx = 1 + bounce * 0.018;
                bodySy = 1 - bounce * 0.018;
            } else if (c.d.anim === 'yellow') {
                // Playful wobble + float
                idleTy = Math.sin(t * 0.7) * 5;
                idleTx = Math.sin(t * 0.55) * 3;
                idleRot = Math.sin(t * 0.45) * 3;
            }

            // ── Mouse lean (additive, subtle) ──
            var tRot = (dx / dist) * Math.min(dist * 0.004, 3);
            var tTx = (dx / dist) * Math.min(dist * 0.006, 4);
            c.rot += (tRot - c.rot) * 0.03;
            c.tx += (tTx - c.tx) * 0.03;

            // Compose transforms
            c.svg.style.transform =
                'translate(' + (idleTx + c.tx).toFixed(1) + 'px,' + idleTy.toFixed(1) + 'px)' +
                ' rotate(' + (idleRot + c.rot).toFixed(2) + 'deg)';

            // Body breathing squish
            if (c.bodyG && (bodySx !== 1 || bodySy !== 1)) {
                var originY = c.d.id === 'orange' ? '100%' : '100%';
                c.bodyG.style.transformOrigin = '50% ' + originY;
                c.bodyG.style.transform = 'scaleX(' + bodySx.toFixed(4) + ') scaleY(' + bodySy.toFixed(4) + ')';
            }

            // ── Eye tracking ──
            if (mode !== 'password') {
                for (var j = 0; j < c.eyes.length; j++) {
                    var e = c.eyes[j];
                    var ex = rect.left + e.cx * sx;
                    var ey = rect.top + e.cy * sx;
                    var edx = mX - ex, edy = mY - ey;
                    var ed = Math.sqrt(edx * edx + edy * edy) || 1;
                    var maxM = e.er - e.pr - 1;
                    var mv = Math.min(ed * 0.018, maxM);
                    e.pupil.setAttribute('cx', (e.cx + (edx / ed) * mv).toFixed(1));
                    e.pupil.setAttribute('cy', (e.cy + (edy / ed) * mv).toFixed(1));
                }
            }
        }

        requestAnimationFrame(tick);
    }

    /* ═══════════════════════════════════════════════════════════════
       Blinking — per-character interval from config
    ═══════════════════════════════════════════════════════════════ */

    function startBlink(c) {
        var base = c.d.blinkEvery || 3000;

        function blink() {
            if (mode === 'password') { c._bt = setTimeout(blink, 2000); return; }

            // Close
            c.eyes.forEach(function (e) {
                e.g.style.transition = 'transform .06s ease-in';
                e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                e.g.style.transform = 'scaleY(0.04)';
            });
            // Open
            setTimeout(function () {
                if (mode === 'password') return;
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .08s ease-out';
                    e.g.style.transform = 'scaleY(1)';
                });
            }, 75);

            // Yellow character: occasional playful double-blink
            if (c.d.id === 'yellow' && Math.random() < 0.35) {
                setTimeout(function () {
                    if (mode === 'password') return;
                    c.eyes.forEach(function (e) {
                        e.g.style.transition = 'transform .04s ease-in';
                        e.g.style.transform = 'scaleY(0.04)';
                    });
                    setTimeout(function () {
                        c.eyes.forEach(function (e) {
                            e.g.style.transition = 'transform .06s ease-out';
                            e.g.style.transform = 'scaleY(1)';
                        });
                    }, 50);
                }, 180);
            }

            c._bt = setTimeout(blink, base + Math.random() * base * 0.6);
        }

        c._bt = setTimeout(blink, 500 + Math.random() * base);
    }

    /* ═══════════════════════════════════════════════════════════════
       Random micro-behaviors (every 4-8s)
    ═══════════════════════════════════════════════════════════════ */

    function startRandomBehaviors() {
        function act() {
            if (!chars.length) return;
            var c = chars[Math.floor(Math.random() * chars.length)];
            var r = Math.random();

            if (r < 0.4) {
                // Surprised wide eyes
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .15s cubic-bezier(.34,1.4,.64,1)';
                    e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                    e.g.style.transform = 'scale(1.2)';
                });
                setTimeout(function () {
                    c.eyes.forEach(function (e) {
                        e.g.style.transition = 'transform .35s ease';
                        e.g.style.transform = 'scale(1)';
                    });
                }, 700);
            } else if (r < 0.7) {
                // Quick bounce
                c.el.style.transition = 'transform .18s cubic-bezier(.4,0,.2,1)';
                c.el.style.transform = 'translateY(-16px)';
                setTimeout(function () {
                    c.el.style.transition = 'transform .35s cubic-bezier(.4,0,.2,1)';
                    c.el.style.transform = '';
                }, 180);
            } else {
                // Head tilt
                var angle = (Math.random() - 0.5) * 8;
                c.el.style.transition = 'transform .5s cubic-bezier(.4,0,.2,1)';
                c.el.style.transform = 'rotate(' + angle + 'deg)';
                setTimeout(function () {
                    c.el.style.transition = 'transform .6s cubic-bezier(.4,0,.2,1)';
                    c.el.style.transform = '';
                }, 900);
            }

            setTimeout(act, 4000 + Math.random() * 4000);
        }
        setTimeout(act, 3000);
    }

    /* ═══════════════════════════════════════════════════════════════
       Password mode — paws cover eyes
    ═══════════════════════════════════════════════════════════════ */

    function setMode(m) {
        if (mode === m) return;
        mode = m;
        chars.forEach(function (c) {
            if (m === 'password') {
                if (c.paws) { c.paws.style.transition = 'opacity .2s'; c.paws.style.opacity = '1'; }
                if (c.pawL) { c.pawL.style.transition = 'all .3s cubic-bezier(.34,1.4,.64,1)'; c.pawL.setAttribute('cx', c.eyes[0].cx); c.pawL.setAttribute('cy', c.eyes[0].cy); }
                if (c.pawR) { c.pawR.style.transition = 'all .3s cubic-bezier(.34,1.4,.64,1)'; c.pawR.setAttribute('cx', c.eyes[1].cx); c.pawR.setAttribute('cy', c.eyes[1].cy); }
                c.eyes.forEach(function (e) { e.g.style.transition = 'transform .2s'; e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px'; e.g.style.transform = 'scaleY(0.12)'; });
            } else {
                if (c.paws) { c.paws.style.transition = 'opacity .3s'; c.paws.style.opacity = '0'; }
                if (c.pawL) { c.pawL.style.transition = 'all .3s ease'; c.pawL.setAttribute('cx', c.eyes[0].cx - c.eyes[0].er * 3); c.pawL.setAttribute('cy', c.eyes[0].cy); }
                if (c.pawR) { c.pawR.style.transition = 'all .3s ease'; c.pawR.setAttribute('cx', c.eyes[1].cx + c.eyes[1].er * 3); c.pawR.setAttribute('cy', c.eyes[1].cy); }
                c.eyes.forEach(function (e) { e.g.style.transition = 'transform .2s'; e.g.style.transform = 'scaleY(1)'; });
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       Deep blue grid background with parallax drift
    ═══════════════════════════════════════════════════════════════ */

    function createBackground() {
        var bg = document.createElement('div');
        bg.className = 'mc-backdrop';
        bg.setAttribute('aria-hidden', 'true');
        bg.innerHTML = '<div class="mc-grid"></div><div class="mc-wave"></div>';
        document.body.appendChild(bg);
    }

    /* ═══════════════════════════════════════════════════════════════
       Form hooks
    ═══════════════════════════════════════════════════════════════ */

    function hookForms() {
        document.querySelectorAll('input[type="password"]').forEach(function (f) {
            f.addEventListener('focus', function () { setMode('password'); });
            f.addEventListener('blur', function () { setMode('idle'); });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       CSS injection
    ═══════════════════════════════════════════════════════════════ */

    function injectCSS() {
        if (document.getElementById('mc-css')) return;
        var s = document.createElement('style');
        s.id = 'mc-css';
        s.textContent = [
            /* ── Mascot base ── */
            '.mc{position:fixed;z-index:49;pointer-events:none;will-change:transform}',
            '.mc-svg{display:block;width:100%;height:auto}',
            '.mc-body-g{transform-origin:50% 100%}',
            '.mc-paws ellipse{transition:all .3s ease}',

            /* ── Background ── */
            '.mc-backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
            '.mc-grid{position:absolute;inset:-20%;width:140%;height:140%;' +
            'background-image:linear-gradient(rgba(59,130,246,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.04) 1px,transparent 1px);' +
            'background-size:48px 48px;animation:mc-grid-drift 60s linear infinite}',
            '.dark-mode .mc-grid{background-image:linear-gradient(rgba(129,140,248,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(129,140,248,.06) 1px,transparent 1px)}',
            '@keyframes mc-grid-drift{0%{transform:translate(0,0)}100%{transform:translate(48px,48px)}}',
            '.mc-wave{position:absolute;inset:-10%;width:120%;height:120%;opacity:.025;' +
            'background:repeating-linear-gradient(135deg,transparent,transparent 30px,rgba(59,130,246,.3) 30px,rgba(59,130,246,.3) 31px);' +
            'animation:mc-wave-drift 80s linear infinite}',
            '.dark-mode .mc-wave{opacity:.03;background:repeating-linear-gradient(135deg,transparent,transparent 30px,rgba(129,140,248,.3) 30px,rgba(129,140,248,.3) 31px)}',
            '@keyframes mc-wave-drift{0%{transform:translate(0,0)}100%{transform:translate(-60px,60px)}}',

            /* ── Colors ── */
            ':root{--mc-orange:#fb923c;--mc-purple:#818cf8;--mc-yellow:#fbbf24;--mc-black:#1f2937;--mc-face:#1e293b;--mc-paw:rgba(0,0,0,.12)}',
            '.dark-mode{--mc-orange:#f97316;--mc-purple:#6366f1;--mc-yellow:#f59e0b;--mc-black:#e5e7eb;--mc-face:#1e293b;--mc-paw:rgba(255,255,255,.08)}',

            /* ── Responsive ── */
            '@media(max-width:1200px){.mc{transform:scale(.55)!important;transform-origin:bottom}}',
            '@media(max-width:800px){.mc{transform:scale(.4)!important}}',
            '@media(max-width:600px){.mc{display:none!important}.mc-backdrop{display:none!important}}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ═══════════════════════════════════════════════════════════════
       Public API
    ═══════════════════════════════════════════════════════════════ */

    window.initMascots = function () {
        injectCSS();
        createBackground();

        DEFS.forEach(function (d) {
            var c = create(d);
            document.body.appendChild(c.el);
            chars.push(c);
            startBlink(c);
        });

        document.addEventListener('mousemove', function (e) { mX = e.clientX; mY = e.clientY; });
        tick();
        startRandomBehaviors();
        hookForms();
    };

    window.setMascotMode = setMode;
})();
