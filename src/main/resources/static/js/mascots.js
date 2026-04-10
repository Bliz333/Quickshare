/**
 * mascots.js — Animated characters that peek from screen edges
 *
 * Usage: include this script, then call initMascots() on page load.
 * Characters have idle animations + eyes that track the mouse.
 */

'use strict';

(function () {

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var mascots = [];

    // ── Character definitions ──────────────────────────────────────

    var CHARACTERS = {
        // Round blue guy — peeks from left
        roundBlue: {
            side: 'left',
            width: 140,
            height: 180,
            offsetX: -48,     // how much hidden off-edge
            bottomPct: 12,    // % from bottom
            idleAnim: 'mascot-bob-l',
            body: '<ellipse cx="70" cy="108" rx="58" ry="66" fill="var(--mascot-blue,#60a5fa)"/>',
            eyes: [
                { cx: 48, cy: 88, sr: 13, pr: 5.5 },
                { cx: 88, cy: 88, sr: 13, pr: 5.5 }
            ],
            mouth: '<path d="M50 122 Q70 132 90 122" fill="none" stroke="var(--mascot-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>',
            cheeks: '<ellipse cx="36" cy="108" rx="10" ry="7" fill="rgba(244,114,182,.18)"/><ellipse cx="104" cy="108" rx="10" ry="7" fill="rgba(244,114,182,.18)"/>'
        },

        // Tall yellow guy — peeks from right
        tallYellow: {
            side: 'right',
            width: 110,
            height: 210,
            offsetX: -36,
            bottomPct: 8,
            idleAnim: 'mascot-bob-r',
            body: '<rect x="15" y="24" width="80" height="162" rx="40" fill="var(--mascot-yellow,#fbbf24)"/>',
            eyes: [
                { cx: 38, cy: 86, sr: 11, pr: 4.5 },
                { cx: 72, cy: 86, sr: 11, pr: 4.5 }
            ],
            mouth: '<line x1="40" y1="114" x2="70" y2="114" stroke="var(--mascot-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>',
            cheeks: ''
        }
    };

    // ── Build SVG ─────────────────────────────────────────────────

    function buildSvg(def) {
        var eyesSvg = '';
        def.eyes.forEach(function (e, i) {
            eyesSvg +=
                '<circle cx="' + e.cx + '" cy="' + e.cy + '" r="' + e.sr + '" fill="white"/>' +
                '<circle class="mascot-pupil" data-bcx="' + e.cx + '" data-bcy="' + e.cy +
                '" data-sr="' + e.sr + '" data-pr="' + e.pr +
                '" cx="' + e.cx + '" cy="' + e.cy + '" r="' + e.pr + '" fill="var(--mascot-face,#1e293b)"/>' +
                '<ellipse class="mascot-lid" cx="' + e.cx + '" cy="' + e.cy +
                '" rx="' + (e.sr + 1) + '" ry="0" fill="var(--mascot-lid,' +
                (def.side === 'left' ? '#60a5fa' : '#fbbf24') + ')" style="transition:ry .08s ease"/>';
        });

        return '<svg viewBox="0 0 ' + def.width + ' ' + def.height +
            '" width="' + def.width + '" height="' + def.height +
            '" style="overflow:visible;display:block">' +
            def.body + (def.cheeks || '') + eyesSvg + (def.mouth || '') +
            '</svg>';
    }

    // ── Create mascot DOM ─────────────────────────────────────────

    function createMascot(key) {
        var def = CHARACTERS[key];
        if (!def) return null;

        var el = document.createElement('div');
        el.className = 'mascot mascot-' + def.side;
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText =
            'position:fixed;z-index:50;pointer-events:none;' +
            'bottom:' + def.bottomPct + '%;' +
            (def.side === 'left' ? 'left:' : 'right:') + def.offsetX + 'px;' +
            'width:' + def.width + 'px;height:' + def.height + 'px;' +
            'animation:' + def.idleAnim + ' 3.5s ease-in-out infinite;' +
            'will-change:transform;transition:opacity .4s ease;';

        el.innerHTML = buildSvg(def);

        var pupils = el.querySelectorAll('.mascot-pupil');
        var lids = el.querySelectorAll('.mascot-lid');

        return {
            el: el,
            def: def,
            pupils: Array.prototype.slice.call(pupils),
            lids: Array.prototype.slice.call(lids)
        };
    }

    // ── Eye tracking ──────────────────────────────────────────────

    function updateEyes() {
        mascots.forEach(function (m) {
            var rect = m.el.getBoundingClientRect();

            m.pupils.forEach(function (pupil) {
                var bcx = parseFloat(pupil.getAttribute('data-bcx'));
                var bcy = parseFloat(pupil.getAttribute('data-bcy'));
                var sr = parseFloat(pupil.getAttribute('data-sr'));
                var pr = parseFloat(pupil.getAttribute('data-pr'));
                var maxMove = sr - pr - 1;

                // Eye center in viewport coordinates
                var scaleX = rect.width / m.def.width;
                var scaleY = rect.height / m.def.height;
                var eyeVpX = rect.left + bcx * scaleX;
                var eyeVpY = rect.top + bcy * scaleY;

                var dx = mouseX - eyeVpX;
                var dy = mouseY - eyeVpY;
                var dist = Math.sqrt(dx * dx + dy * dy) || 1;

                var move = Math.min(dist * 0.03, maxMove);
                var px = bcx + (dx / dist) * move;
                var py = bcy + (dy / dist) * move;

                pupil.setAttribute('cx', px.toFixed(2));
                pupil.setAttribute('cy', py.toFixed(2));
            });
        });

        requestAnimationFrame(updateEyes);
    }

    // ── Blinking ──────────────────────────────────────────────────

    function startBlinking(m) {
        function blink() {
            // Close
            m.lids.forEach(function (lid) {
                var sr = parseFloat(lid.getAttribute('rx')) || 14;
                lid.setAttribute('ry', sr);
            });

            // Open after 120ms
            setTimeout(function () {
                m.lids.forEach(function (lid) {
                    lid.setAttribute('ry', '0');
                });
            }, 120);

            // Next blink
            setTimeout(blink, 2500 + Math.random() * 4000);
        }

        setTimeout(blink, 1000 + Math.random() * 3000);
    }

    // ── CSS injection ─────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('mascot-styles')) return;

        var css =
            '@keyframes mascot-bob-l{' +
            '0%,100%{transform:translateY(0) rotate(0deg)}' +
            '50%{transform:translateY(-6px) rotate(1.5deg)}' +
            '}' +
            '@keyframes mascot-bob-r{' +
            '0%,100%{transform:translateY(0) rotate(0deg)}' +
            '50%{transform:translateY(-8px) rotate(-1.5deg)}' +
            '}' +
            '.dark-mode{' +
            '--mascot-blue:#7c8cf5;--mascot-yellow:#f59e0b;' +
            '--mascot-face:#e2e8f0;--mascot-lid:var(--mascot-blue)' +
            '}' +
            ':root{--mascot-face:#1e293b}' +
            '@media(max-width:900px){.mascot{opacity:.4!important;transform:scale(.7)!important}}' +
            '@media(max-width:640px){.mascot{display:none!important}}';

        var style = document.createElement('style');
        style.id = 'mascot-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── Public API ────────────────────────────────────────────────

    window.initMascots = function (opts) {
        opts = opts || {};
        var which = opts.characters || ['roundBlue', 'tallYellow'];

        injectStyles();

        which.forEach(function (key) {
            var m = createMascot(key);
            if (!m) return;
            document.body.appendChild(m.el);
            mascots.push(m);
            startBlinking(m);
        });

        // Mouse tracking
        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        updateEyes();
    };

})();
