/**
 * mascots.js — Lively animated characters peeking from screen edges
 *
 * Features:
 *  - Eyes track the mouse cursor smoothly
 *  - Body sways and leans toward the mouse
 *  - Natural blinking (eye squish, not colored overlay)
 *  - Idle bounce/wobble animations
 *  - Responsive: hidden on narrow screens
 */

'use strict';

(function () {

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var mascotInstances = [];

    // ── Characters ────────────────────────────────────────────────

    var CHARS = {
        // Round friendly guy — left side
        blobby: {
            side: 'left',
            w: 160, h: 200,
            hideX: -52,
            bottomPct: 10,
            svg: function () {
                return '' +
                    // body
                    '<ellipse class="m-body" cx="80" cy="120" rx="62" ry="68" fill="var(--m-blue,#60a5fa)"/>' +
                    // cheeks
                    '<ellipse cx="32" cy="132" rx="12" ry="8" fill="rgba(251,113,133,.15)" opacity=".8"/>' +
                    '<ellipse cx="128" cy="132" rx="12" ry="8" fill="rgba(251,113,133,.15)" opacity=".8"/>' +
                    // left eye
                    '<g class="m-eye" data-cx="58" data-cy="100" data-sr="15" data-pr="6.5">' +
                    '<circle cx="58" cy="100" r="15" fill="white"/>' +
                    '<circle class="m-pupil" cx="58" cy="100" r="6.5" fill="var(--m-face,#1e293b)"/>' +
                    '<circle cx="55" cy="96" r="2.5" fill="white" opacity=".7"/>' + // highlight
                    '</g>' +
                    // right eye
                    '<g class="m-eye" data-cx="102" data-cy="100" data-sr="15" data-pr="6.5">' +
                    '<circle cx="102" cy="100" r="15" fill="white"/>' +
                    '<circle class="m-pupil" cx="102" cy="100" r="6.5" fill="var(--m-face,#1e293b)"/>' +
                    '<circle cx="99" cy="96" r="2.5" fill="white" opacity=".7"/>' +
                    '</g>' +
                    // mouth
                    '<path class="m-mouth" d="M62 140 Q80 150 98 140" fill="none" stroke="var(--m-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>';
            }
        },
        // Tall curious guy — right side
        pillar: {
            side: 'right',
            w: 120, h: 220,
            hideX: -40,
            bottomPct: 6,
            svg: function () {
                return '' +
                    // body
                    '<rect class="m-body" x="18" y="28" width="84" height="168" rx="42" fill="var(--m-yellow,#fbbf24)"/>' +
                    // left eye
                    '<g class="m-eye" data-cx="42" data-cy="94" data-sr="12" data-pr="5">' +
                    '<circle cx="42" cy="94" r="12" fill="white"/>' +
                    '<circle class="m-pupil" cx="42" cy="94" r="5" fill="var(--m-face,#1e293b)"/>' +
                    '<circle cx="40" cy="91" r="2" fill="white" opacity=".7"/>' +
                    '</g>' +
                    // right eye
                    '<g class="m-eye" data-cx="78" data-cy="94" data-sr="12" data-pr="5">' +
                    '<circle cx="78" cy="94" r="12" fill="white"/>' +
                    '<circle class="m-pupil" cx="78" cy="94" r="5" fill="var(--m-face,#1e293b)"/>' +
                    '<circle cx="76" cy="91" r="2" fill="white" opacity=".7"/>' +
                    '</g>' +
                    // mouth
                    '<line class="m-mouth" x1="44" y1="120" x2="76" y2="120" stroke="var(--m-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>';
            }
        }
    };

    // ── Create mascot ─────────────────────────────────────────────

    function create(key) {
        var ch = CHARS[key];
        if (!ch) return null;

        var wrap = document.createElement('div');
        wrap.className = 'mascot mascot-' + ch.side;
        wrap.setAttribute('aria-hidden', 'true');

        var svgHtml = '<svg viewBox="0 0 ' + ch.w + ' ' + ch.h + '" width="' + ch.w + '" height="' + ch.h + '" style="overflow:visible;display:block">' + ch.svg() + '</svg>';
        wrap.innerHTML = svgHtml;

        var eyes = [];
        var eyeGroups = wrap.querySelectorAll('.m-eye');
        for (var i = 0; i < eyeGroups.length; i++) {
            var g = eyeGroups[i];
            eyes.push({
                group: g,
                pupil: g.querySelector('.m-pupil'),
                cx: parseFloat(g.getAttribute('data-cx')),
                cy: parseFloat(g.getAttribute('data-cy')),
                sr: parseFloat(g.getAttribute('data-sr')),
                pr: parseFloat(g.getAttribute('data-pr'))
            });
        }

        return {
            el: wrap,
            ch: ch,
            eyes: eyes,
            body: wrap.querySelector('.m-body'),
            svg: wrap.querySelector('svg'),
            // smooth tracking state
            leanX: 0, leanY: 0,
            targetLeanX: 0, targetLeanY: 0,
            squash: 1, targetSquash: 1,
            blinkTimer: null
        };
    }

    // ── Eye + body update (runs every frame) ──────────────────────

    function updateAll() {
        mascotInstances.forEach(function (m) {
            var rect = m.el.getBoundingClientRect();
            var scaleX = rect.width / m.ch.w;
            var scaleY = rect.height / m.ch.h;

            // Body lean toward mouse (subtle)
            var bodyCenterX = rect.left + rect.width / 2;
            var bodyCenterY = rect.top + rect.height / 2;
            var dx = mouseX - bodyCenterX;
            var dy = mouseY - bodyCenterY;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Lean: max ±6 degrees rotation, ±8px translate
            m.targetLeanX = (dx / dist) * Math.min(dist * 0.012, 8);
            m.targetLeanY = (dy / dist) * Math.min(dist * 0.006, 4);
            var targetRotate = (dx / dist) * Math.min(dist * 0.008, 6);

            // Smooth easing
            m.leanX += (m.targetLeanX - m.leanX) * 0.06;
            m.leanY += (m.targetLeanY - m.leanY) * 0.06;
            m.squash += (m.targetSquash - m.squash) * 0.12;

            var rot = targetRotate * 0.06 + (m._rot || 0) * 0.94;
            m._rot = rot;

            // Apply body transform
            m.svg.style.transform =
                'translate(' + m.leanX.toFixed(2) + 'px,' + m.leanY.toFixed(2) + 'px)' +
                ' rotate(' + rot.toFixed(2) + 'deg)' +
                ' scaleY(' + m.squash.toFixed(3) + ')';

            // Eyes: pupils track mouse
            m.eyes.forEach(function (eye) {
                var eyeVpX = rect.left + eye.cx * scaleX;
                var eyeVpY = rect.top + eye.cy * scaleY;
                var edx = mouseX - eyeVpX;
                var edy = mouseY - eyeVpY;
                var edist = Math.sqrt(edx * edx + edy * edy) || 1;
                var maxMove = eye.sr - eye.pr - 1.5;
                var move = Math.min(edist * 0.025, maxMove);

                var px = eye.cx + (edx / edist) * move;
                var py = eye.cy + (edy / edist) * move;
                eye.pupil.setAttribute('cx', px.toFixed(1));
                eye.pupil.setAttribute('cy', py.toFixed(1));
            });
        });

        requestAnimationFrame(updateAll);
    }

    // ── Blinking (natural eye squish) ─────────────────────────────

    function startBlink(m) {
        function doBlink() {
            // Squish eyes closed
            m.eyes.forEach(function (eye) {
                eye.group.style.transition = 'transform .08s ease-in';
                eye.group.style.transformOrigin = eye.cx + 'px ' + eye.cy + 'px';
                eye.group.style.transform = 'scaleY(0.08)';
            });
            // Also slight body squash
            m.targetSquash = 0.97;

            setTimeout(function () {
                // Open eyes
                m.eyes.forEach(function (eye) {
                    eye.group.style.transition = 'transform .1s ease-out';
                    eye.group.style.transform = 'scaleY(1)';
                });
                m.targetSquash = 1;
            }, 100);

            // Next blink
            var next = 2000 + Math.random() * 4500;
            m.blinkTimer = setTimeout(doBlink, next);
        }

        m.blinkTimer = setTimeout(doBlink, 800 + Math.random() * 2000);
    }

    // ── CSS injection ─────────────────────────────────────────────

    function injectCSS() {
        if (document.getElementById('mascot-css')) return;
        var css =
            '.mascot{position:fixed;z-index:50;pointer-events:none;will-change:transform}' +
            '.mascot-left{bottom:var(--m-bottom,10%);left:var(--m-hide,-52px)}' +
            '.mascot-right{bottom:var(--m-bottom,6%);right:var(--m-hide,-40px)}' +
            '.mascot svg{transition:transform .15s ease-out}' +
            // Idle bob
            '.mascot-left{animation:m-idle-l 3.8s ease-in-out infinite}' +
            '.mascot-right{animation:m-idle-r 4.2s ease-in-out infinite .5s}' +
            '@keyframes m-idle-l{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}' +
            '@keyframes m-idle-r{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}' +
            // Theme colors
            ':root{--m-blue:#60a5fa;--m-yellow:#fbbf24;--m-face:#1e293b}' +
            '.dark-mode{--m-blue:#7c8cf5;--m-yellow:#f59e0b;--m-face:#1e293b}' +
            // Responsive
            '@media(max-width:1024px){.mascot{opacity:.45;transform:scale(.65)!important}}' +
            '@media(max-width:640px){.mascot{display:none!important}}';
        var el = document.createElement('style');
        el.id = 'mascot-css';
        el.textContent = css;
        document.head.appendChild(el);
    }

    // ── Public API ────────────────────────────────────────────────

    window.initMascots = function (opts) {
        opts = opts || {};
        var which = opts.characters || ['blobby', 'pillar'];

        injectCSS();

        which.forEach(function (key) {
            var m = create(key);
            if (!m) return;
            // Set custom property for positioning
            m.el.style.setProperty('--m-bottom', m.ch.bottomPct + '%');
            m.el.style.setProperty('--m-hide', m.ch.hideX + 'px');
            document.body.appendChild(m.el);
            mascotInstances.push(m);
            startBlink(m);
        });

        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        updateAll();
    };

})();
