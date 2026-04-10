/**
 * mascots.js — Full-body animated characters with interactive behaviors
 *
 * Characters have:
 *  - Full visible body, arms, face
 *  - Eyes that track mouse
 *  - Arms that wave/react
 *  - Expression changes (happy, peek, shy)
 *  - Login page: covers eyes during password input
 */

'use strict';

(function () {

    var mx = 0.5, my = 0.5;       // normalized mouse position
    var mxPx = 0, myPx = 0;       // pixel mouse position
    var instances = [];
    var currentMode = 'idle';      // idle | typing | password | error

    // ── SVG character builder ─────────────────────────────────────

    function leftCharSvg() {
        // A round, friendly blue character — full body with stubby arms
        return [
            '<svg viewBox="0 0 200 320" class="m-svg" style="overflow:visible">',
            // Body
            '<ellipse class="m-body" cx="100" cy="200" rx="70" ry="90" fill="var(--m-c1,#60a5fa)"/>',
            // Feet
            '<ellipse cx="65" cy="285" rx="22" ry="12" fill="var(--m-c1d,#3b82f6)" opacity=".6"/>',
            '<ellipse cx="135" cy="285" rx="22" ry="12" fill="var(--m-c1d,#3b82f6)" opacity=".6"/>',
            // Left arm
            '<g class="m-arm-l" style="transform-origin:45px 185px">',
            '<path d="M45 185 Q18 195 12 225 Q8 245 22 248" fill="none" stroke="var(--m-c1,#60a5fa)" stroke-width="18" stroke-linecap="round"/>',
            '</g>',
            // Right arm
            '<g class="m-arm-r" style="transform-origin:155px 185px">',
            '<path d="M155 185 Q182 195 188 225 Q192 245 178 248" fill="none" stroke="var(--m-c1,#60a5fa)" stroke-width="18" stroke-linecap="round"/>',
            '</g>',
            // Face area
            '<g class="m-face">',
            // Left eye
            '<g class="m-eye m-eye-l" data-cx="75" data-cy="175" data-sr="16" data-pr="7">',
            '<circle cx="75" cy="175" r="16" fill="white"/>',
            '<circle class="m-pupil" cx="75" cy="175" r="7" fill="var(--m-face,#1e293b)"/>',
            '<circle cx="72" cy="171" r="3" fill="white" opacity=".8"/>',
            '</g>',
            // Right eye
            '<g class="m-eye m-eye-r" data-cx="125" data-cy="175" data-sr="16" data-pr="7">',
            '<circle cx="125" cy="175" r="16" fill="white"/>',
            '<circle class="m-pupil" cx="125" cy="175" r="7" fill="var(--m-face,#1e293b)"/>',
            '<circle cx="122" cy="171" r="3" fill="white" opacity=".8"/>',
            '</g>',
            // Mouth
            '<path class="m-mouth" d="M82 210 Q100 222 118 210" fill="none" stroke="var(--m-face,#1e293b)" stroke-width="2.8" stroke-linecap="round"/>',
            // Blush
            '<ellipse cx="55" cy="200" rx="10" ry="6" fill="rgba(251,113,133,.18)"/>',
            '<ellipse cx="145" cy="200" rx="10" ry="6" fill="rgba(251,113,133,.18)"/>',
            '</g>',
            '</svg>'
        ].join('');
    }

    function rightCharSvg() {
        // A tall, curious yellow/amber character — full body with arms
        return [
            '<svg viewBox="0 0 160 340" class="m-svg" style="overflow:visible">',
            // Body
            '<rect class="m-body" x="28" y="40" width="104" height="240" rx="52" fill="var(--m-c2,#fbbf24)"/>',
            // Feet
            '<ellipse cx="55" cy="275" rx="18" ry="10" fill="var(--m-c2d,#f59e0b)" opacity=".6"/>',
            '<ellipse cx="105" cy="275" rx="18" ry="10" fill="var(--m-c2d,#f59e0b)" opacity=".6"/>',
            // Left arm
            '<g class="m-arm-l" style="transform-origin:35px 135px">',
            '<path d="M35 135 Q10 150 5 180 Q2 200 14 205" fill="none" stroke="var(--m-c2,#fbbf24)" stroke-width="16" stroke-linecap="round"/>',
            '</g>',
            // Right arm
            '<g class="m-arm-r" style="transform-origin:125px 135px">',
            '<path d="M125 135 Q150 150 155 180 Q158 200 146 205" fill="none" stroke="var(--m-c2,#fbbf24)" stroke-width="16" stroke-linecap="round"/>',
            '</g>',
            // Face
            '<g class="m-face">',
            // Eyes
            '<g class="m-eye m-eye-l" data-cx="60" data-cy="120" data-sr="14" data-pr="6">',
            '<circle cx="60" cy="120" r="14" fill="white"/>',
            '<circle class="m-pupil" cx="60" cy="120" r="6" fill="var(--m-face,#1e293b)"/>',
            '<circle cx="57" cy="117" r="2.5" fill="white" opacity=".8"/>',
            '</g>',
            '<g class="m-eye m-eye-r" data-cx="100" data-cy="120" data-sr="14" data-pr="6">',
            '<circle cx="100" cy="120" r="14" fill="white"/>',
            '<circle class="m-pupil" cx="100" cy="120" r="6" fill="var(--m-face,#1e293b)"/>',
            '<circle cx="97" cy="117" r="2.5" fill="white" opacity=".8"/>',
            '</g>',
            // Mouth
            '<line class="m-mouth" x1="65" y1="152" x2="95" y2="152" stroke="var(--m-face,#1e293b)" stroke-width="2.5" stroke-linecap="round"/>',
            '</g>',
            '</svg>'
        ].join('');
    }

    // ── Create instance ───────────────────────────────────────────

    function createChar(side) {
        var wrap = document.createElement('div');
        wrap.className = 'mascot mascot-' + side;
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML = side === 'left' ? leftCharSvg() : rightCharSvg();

        var eyes = [];
        var eyeEls = wrap.querySelectorAll('.m-eye');
        for (var i = 0; i < eyeEls.length; i++) {
            var g = eyeEls[i];
            eyes.push({
                group: g,
                pupil: g.querySelector('.m-pupil'),
                cx: +g.getAttribute('data-cx'),
                cy: +g.getAttribute('data-cy'),
                sr: +g.getAttribute('data-sr'),
                pr: +g.getAttribute('data-pr')
            });
        }

        return {
            el: wrap,
            side: side,
            svg: wrap.querySelector('.m-svg'),
            eyes: eyes,
            armL: wrap.querySelector('.m-arm-l'),
            armR: wrap.querySelector('.m-arm-r'),
            mouth: wrap.querySelector('.m-mouth'),
            face: wrap.querySelector('.m-face'),
            // Animation state
            rot: 0, tx: 0, ty: 0
        };
    }

    // ── Per-frame update ──────────────────────────────────────────

    function update() {
        instances.forEach(function (m) {
            var rect = m.el.getBoundingClientRect();
            var cw = m.side === 'left' ? 200 : 160;
            var ch = m.side === 'left' ? 320 : 340;
            var sx = rect.width / cw;
            var sy = rect.height / ch;
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = mxPx - cx;
            var dy = myPx - cy;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;

            // Body lean toward mouse
            var targetRot = (dx / d) * Math.min(d * 0.006, 5);
            var targetTx = (dx / d) * Math.min(d * 0.01, 6);
            var targetTy = (dy / d) * Math.min(d * 0.005, 3);
            m.rot += (targetRot - m.rot) * 0.05;
            m.tx += (targetTx - m.tx) * 0.05;
            m.ty += (targetTy - m.ty) * 0.05;

            m.svg.style.transform =
                'translate(' + m.tx.toFixed(1) + 'px,' + m.ty.toFixed(1) + 'px) rotate(' + m.rot.toFixed(2) + 'deg)';

            // Arms react to mouse proximity
            var armAngle = (dx / d) * Math.min(d * 0.015, 15);
            if (m.armL) m.armL.style.transform = 'rotate(' + (-armAngle * 0.6).toFixed(1) + 'deg)';
            if (m.armR) m.armR.style.transform = 'rotate(' + (armAngle * 0.6).toFixed(1) + 'deg)';

            // Eye tracking
            if (currentMode !== 'password') {
                m.eyes.forEach(function (eye) {
                    eye.group.style.transform = '';
                    var ex = rect.left + eye.cx * sx;
                    var ey = rect.top + eye.cy * sy;
                    var edx = mxPx - ex;
                    var edy = myPx - ey;
                    var ed = Math.sqrt(edx * edx + edy * edy) || 1;
                    var maxM = eye.sr - eye.pr - 1.5;
                    var move = Math.min(ed * 0.02, maxM);
                    eye.pupil.setAttribute('cx', (eye.cx + (edx / ed) * move).toFixed(1));
                    eye.pupil.setAttribute('cy', (eye.cy + (edy / ed) * move).toFixed(1));
                });
            }

            // Mouth expression
            if (m.mouth && currentMode === 'password') {
                // surprised/concerned "o" shape
                if (m.mouth.tagName === 'path') {
                    m.mouth.setAttribute('d', 'M90 210 Q100 218 110 210 Q105 220 95 220 Z');
                    m.mouth.setAttribute('fill', 'var(--m-face,#1e293b)');
                } else {
                    m.mouth.setAttribute('y1', '152');
                    m.mouth.setAttribute('y2', '152');
                }
            } else if (m.mouth && currentMode === 'idle') {
                if (m.mouth.tagName === 'path') {
                    m.mouth.setAttribute('d', 'M82 210 Q100 222 118 210');
                    m.mouth.setAttribute('fill', 'none');
                }
            }
        });

        requestAnimationFrame(update);
    }

    // ── Password mode: arms cover eyes ────────────────────────────

    function setMode(mode) {
        if (currentMode === mode) return;
        currentMode = mode;

        instances.forEach(function (m) {
            if (mode === 'password') {
                // Arms move up to cover eyes
                if (m.armL) m.armL.style.transform = 'rotate(-55deg) translateY(-20px)';
                if (m.armR) m.armR.style.transform = 'rotate(55deg) translateY(-20px)';
                // Squish eyes shut
                m.eyes.forEach(function (eye) {
                    eye.group.style.transition = 'transform .2s ease';
                    eye.group.style.transformOrigin = eye.cx + 'px ' + eye.cy + 'px';
                    eye.group.style.transform = 'scaleY(0.1)';
                });
            } else {
                // Arms back to normal (mouse-driven)
                m.eyes.forEach(function (eye) {
                    eye.group.style.transition = 'transform .2s ease';
                    eye.group.style.transform = 'scaleY(1)';
                });
            }
        });
    }

    // ── Blinking ──────────────────────────────────────────────────

    function startBlink(m) {
        function blink() {
            if (currentMode === 'password') {
                m._blinkT = setTimeout(blink, 3000);
                return;
            }
            m.eyes.forEach(function (eye) {
                eye.group.style.transition = 'transform .07s ease-in';
                eye.group.style.transformOrigin = eye.cx + 'px ' + eye.cy + 'px';
                eye.group.style.transform = 'scaleY(0.05)';
            });
            setTimeout(function () {
                if (currentMode !== 'password') {
                    m.eyes.forEach(function (eye) {
                        eye.group.style.transition = 'transform .09s ease-out';
                        eye.group.style.transform = 'scaleY(1)';
                    });
                }
            }, 90);
            m._blinkT = setTimeout(blink, 2500 + Math.random() * 4000);
        }
        m._blinkT = setTimeout(blink, 1000 + Math.random() * 2000);
    }

    // ── Login/register page integration ───────────────────────────

    function hookFormFields() {
        // Detect password fields
        var pwFields = document.querySelectorAll('input[type="password"]');
        var textFields = document.querySelectorAll('input[type="text"], input[type="email"]');

        pwFields.forEach(function (f) {
            f.addEventListener('focus', function () { setMode('password'); });
            f.addEventListener('blur', function () { setMode('idle'); });
        });

        textFields.forEach(function (f) {
            f.addEventListener('focus', function () { setMode('typing'); });
            f.addEventListener('blur', function () { setMode('idle'); });
        });
    }

    // ── CSS ───────────────────────────────────────────────────────

    function injectCSS() {
        if (document.getElementById('mascot-css')) return;
        var s = document.createElement('style');
        s.id = 'mascot-css';
        s.textContent = [
            '.mascot{position:fixed;z-index:50;pointer-events:none;will-change:transform}',
            '.mascot-left{left:-30px;bottom:4%;width:140px}',
            '.mascot-right{right:-24px;bottom:2%;width:112px}',
            '.mascot .m-svg{display:block;width:100%;height:auto;transition:transform .12s ease-out}',
            '.mascot .m-arm-l,.mascot .m-arm-r{transition:transform .3s cubic-bezier(.4,0,.2,1)}',
            '.mascot .m-eye{transition:transform .09s ease}',
            // Idle bounce
            '.mascot-left{animation:m-bob-l 3.8s ease-in-out infinite}',
            '.mascot-right{animation:m-bob-r 4.2s ease-in-out infinite .6s}',
            '@keyframes m-bob-l{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
            '@keyframes m-bob-r{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}',
            // Theme
            ':root{--m-c1:#60a5fa;--m-c1d:#3b82f6;--m-c2:#fbbf24;--m-c2d:#f59e0b;--m-face:#1e293b}',
            '.dark-mode{--m-c1:#7c8cf5;--m-c1d:#6366f1;--m-c2:#f59e0b;--m-c2d:#d97706;--m-face:#1e293b}',
            // Responsive
            '@media(max-width:1100px){.mascot{opacity:.5;transform:scale(.6)!important}}',
            '@media(max-width:700px){.mascot{display:none!important}}'
        ].join('');
        document.head.appendChild(s);
    }

    // ── Public API ────────────────────────────────────────────────

    window.initMascots = function () {
        injectCSS();

        var left = createChar('left');
        var right = createChar('right');
        document.body.appendChild(left.el);
        document.body.appendChild(right.el);
        instances.push(left, right);

        startBlink(left);
        startBlink(right);

        document.addEventListener('mousemove', function (e) {
            mxPx = e.clientX;
            myPx = e.clientY;
            mx = e.clientX / window.innerWidth;
            my = e.clientY / window.innerHeight;
        });

        update();
        hookFormFields();
    };

    window.setMascotMode = setMode;

})();
