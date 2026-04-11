/**
 * mascots.js — Polished animated mascot characters
 *
 * Inspired by the Nexus login characters: large, clean geometric shapes
 * with expressive dot-eyes that track the mouse. Multiple characters
 * peek from screen edges with idle animations and random behaviors.
 *
 * Features:
 *  - 4 distinct characters at different screen positions
 *  - Eye tracking (pupils follow cursor)
 *  - Password mode: paws slide in to cover eyes
 *  - Random behaviors: tilt, bounce, double-blink, look-around
 *  - Smooth idle bobbing with staggered timing
 */

'use strict';

(function () {

    var mX = 0, mY = 0;
    var chars = [];
    var mode = 'idle';

    /* ═══════════════════════════════════════════════════════════════
       Character definitions — clean shapes, distinct personalities
    ═══════════════════════════════════════════════════════════════ */

    var DEFS = [
        {
            // Big friendly dome — bottom left
            id: 'dome',
            css: 'left:0;bottom:0;width:240px;',
            vb: '0 0 240 200',
            bobDelay: '0s',
            bobDur: '4s',
            body: '<ellipse cx="120" cy="180" rx="120" ry="120" fill="var(--mc1,#f9a8d4)"/>',
            eyeL: { cx: 88, cy: 120, er: 8, pr: 3.5 },
            eyeR: { cx: 148, cy: 120, er: 8, pr: 3.5 },
            pawY: 110,
            mouthType: 'none'
        },
        {
            // Tall rectangle — left side, behind dome
            id: 'block',
            css: 'left:40px;bottom:60px;width:140px;z-index:48;',
            vb: '0 0 140 280',
            bobDelay: '-1.2s',
            bobDur: '4.5s',
            body: '<rect x="0" y="0" width="140" height="280" rx="36" fill="var(--mc2,#818cf8)"/>',
            eyeL: { cx: 48, cy: 95, er: 7, pr: 3 },
            eyeR: { cx: 92, cy: 95, er: 7, pr: 3 },
            pawY: 86,
            mouthType: 'none'
        },
        {
            // Yellow egg — right side
            id: 'egg',
            css: 'right:-20px;bottom:0;width:180px;',
            vb: '0 0 180 220',
            bobDelay: '-0.6s',
            bobDur: '3.8s',
            body: '<ellipse cx="90" cy="140" rx="90" ry="110" fill="var(--mc3,#fbbf24)"/>',
            eyeL: { cx: 62, cy: 108, er: 7.5, pr: 3.2 },
            eyeR: { cx: 118, cy: 108, er: 7.5, pr: 3.2 },
            pawY: 98,
            mouthType: 'line',
            mouthD: 'M68 138 L112 138'
        },
        {
            // Dark capsule — right side, behind egg
            id: 'pill',
            css: 'right:50px;bottom:50px;width:100px;z-index:48;',
            vb: '0 0 100 240',
            bobDelay: '-2s',
            bobDur: '5s',
            body: '<rect x="0" y="0" width="100" height="240" rx="50" fill="var(--mc4,#374151)"/>',
            eyeL: { cx: 36, cy: 82, er: 6, pr: 2.5 },
            eyeR: { cx: 64, cy: 82, er: 6, pr: 2.5 },
            pawY: 74,
            mouthType: 'line',
            mouthD: 'M36 108 L64 108'
        }
    ];

    /* ═══════════════════════════════════════════════════════════════
       Build SVG for a character
    ═══════════════════════════════════════════════════════════════ */

    function buildSvg(d) {
        var eL = d.eyeL, eR = d.eyeR;
        var parts = [
            '<svg viewBox="' + d.vb + '" class="mc-svg" preserveAspectRatio="xMidYMax meet">',
            d.body,
            // Left eye
            '<g class="mc-eye" data-cx="' + eL.cx + '" data-cy="' + eL.cy + '" data-er="' + eL.er + '" data-pr="' + eL.pr + '">',
            '<circle cx="' + eL.cx + '" cy="' + eL.cy + '" r="' + eL.er + '" fill="white"/>',
            '<circle class="mc-pupil" cx="' + eL.cx + '" cy="' + eL.cy + '" r="' + eL.pr + '" fill="var(--mc-eye,#1a1a2e)"/>',
            '</g>',
            // Right eye
            '<g class="mc-eye" data-cx="' + eR.cx + '" data-cy="' + eR.cy + '" data-er="' + eR.er + '" data-pr="' + eR.pr + '">',
            '<circle cx="' + eR.cx + '" cy="' + eR.cy + '" r="' + eR.er + '" fill="white"/>',
            '<circle class="mc-pupil" cx="' + eR.cx + '" cy="' + eR.cy + '" r="' + eR.pr + '" fill="var(--mc-eye,#1a1a2e)"/>',
            '</g>',
            // Mouth
            d.mouthType === 'line' ?
                '<path class="mc-mouth" d="' + d.mouthD + '" fill="none" stroke="var(--mc-eye,#1a1a2e)" stroke-width="2.2" stroke-linecap="round"/>' : '',
            // Paws (hidden initially, slide in to cover eyes during password)
            '<g class="mc-paws" style="opacity:0">',
            '<ellipse class="mc-paw-l" cx="' + (eL.cx - eL.er * 2.5) + '" cy="' + d.pawY + '" rx="' + (eL.er * 1.8) + '" ry="' + (eL.er * 1.3) + '" fill="var(--mc-paw)" rx="8"/>',
            '<ellipse class="mc-paw-r" cx="' + (eR.cx + eR.er * 2.5) + '" cy="' + d.pawY + '" rx="' + (eR.er * 1.8) + '" ry="' + (eR.er * 1.3) + '" fill="var(--mc-paw)" rx="8"/>',
            '</g>',
            '</svg>'
        ];
        return parts.join('');
    }

    /* ═══════════════════════════════════════════════════════════════
       Create a character instance
    ═══════════════════════════════════════════════════════════════ */

    function create(d) {
        var el = document.createElement('div');
        el.className = 'mc mc-' + d.id;
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = d.css;
        el.innerHTML = buildSvg(d);

        // Gather eye refs
        var eyes = [];
        var groups = el.querySelectorAll('.mc-eye');
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            eyes.push({
                g: g,
                pupil: g.querySelector('.mc-pupil'),
                cx: +g.dataset.cx, cy: +g.dataset.cy,
                er: +g.dataset.er, pr: +g.dataset.pr
            });
        }

        return {
            el: el, d: d, eyes: eyes,
            svg: el.querySelector('.mc-svg'),
            paws: el.querySelector('.mc-paws'),
            pawL: el.querySelector('.mc-paw-l'),
            pawR: el.querySelector('.mc-paw-r'),
            // state
            rot: 0, tx: 0, ty: 0
        };
    }

    /* ═══════════════════════════════════════════════════════════════
       Frame update — eye tracking + body lean
    ═══════════════════════════════════════════════════════════════ */

    function tick() {
        for (var i = 0; i < chars.length; i++) {
            var c = chars[i];
            var rect = c.el.getBoundingClientRect();
            if (rect.width === 0) continue;

            var vbParts = c.d.vb.split(' ');
            var vbW = +vbParts[2], vbH = +vbParts[3];
            var sx = rect.width / vbW;
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = mX - cx, dy = mY - cy;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Body lean
            var tRot = (dx / dist) * Math.min(dist * 0.005, 4);
            var tTx = (dx / dist) * Math.min(dist * 0.008, 5);
            var tTy = (dy / dist) * Math.min(dist * 0.004, 3);
            c.rot += (tRot - c.rot) * 0.04;
            c.tx += (tTx - c.tx) * 0.04;
            c.ty += (tTy - c.ty) * 0.04;
            c.svg.style.transform =
                'translate(' + c.tx.toFixed(1) + 'px,' + c.ty.toFixed(1) + 'px) rotate(' + c.rot.toFixed(2) + 'deg)';

            // Eye tracking
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
       Blinking — natural eye squish
    ═══════════════════════════════════════════════════════════════ */

    function startBlink(c) {
        function blink() {
            if (mode === 'password') { c._bt = setTimeout(blink, 3000); return; }
            for (var i = 0; i < c.eyes.length; i++) {
                var e = c.eyes[i];
                e.g.style.transition = 'transform .06s ease-in';
                e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                e.g.style.transform = 'scaleY(0.05)';
            }
            setTimeout(function () {
                if (mode !== 'password') {
                    for (var i = 0; i < c.eyes.length; i++) {
                        c.eyes[i].g.style.transition = 'transform .08s ease-out';
                        c.eyes[i].g.style.transform = 'scaleY(1)';
                    }
                }
            }, 80);
            c._bt = setTimeout(blink, 2000 + Math.random() * 5000);
        }
        c._bt = setTimeout(blink, 500 + Math.random() * 2000);
    }

    /* ═══════════════════════════════════════════════════════════════
       Random behaviors — tilt, bounce, surprise
    ═══════════════════════════════════════════════════════════════ */

    function startRandomBehaviors() {
        function doRandom() {
            if (chars.length === 0) return;
            var c = chars[Math.floor(Math.random() * chars.length)];
            var action = Math.random();

            if (action < 0.35) {
                // Head tilt
                var tilt = (Math.random() - 0.5) * 10;
                c.el.style.transition = 'transform .4s cubic-bezier(.4,0,.2,1)';
                c.el.style.transform = 'translateY(' + (c._bobY || 0) + 'px) rotate(' + tilt + 'deg)';
                setTimeout(function () {
                    c.el.style.transform = '';
                    c.el.style.transition = '';
                }, 800);
            } else if (action < 0.6) {
                // Quick bounce
                c.el.style.transition = 'transform .2s cubic-bezier(.4,0,.2,1)';
                c.el.style.transform = 'translateY(-14px)';
                setTimeout(function () {
                    c.el.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1)';
                    c.el.style.transform = '';
                }, 200);
            } else if (action < 0.8) {
                // Double blink
                for (var i = 0; i < c.eyes.length; i++) {
                    c.eyes[i].g.style.transition = 'transform .05s ease-in';
                    c.eyes[i].g.style.transformOrigin = c.eyes[i].cx + 'px ' + c.eyes[i].cy + 'px';
                    c.eyes[i].g.style.transform = 'scaleY(0.05)';
                }
                setTimeout(function () {
                    for (var i = 0; i < c.eyes.length; i++) {
                        c.eyes[i].g.style.transition = 'transform .06s ease-out';
                        c.eyes[i].g.style.transform = 'scaleY(1)';
                    }
                    setTimeout(function () {
                        for (var i = 0; i < c.eyes.length; i++) {
                            c.eyes[i].g.style.transition = 'transform .05s ease-in';
                            c.eyes[i].g.style.transform = 'scaleY(0.05)';
                        }
                        setTimeout(function () {
                            for (var i = 0; i < c.eyes.length; i++) {
                                c.eyes[i].g.style.transition = 'transform .06s ease-out';
                                c.eyes[i].g.style.transform = 'scaleY(1)';
                            }
                        }, 60);
                    }, 120);
                }, 60);
            } else {
                // Wide eyes (surprise) — briefly enlarge eyes
                for (var i = 0; i < c.eyes.length; i++) {
                    c.eyes[i].g.style.transition = 'transform .15s cubic-bezier(.34,1.4,.64,1)';
                    c.eyes[i].g.style.transformOrigin = c.eyes[i].cx + 'px ' + c.eyes[i].cy + 'px';
                    c.eyes[i].g.style.transform = 'scale(1.25)';
                }
                setTimeout(function () {
                    for (var i = 0; i < c.eyes.length; i++) {
                        c.eyes[i].g.style.transition = 'transform .3s ease';
                        c.eyes[i].g.style.transform = 'scale(1)';
                    }
                }, 600);
            }

            setTimeout(doRandom, 3000 + Math.random() * 5000);
        }
        setTimeout(doRandom, 2000);
    }

    /* ═══════════════════════════════════════════════════════════════
       Password mode — paws cover eyes
    ═══════════════════════════════════════════════════════════════ */

    function setMode(m) {
        if (mode === m) return;
        mode = m;

        chars.forEach(function (c) {
            if (m === 'password') {
                // Show paws, animate to cover eyes
                if (c.paws) {
                    c.paws.style.transition = 'opacity .2s ease';
                    c.paws.style.opacity = '1';
                }
                var midX = (c.eyes[0].cx + c.eyes[1].cx) / 2;
                if (c.pawL) {
                    c.pawL.style.transition = 'cx .3s cubic-bezier(.34,1.4,.64,1), cy .3s ease';
                    c.pawL.setAttribute('cx', c.eyes[0].cx);
                    c.pawL.setAttribute('cy', c.eyes[0].cy);
                }
                if (c.pawR) {
                    c.pawR.style.transition = 'cx .3s cubic-bezier(.34,1.4,.64,1), cy .3s ease';
                    c.pawR.setAttribute('cx', c.eyes[1].cx);
                    c.pawR.setAttribute('cy', c.eyes[1].cy);
                }
                // Squish eyes
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .2s ease';
                    e.g.style.transformOrigin = e.cx + 'px ' + e.cy + 'px';
                    e.g.style.transform = 'scaleY(0.15)';
                });
            } else {
                // Hide paws
                if (c.paws) {
                    c.paws.style.transition = 'opacity .3s ease';
                    c.paws.style.opacity = '0';
                }
                if (c.pawL) {
                    c.pawL.style.transition = 'cx .3s ease, cy .3s ease';
                    c.pawL.setAttribute('cx', c.eyes[0].cx - c.eyes[0].er * 2.5);
                    c.pawL.setAttribute('cy', c.d.pawY);
                }
                if (c.pawR) {
                    c.pawR.style.transition = 'cx .3s ease, cy .3s ease';
                    c.pawR.setAttribute('cx', c.eyes[1].cx + c.eyes[1].er * 2.5);
                    c.pawR.setAttribute('cy', c.d.pawY);
                }
                // Restore eyes
                c.eyes.forEach(function (e) {
                    e.g.style.transition = 'transform .2s ease';
                    e.g.style.transform = 'scaleY(1)';
                });
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       Form field hooks
    ═══════════════════════════════════════════════════════════════ */

    function hookForms() {
        document.querySelectorAll('input[type="password"]').forEach(function (f) {
            f.addEventListener('focus', function () { setMode('password'); });
            f.addEventListener('blur', function () { setMode('idle'); });
        });
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
            '.mc-svg{transition:transform .15s ease-out}',
            '.mc-paws ellipse{transition:cx .3s ease,cy .3s ease}',
            // Idle bob — each char has its own delay/duration via inline style
            '.mc{animation:mc-bob var(--mc-dur,4s) ease-in-out infinite var(--mc-delay,0s)}',
            '@keyframes mc-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}',
            // Colors
            ':root{--mc1:#f9a8d4;--mc2:#818cf8;--mc3:#fbbf24;--mc4:#374151;--mc-eye:#1a1a2e;--mc-paw:rgba(0,0,0,.15)}',
            '.dark-mode{--mc1:#ec4899;--mc2:#6366f1;--mc3:#f59e0b;--mc4:#d1d5db;--mc-eye:#1a1a2e;--mc-paw:rgba(255,255,255,.1)}',
            // Responsive
            '@media(max-width:1200px){.mc{transform:scale(.65)!important;transform-origin:bottom center}}',
            '@media(max-width:800px){.mc{transform:scale(.45)!important}}',
            '@media(max-width:600px){.mc{display:none!important}}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ═══════════════════════════════════════════════════════════════
       Public
    ═══════════════════════════════════════════════════════════════ */

    window.initMascots = function () {
        injectCSS();

        DEFS.forEach(function (d) {
            var c = create(d);
            c.el.style.setProperty('--mc-dur', d.bobDur);
            c.el.style.setProperty('--mc-delay', d.bobDelay);
            document.body.appendChild(c.el);
            chars.push(c);
            startBlink(c);
        });

        document.addEventListener('mousemove', function (e) {
            mX = e.clientX;
            mY = e.clientY;
        });

        tick();
        startRandomBehaviors();
        hookForms();
    };

    window.setMascotMode = setMode;
})();
