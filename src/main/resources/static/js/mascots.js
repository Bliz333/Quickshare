/**
 * mascots.js - Scene-aware mascot crew with richer pointer, click, and result reactions
 */

'use strict';

(function () {
    const CSS_ID = 'mc-css';
    const ROOT_ID = 'mc-root';
    const ACTIVE_SELECTOR = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[onclick]',
        '.tab',
        '.peer-card',
        '.share-cta-bar a',
        '.upload-area',
        '.pick-btn',
        '.copy-btn',
        '.action-btn',
        '.result-card-container',
        '.file-item'
    ].join(',');

    const COPY = {
        zh: {
            loginIdle: '输入账号密码登录',
            registerIdle: '注册后即可使用网盘',
            homeIdle: '选择设备开始传输',
            shareIdle: '拖入文件或点击上传',
            overHere: '点击这里',
            lookHere: '在这里输入',
            lookAway: '正在输入密码…',
            dropHere: '松手即可上传',
            launching: '正在提交…',
            uploadReady: '分享链接已生成',
            receiveReady: '文件已就绪',
            copyReady: '已复制到剪贴板',
            retry: '出错了，请重试',
            switchUpload: '切换到上传',
            switchDownload: '切换到下载',
            pairCode: '生成配对码连接设备',
            shareEntry: '点击发起文件分享',
            fileLookup: '输入提取码查询文件',
            loading: '处理中…',
            success: '操作成功',
            error: '操作失败，请重试',
            registerReady: '即将跳转到网盘',
            loginReady: '即将跳转到网盘'
        },
        en: {
            loginIdle: 'Enter credentials to sign in',
            registerIdle: 'Sign up for cloud storage',
            homeIdle: 'Select a device to transfer',
            shareIdle: 'Drag files or click to upload',
            overHere: 'Click here',
            lookHere: 'Type here',
            lookAway: 'Entering password…',
            dropHere: 'Release to upload',
            launching: 'Submitting…',
            uploadReady: 'Share link created',
            receiveReady: 'File ready to download',
            copyReady: 'Copied to clipboard',
            retry: 'Error — please retry',
            switchUpload: 'Switch to upload',
            switchDownload: 'Switch to download',
            pairCode: 'Generate pair code',
            shareEntry: 'Start sharing files',
            fileLookup: 'Enter code to find file',
            loading: 'Processing…',
            success: 'Done',
            error: 'Failed — try again',
            registerReady: 'Redirecting to drive',
            loginReady: 'Redirecting to drive'
        }
    };

    const BASE_LAYOUT = {
        orange: { x: 0.13, y: 0.97, size: 224, z: 42 },
        purple: { x: 0.21, y: 1.02, size: 156, z: 44 },
        black: { x: 0.79, y: 1.02, size: 118, z: 43 },
        yellow: { x: 0.88, y: 1.06, size: 144, z: 44 }
    };

    const SCENES = {
        login: {
            idleKey: 'loginIdle',
            idleBubble: true,
            bubbleLeader: 'purple',
            layout: BASE_LAYOUT
        },
        register: {
            idleKey: 'registerIdle',
            idleBubble: true,
            bubbleLeader: 'purple',
            layout: BASE_LAYOUT
        },
        home: {
            idleKey: 'homeIdle',
            idleBubble: false,
            bubbleLeader: 'yellow',
            layout: BASE_LAYOUT
        },
        share: {
            idleKey: 'shareIdle',
            idleBubble: false,
            bubbleLeader: 'yellow',
            layout: BASE_LAYOUT
        },
        default: {
            idleKey: 'homeIdle',
            idleBubble: false,
            bubbleLeader: 'purple',
            layout: BASE_LAYOUT
        }
    };

    const DEFS = [
        {
            id: 'orange',
            viewBox: '0 0 280 220',
            shadow: { cx: 140, cy: 208, rx: 92, ry: 17 },
            eyeL: { cx: 110, cy: 126, er: 12, pr: 4.4 },
            eyeR: { cx: 174, cy: 126, er: 12, pr: 4.4 },
            browL: { x1: 95, y1: 106, x2: 123, y2: 107 },
            browR: { x1: 161, y1: 107, x2: 189, y2: 106 },
            mouth: { x: 144, y: 160, w: 22 },
            cheekL: { cx: 94, cy: 152, r: 8 },
            cheekR: { cx: 194, cy: 152, r: 8 },
            arms: {
                left: {
                    ox: 63,
                    oy: 154,
                    path: 'M63 154 C28 156 20 187 40 204',
                    hand: { cx: 40, cy: 204, r: 9.5 }
                },
                right: {
                    ox: 218,
                    oy: 154,
                    path: 'M218 154 C252 156 260 187 240 204',
                    hand: { cx: 240, cy: 204, r: 9.5 }
                }
            },
            blinkBase: 2.2,
            personality: { curiosity: 0.42, reach: 0.48, sway: 0.7, bold: 0.45, seed: 0.2 },
            body: [
                '<path d="M32 220 V140 C32 79 78 38 140 38 C202 38 248 79 248 140 V220 Z" fill="var(--mc-orange)"/>',
                '<path d="M82 72 C98 60 121 53 144 53 C181 53 213 71 231 103 C213 84 186 73 153 73 C125 73 102 80 82 94 Z" fill="rgba(255,255,255,.15)"/>'
            ].join(''),
            idle: function (time) {
                const bob = Math.sin(time * 2.15 + 0.4);
                return {
                    ty: Math.abs(bob) * -8,
                    tx: Math.sin(time * 0.78 + 0.8) * 3,
                    rot: Math.sin(time * 0.95 + 0.2) * 1.3,
                    sx: 1 + bob * 0.018,
                    sy: 1 - bob * 0.022,
                    arm: Math.sin(time * 1.35 + 0.5) * 7
                };
            }
        },
        {
            id: 'purple',
            viewBox: '0 0 160 340',
            shadow: { cx: 80, cy: 326, rx: 48, ry: 15 },
            eyeL: { cx: 55, cy: 118, er: 9.8, pr: 3.8 },
            eyeR: { cx: 105, cy: 118, er: 9.8, pr: 3.8 },
            browL: { x1: 43, y1: 101, x2: 65, y2: 102 },
            browR: { x1: 95, y1: 102, x2: 117, y2: 101 },
            mouth: { x: 80, y: 154, w: 18 },
            cheekL: { cx: 41, cy: 145, r: 5.5 },
            cheekR: { cx: 119, cy: 145, r: 5.5 },
            arms: {
                left: {
                    ox: 29,
                    oy: 172,
                    path: 'M29 172 C4 174 -2 222 20 246',
                    hand: { cx: 20, cy: 246, r: 8 }
                },
                right: {
                    ox: 131,
                    oy: 172,
                    path: 'M131 172 C156 174 162 222 140 246',
                    hand: { cx: 140, cy: 246, r: 8 }
                }
            },
            blinkBase: 3.05,
            personality: { curiosity: 0.7, reach: 0.62, sway: 0.46, bold: 0.58, seed: 1.1 },
            body: [
                '<rect x="24" y="26" width="112" height="296" rx="38" fill="var(--mc-purple)"/>',
                '<path d="M44 48 C57 37 73 31 92 31 C112 31 123 35 132 42 V78 C121 64 107 58 87 58 C70 58 56 63 44 73 Z" fill="rgba(255,255,255,.16)"/>'
            ].join(''),
            idle: function (time) {
                const sway = Math.sin(time * 1.4 + 1.2);
                return {
                    ty: Math.sin(time * 1.3 + 0.5) * 5,
                    tx: sway * 2.4,
                    rot: Math.sin(time * 0.92 + 0.1) * 2.6,
                    sx: 1 + Math.sin(time * 1.05 + 0.8) * 0.01,
                    sy: 1 - Math.sin(time * 1.05 + 0.8) * 0.01,
                    arm: Math.sin(time * 1.7 + 0.4) * 5
                };
            }
        },
        {
            id: 'yellow',
            viewBox: '0 0 150 270',
            shadow: { cx: 75, cy: 258, rx: 44, ry: 14 },
            eyeL: { cx: 52, cy: 100, er: 8.7, pr: 3.4 },
            eyeR: { cx: 98, cy: 100, er: 8.7, pr: 3.4 },
            browL: { x1: 41, y1: 86, x2: 61, y2: 86.5 },
            browR: { x1: 89, y1: 86.5, x2: 109, y2: 86 },
            mouth: { x: 75, y: 136, w: 21 },
            cheekL: { cx: 38, cy: 124, r: 5.3 },
            cheekR: { cx: 112, cy: 124, r: 5.3 },
            arms: {
                left: {
                    ox: 25,
                    oy: 140,
                    path: 'M25 140 C4 142 2 183 20 205',
                    hand: { cx: 20, cy: 205, r: 7.5 }
                },
                right: {
                    ox: 125,
                    oy: 140,
                    path: 'M125 140 C146 142 148 183 130 205',
                    hand: { cx: 130, cy: 205, r: 7.5 }
                }
            },
            blinkBase: 1.9,
            personality: { curiosity: 0.74, reach: 0.72, sway: 0.56, bold: 0.62, seed: 2.4 },
            body: [
                '<rect x="18" y="32" width="114" height="224" rx="57" fill="var(--mc-yellow)"/>',
                '<path d="M46 49 C58 40 70 37 84 37 C102 37 116 46 124 60 C113 52 101 48 86 48 C69 48 57 53 46 64 Z" fill="rgba(255,255,255,.17)"/>'
            ].join(''),
            idle: function (time) {
                return {
                    ty: Math.sin(time * 1.58 + 1.8) * 5.5,
                    tx: Math.sin(time * 1.12 + 1.1) * 2.8,
                    rot: Math.sin(time * 0.86 + 2.4) * 3.3,
                    sx: 1 + Math.sin(time * 0.74 + 0.7) * 0.012,
                    sy: 1 - Math.sin(time * 0.74 + 0.7) * 0.012,
                    arm: Math.sin(time * 1.9 + 2.2) * 6.5
                };
            }
        },
        {
            id: 'black',
            viewBox: '0 0 120 300',
            shadow: { cx: 60, cy: 288, rx: 38, ry: 12 },
            eyeL: { cx: 40, cy: 104, er: 8.2, pr: 3.15 },
            eyeR: { cx: 80, cy: 104, er: 8.2, pr: 3.15 },
            browL: { x1: 30, y1: 90, x2: 48, y2: 90.4 },
            browR: { x1: 72, y1: 90.4, x2: 90, y2: 90 },
            mouth: { x: 60, y: 142, w: 15 },
            cheekL: { cx: 28, cy: 130, r: 4.6 },
            cheekR: { cx: 92, cy: 130, r: 4.6 },
            arms: {
                left: {
                    ox: 19,
                    oy: 158,
                    path: 'M19 158 C2 160 1 204 17 224',
                    hand: { cx: 17, cy: 224, r: 6.8 }
                },
                right: {
                    ox: 101,
                    oy: 158,
                    path: 'M101 158 C118 160 119 204 103 224',
                    hand: { cx: 103, cy: 224, r: 6.8 }
                }
            },
            blinkBase: 3.5,
            personality: { curiosity: 0.34, reach: 0.3, sway: 0.28, bold: 0.38, seed: 3.2 },
            body: [
                '<rect x="14" y="24" width="92" height="256" rx="32" fill="var(--mc-black)"/>',
                '<path d="M29 40 C40 31 49 28 63 28 C79 28 91 35 99 45 C88 39 78 36 65 36 C50 36 39 40 29 50 Z" fill="rgba(255,255,255,.14)"/>'
            ].join(''),
            idle: function (time) {
                return {
                    ty: Math.sin(time * 1.06 + 2.5) * 3.6,
                    tx: Math.sin(time * 0.82 + 1.5) * 2.2,
                    rot: Math.sin(time * 0.62 + 1.8) * 2.1,
                    sx: 1 + Math.sin(time * 0.86 + 0.2) * 0.008,
                    sy: 1 - Math.sin(time * 0.86 + 0.2) * 0.008,
                    arm: Math.sin(time * 1.08 + 3.1) * 3.5
                };
            }
        }
    ];

    const state = {
        initialized: false,
        sceneKey: 'default',
        pointer: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.62, active: false },
        hoverTarget: null,
        focusTarget: null,
        focusType: '',
        dragTarget: null,
        burst: null,
        lastActionTarget: null,
        message: { text: '', until: 0 },
        aim: { x: 0, y: 0, width: 0, height: 0, ready: false },
        reducedMotion: false,
        chars: [],
        root: null,
        glow: null,
        bubble: null,
        bubbleText: null,
        pulses: null,
        raf: 0,
        observers: []
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(from, to, alpha) {
        return from + (to - from) * alpha;
    }

    function nowSeconds() {
        return performance.now() / 1000;
    }

    function currentLang() {
        if (typeof getCurrentLanguage === 'function') {
            return getCurrentLanguage() === 'zh' ? 'zh' : 'en';
        }
        return document.documentElement.lang && document.documentElement.lang.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    }

    function copyFor(key) {
        const lang = currentLang();
        return (COPY[lang] && COPY[lang][key]) || COPY.en[key] || '';
    }

    function detectScene() {
        const explicit = document.body && document.body.getAttribute('data-mascot-scene');
        if (explicit && SCENES[explicit]) {
            return explicit;
        }

        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (file === 'login.html') return 'login';
        if (file === 'register.html') return 'register';
        if (file === 'share.html' || file === 'transfer-share.html') return 'share';
        if (file === 'index.html' || file === '') return 'home';
        return 'default';
    }

    function buildSvg(def) {
        const left = def.eyeL;
        const right = def.eyeR;
        const armLeft = def.arms.left;
        const armRight = def.arms.right;
        return [
            '<svg viewBox="', def.viewBox, '" class="mc-svg" preserveAspectRatio="xMidYMax meet" style="overflow:visible">',
            '<ellipse class="mc-shadow" cx="', def.shadow.cx, '" cy="', def.shadow.cy, '" rx="', def.shadow.rx, '" ry="', def.shadow.ry, '"/>',
            '<g class="mc-rig">',
            '<g class="mc-arm mc-arm-left" data-ox="', armLeft.ox, '" data-oy="', armLeft.oy, '">',
            '<path class="mc-arm-stroke" d="', armLeft.path, '"/>',
            '<circle class="mc-hand" cx="', armLeft.hand.cx, '" cy="', armLeft.hand.cy, '" r="', armLeft.hand.r, '"/>',
            '</g>',
            '<g class="mc-body-g">', def.body, '</g>',
            '<g class="mc-face">',
            '<path class="mc-brow mc-brow-l" d="M', def.browL.x1, ' ', def.browL.y1, ' L', def.browL.x2, ' ', def.browL.y2, '"/>',
            '<path class="mc-brow mc-brow-r" d="M', def.browR.x1, ' ', def.browR.y1, ' L', def.browR.x2, ' ', def.browR.y2, '"/>',
            '<circle class="mc-blush" cx="', def.cheekL.cx, '" cy="', def.cheekL.cy, '" r="', def.cheekL.r, '"/>',
            '<circle class="mc-blush" cx="', def.cheekR.cx, '" cy="', def.cheekR.cy, '" r="', def.cheekR.r, '"/>',
            '<g class="mc-eye mc-eye-l" data-cx="', left.cx, '" data-cy="', left.cy, '" data-er="', left.er, '" data-pr="', left.pr, '">',
            '<ellipse class="mc-eye-white" cx="', left.cx, '" cy="', left.cy, '" rx="', left.er, '" ry="', left.er, '"/>',
            '<ellipse class="mc-pupil" cx="', left.cx, '" cy="', left.cy, '" rx="', left.pr, '" ry="', left.pr, '"/>',
            '</g>',
            '<g class="mc-eye mc-eye-r" data-cx="', right.cx, '" data-cy="', right.cy, '" data-er="', right.er, '" data-pr="', right.pr, '">',
            '<ellipse class="mc-eye-white" cx="', right.cx, '" cy="', right.cy, '" rx="', right.er, '" ry="', right.er, '"/>',
            '<ellipse class="mc-pupil" cx="', right.cx, '" cy="', right.cy, '" rx="', right.pr, '" ry="', right.pr, '"/>',
            '</g>',
            '<path class="mc-mouth" d="', mouthPath(def, { kind: 'flat', openness: 0.1 }), '"/>',
            '</g>',
            '<g class="mc-arm mc-arm-right" data-ox="', armRight.ox, '" data-oy="', armRight.oy, '">',
            '<path class="mc-arm-stroke" d="', armRight.path, '"/>',
            '<circle class="mc-hand" cx="', armRight.hand.cx, '" cy="', armRight.hand.cy, '" r="', armRight.hand.r, '"/>',
            '</g>',
            '</g>',
            '</svg>'
        ].join('');
    }

    function createChar(def) {
        const el = document.createElement('div');
        el.className = 'mc mc-' + def.id;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = buildSvg(def);

        var vbParts = def.viewBox.split(' ');
        var aspectRatio = Number(vbParts[3]) / Number(vbParts[2]);

        const eyes = Array.prototype.map.call(el.querySelectorAll('.mc-eye'), function (eye) {
            return {
                group: eye,
                sclera: eye.querySelector('.mc-eye-white'),
                pupil: eye.querySelector('.mc-pupil'),
                cx: Number(eye.getAttribute('data-cx')),
                cy: Number(eye.getAttribute('data-cy')),
                er: Number(eye.getAttribute('data-er')),
                pr: Number(eye.getAttribute('data-pr')),
                px: Number(eye.getAttribute('data-cx')),
                py: Number(eye.getAttribute('data-cy')),
                sx: 1,
                sy: 1
            };
        });

        const leftArm = el.querySelector('.mc-arm-left');
        const rightArm = el.querySelector('.mc-arm-right');
        if (leftArm) {
            leftArm.style.transformOrigin = leftArm.getAttribute('data-ox') + 'px ' + leftArm.getAttribute('data-oy') + 'px';
        }
        if (rightArm) {
            rightArm.style.transformOrigin = rightArm.getAttribute('data-ox') + 'px ' + rightArm.getAttribute('data-oy') + 'px';
        }

        return {
            def: def,
            el: el,
            aspectRatio: aspectRatio,
            svg: el.querySelector('.mc-svg'),
            rig: el.querySelector('.mc-rig'),
            body: el.querySelector('.mc-body-g'),
            shadow: el.querySelector('.mc-shadow'),
            mouth: el.querySelector('.mc-mouth'),
            browL: el.querySelector('.mc-brow-l'),
            browR: el.querySelector('.mc-brow-r'),
            blush: el.querySelectorAll('.mc-blush'),
            leftArm: leftArm,
            rightArm: rightArm,
            eyes: eyes,
            x: 0,
            y: 0,
            tx: 0,
            ty: 0,
            rot: 0,
            sx: 1,
            sy: 1,
            renderX: null,
            renderY: null,
            renderSize: null,
            renderRot: 0,
            renderSx: 1,
            renderSy: 1,
            renderLeftArm: 0,
            renderRightArm: 0,
            renderShadow: 1,
            vx: 0,
            vy: 0,
            vrot: 0,
            vsx: 0,
            vsy: 0,
            varmL: 0,
            varmR: 0,
            vshadow: 0,
            bubbleScore: 0,
            nextBlink: nowSeconds() + def.blinkBase * (0.5 + Math.random()),
            blinkStart: 0,
            blinkCount: 1
        };
    }

    function injectCss() {
        if (document.getElementById(CSS_ID)) return;

        const style = document.createElement('style');
        style.id = CSS_ID;
        style.textContent = [
            ':root{--mc-orange:#fb923c;--mc-purple:#7367f0;--mc-yellow:#f2df4b;--mc-black:#4a5063;--mc-face:#1e293b}',
            '.dark-mode{--mc-orange:#ff9557;--mc-purple:#8b7bff;--mc-yellow:#f0db4b;--mc-black:#cfd6e7;--mc-face:#111827}',
            '#mc-root{position:fixed;inset:0;z-index:36;pointer-events:none;overflow:hidden}',
            '#mc-root .mc-backdrop{position:absolute;inset:0;opacity:.96}',
            '#mc-root .mc-haze{position:absolute;left:-6%;right:-6%;bottom:-12%;height:42%;',
            'background:',
            'radial-gradient(ellipse at 50% 100%,rgba(59,130,246,.12),rgba(59,130,246,.06) 24%,transparent 64%),',
            'radial-gradient(ellipse at 20% 100%,rgba(251,146,60,.07),transparent 48%),',
            'radial-gradient(ellipse at 80% 100%,rgba(242,223,75,.08),transparent 48%);',
            'filter:blur(34px)}',
            '.dark-mode #mc-root .mc-haze{background:',
            'radial-gradient(ellipse at 50% 100%,rgba(124,140,245,.15),rgba(124,140,245,.07) 24%,transparent 64%),',
            'radial-gradient(ellipse at 20% 100%,rgba(249,115,22,.08),transparent 48%),',
            'radial-gradient(ellipse at 80% 100%,rgba(245,158,11,.08),transparent 48%)}',
            '#mc-root .mc-grid{position:absolute;inset:-12%;background-image:',
            'linear-gradient(rgba(59,130,246,.032) 1px,transparent 1px),',
            'linear-gradient(90deg,rgba(59,130,246,.032) 1px,transparent 1px);background-size:48px 48px;',
            'animation:mc-grid-drift 40s linear infinite;opacity:.52}',
            '.dark-mode #mc-root .mc-grid{background-image:linear-gradient(rgba(124,140,245,.042) 1px,transparent 1px),linear-gradient(90deg,rgba(124,140,245,.042) 1px,transparent 1px);opacity:.46}',
            '@keyframes mc-grid-drift{to{transform:translate(48px,32px)}}',
            '#mc-root .mc-target{position:absolute;z-index:8;border-radius:999px;filter:blur(36px);',
            'background:radial-gradient(circle,rgba(59,130,246,.25),rgba(59,130,246,.08) 45%,transparent 74%);opacity:0;',
            'transform:translate(-50%,-50%) scale(.88);transition:opacity .22s ease,transform .24s cubic-bezier(.22,1,.36,1)}',
            '.dark-mode #mc-root .mc-target{background:radial-gradient(circle,rgba(124,140,245,.26),rgba(124,140,245,.1) 45%,transparent 74%)}',
            '#mc-root .mc-pulses{position:absolute;inset:0;z-index:92}',
            '#mc-root .mc-pulse{position:absolute;left:0;top:0;width:16px;height:16px;border-radius:999px;border:2px solid rgba(59,130,246,.5);',
            'background:rgba(59,130,246,.08);transform:translate(-50%,-50%) scale(.45);animation:mc-pulse .72s cubic-bezier(.22,1,.36,1) forwards}',
            '.dark-mode #mc-root .mc-pulse{border-color:rgba(124,140,245,.56);background:rgba(124,140,245,.1)}',
            '.mc-pulse.success{border-color:rgba(16,185,129,.55);background:rgba(16,185,129,.12)}',
            '.mc-pulse.error{border-color:rgba(239,68,68,.55);background:rgba(239,68,68,.12)}',
            '.mc-pulse.warn{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.12)}',
            '@keyframes mc-pulse{0%{opacity:.95;transform:translate(-50%,-50%) scale(.32)}100%{opacity:0;transform:translate(-50%,-50%) scale(7.2)}}',
            '#mc-root .mc-bubble{position:absolute;z-index:96;left:0;top:0;min-width:156px;max-width:min(240px,40vw);padding:11px 14px;',
            'border-radius:18px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.76);backdrop-filter:blur(18px);',
            '-webkit-backdrop-filter:blur(18px);color:var(--text,#111827);box-shadow:0 18px 42px rgba(15,23,42,.12);',
            'transform:translate(-50%,-50%) scale(.92);opacity:0;transition:opacity .22s ease,transform .28s cubic-bezier(.22,1,.36,1)}',
            '.dark-mode #mc-root .mc-bubble{background:rgba(20,22,30,.78);border-color:rgba(255,255,255,.1);color:var(--text,#ececf1);box-shadow:0 20px 48px rgba(0,0,0,.35)}',
            '#mc-root .mc-bubble.show{opacity:1;transform:translate(-50%,-50%) scale(1)}',
            '#mc-root .mc-bubble span{display:block;font:600 .8rem/1.35 Outfit,system-ui,sans-serif;letter-spacing:-.01em}',
            '.mc{position:absolute;left:0;top:0;will-change:transform,opacity;filter:drop-shadow(0 16px 24px rgba(15,23,42,.1))}',
            '.dark-mode .mc{filter:drop-shadow(0 18px 28px rgba(0,0,0,.28))}',
            '.mc-svg{display:block;width:100%;height:auto;overflow:visible}',
            '.mc-rig,.mc-body-g{transform-box:fill-box;transform-origin:center bottom}',
            '.mc-shadow{fill:rgba(15,23,42,.12);transform-box:fill-box;transform-origin:center center}',
            '.dark-mode .mc-shadow{fill:rgba(0,0,0,.26)}',
            '.mc-arm-stroke{fill:none;stroke:var(--mc-face);stroke-width:8;stroke-linecap:round;stroke-linejoin:round;opacity:.94}',
            '.mc-hand{fill:var(--mc-face)}',
            '.mc-eye-white{fill:#fff;stroke:rgba(15,23,42,.07);stroke-width:1.3}',
            '.mc-pupil{fill:var(--mc-face)}',
            '.mc-brow{fill:none;stroke:var(--mc-face);stroke-width:4;stroke-linecap:round;opacity:.14;transition:opacity .18s ease}',
            '.mc-mouth{fill:none;stroke:var(--mc-face);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}',
            '.mc-blush{fill:rgba(239,68,68,.12);opacity:0;transition:opacity .2s ease}',
            '.dark-mode .mc-blush{fill:rgba(255,255,255,.1)}',
            '.mc-black .mc-arm-stroke{stroke:#a8b2c4;opacity:1}',
            '.mc-black .mc-hand{fill:#a8b2c4}',
            '.mc-black .mc-mouth{stroke:#a8b2c4}',
            '.mc-black .mc-brow{stroke:#a8b2c4}',
            '.dark-mode .mc-black .mc-arm-stroke{stroke:var(--mc-face)}',
            '.dark-mode .mc-black .mc-hand{fill:var(--mc-face)}',
            '.dark-mode .mc-black .mc-mouth{stroke:var(--mc-face)}',
            '.dark-mode .mc-black .mc-brow{stroke:var(--mc-face)}',
            '@media (max-width:880px),(max-height:720px){#mc-root{display:none!important}}',
            '@media (prefers-reduced-motion:reduce){#mc-root .mc-grid{animation:none}#mc-root .mc-bubble,#mc-root .mc-target{transition:none}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureRoot() {
        if (state.root) return;

        const root = document.createElement('div');
        root.id = ROOT_ID;
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div class="mc-backdrop">',
            '<div class="mc-grid"></div>',
            '<div class="mc-haze"></div>',
            '<div class="mc-target"></div>',
            '</div>',
            '<div class="mc-pulses"></div>',
            '<div class="mc-bubble"><span></span></div>'
        ].join('');

        document.body.appendChild(root);
        state.root = root;
        state.glow = root.querySelector('.mc-target');
        state.pulses = root.querySelector('.mc-pulses');
        state.bubble = root.querySelector('.mc-bubble');
        state.bubbleText = root.querySelector('.mc-bubble span');
    }

    function sceneConfig() {
        return SCENES[state.sceneKey] || SCENES.default;
    }

    function resolveScale() {
        const widthScale = clamp(window.innerWidth / 1440, 0.68, 1);
        const heightScale = clamp(window.innerHeight / 980, 0.74, 1);
        return Math.min(widthScale, heightScale);
    }

    function centerOf(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return null;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) return null;
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: Math.max(rect.width, 36),
            height: Math.max(rect.height, 36)
        };
    }

    function defaultTargetPoint() {
        const stage = document.querySelector('[data-mascot-stage]');
        const stageRect = centerOf(stage);
        if (stageRect) {
            return stageRect;
        }
        return {
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.55,
            width: 160,
            height: 160
        };
    }

    function interactiveTarget(node) {
        if (!node || !node.closest) return null;
        return node.closest(ACTIVE_SELECTOR);
    }

    function isLiveTarget(target) {
        if (!target || !document.documentElement.contains(target)) return false;
        const point = centerOf(target);
        return !!point;
    }

    function targetLabel(target) {
        if (!target) return '';

        if (target.id === 'homeCreatePairCodeBtn') return copyFor('pairCode');
        if (target.id === 'uploadArea') return copyFor('dropHere');
        if (target.id === 'uploadBtn' || target.id === 'loginBtn' || target.id === 'registerBtn') return copyFor('launching');
        if (target.id === 'downloadShareCode' || target.id === 'downloadExtractCode') return copyFor('fileLookup');
        if (target.closest && target.closest('.share-cta-bar')) return copyFor('shareEntry');
        if (target.classList && target.classList.contains('tab')) {
            return /download/i.test(target.textContent || '') ? copyFor('switchDownload') : copyFor('switchUpload');
        }

        const attr = target.getAttribute('aria-label') || target.getAttribute('title') || target.getAttribute('placeholder') || '';
        const text = (attr || target.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) {
            return text.length > 24 ? text.slice(0, 24) + '…' : text;
        }
        return copyFor('overHere');
    }

    function mouthPath(def, expression) {
        const mouth = def.mouth;
        const width = mouth.w;
        const x = mouth.x;
        const y = mouth.y;
        const openness = expression && expression.openness ? expression.openness : 0;

        if (!expression || expression.kind === 'flat') {
            return 'M' + (x - width) + ' ' + y + ' L' + (x + width) + ' ' + y;
        }
        if (expression.kind === 'smile') {
            const depth = 8 + openness * 6;
            return 'M' + (x - width) + ' ' + y + ' Q' + x + ' ' + (y + depth) + ' ' + (x + width) + ' ' + y;
        }
        if (expression.kind === 'frown') {
            const depth = 6 + openness * 6;
            return 'M' + (x - width) + ' ' + (y + 4) + ' Q' + x + ' ' + (y - depth) + ' ' + (x + width) + ' ' + (y + 4);
        }
        if (expression.kind === 'o') {
            const w = width * 0.58;
            const h = 5 + openness * 8;
            return [
                'M', x - w, ' ', y,
                'Q', x, ' ', y + h, ' ', x + w, ' ', y,
                'Q', x, ' ', y - h, ' ', x - w, ' ', y, ' Z'
            ].join('');
        }
        if (expression.kind === 'smirk') {
            return 'M' + (x - width * 0.9) + ' ' + (y + 2) + ' Q' + x + ' ' + (y + 2 + openness * 5) + ' ' + (x + width * 0.75) + ' ' + (y - 2);
        }
        return 'M' + (x - width) + ' ' + y + ' L' + (x + width) + ' ' + y;
    }

    function browPath(def, side, mood, amount) {
        const brow = side === 'left' ? def.browL : def.browR;
        const dir = side === 'left' ? -1 : 1;
        const lift = mood === 'curious' ? -7 - amount * 3 : mood === 'worry' ? -1 : mood === 'celebrate' ? -8 : mood === 'shy' ? -2 : 0;
        const tilt = mood === 'worry' ? dir * 4 : mood === 'curious' ? dir * -3 : mood === 'celebrate' ? dir * -1.2 : mood === 'shy' ? dir * 2 : dir * 0.6;
        return 'M' + brow.x1 + ' ' + (brow.y1 + lift) + ' L' + brow.x2 + ' ' + (brow.y2 + lift + tilt);
    }

    function blinkScale(char, time) {
        if (!char.blinkStart && time >= char.nextBlink) {
            char.blinkStart = time;
            char.blinkCount = char.def.id === 'yellow' && Math.random() < 0.34 ? 2 : 1;
        }

        if (!char.blinkStart) return 1;

        const cycle = 0.16;
        const gap = 0.14;
        const total = char.blinkCount * cycle + (char.blinkCount - 1) * gap;
        const elapsed = time - char.blinkStart;

        if (elapsed >= total) {
            char.blinkStart = 0;
            char.nextBlink = time + char.def.blinkBase + Math.random() * char.def.blinkBase * 0.6;
            return 1;
        }

        const unit = cycle + gap;
        const local = elapsed - Math.floor(elapsed / unit) * unit;
        if (local > cycle) return 1;
        if (local < cycle / 2) {
            return 1 - (local / (cycle / 2)) * 0.96;
        }
        return 0.04 + ((local - cycle / 2) / (cycle / 2)) * 0.96;
    }

    function burstExpired() {
        if (!state.burst) return true;
        return nowSeconds() > state.burst.startedAt + state.burst.duration;
    }

    function setMessage(text, duration) {
        if (!text) return;
        state.message.text = text;
        state.message.until = nowSeconds() + (duration || 1.6);
    }

    function pulseAt(point, variant) {
        if (!state.pulses || !point || state.reducedMotion) return;

        const el = document.createElement('div');
        el.className = 'mc-pulse ' + (variant || '');
        el.style.left = point.x + 'px';
        el.style.top = point.y + 'px';
        state.pulses.appendChild(el);
        window.setTimeout(function () {
            el.remove();
        }, 760);
    }

    function trigger(mode, options) {
        const opts = options || {};
        if ((mode === 'inspect' || mode === 'press') && state.burst && (state.burst.mode === 'success' || state.burst.mode === 'error' || state.burst.mode === 'loading')) {
            return;
        }
        const durationMap = {
            press: 0.55,
            hover: 0.8,
            inspect: 1.1,
            success: 1.65,
            error: 1.35,
            drag: 1.25,
            copy: 1.05,
            loading: 1.1
        };

        state.burst = {
            mode: mode,
            startedAt: nowSeconds(),
            duration: opts.duration || durationMap[mode] || 0.9,
            target: opts.target || state.lastActionTarget || null
        };

        if (opts.target) {
            state.lastActionTarget = opts.target;
        }
        if (opts.message) {
            setMessage(opts.message, Math.max(1.25, state.burst.duration));
        }

        const point = centerOf(state.burst.target) || defaultTargetPoint();
        if (mode === 'success') pulseAt(point, 'success');
        else if (mode === 'error') pulseAt(point, 'error');
        else if (mode === 'inspect') pulseAt(point, 'warn');
        else pulseAt(point, '');
    }

    function activeDirective() {
        if (state.burst && burstExpired()) {
            state.burst = null;
        }

        if (state.dragTarget) {
            return {
                mode: 'drag',
                target: state.dragTarget,
                point: centerOf(state.dragTarget) || defaultTargetPoint(),
                message: copyFor('dropHere')
            };
        }

        if (state.burst) {
            const point = centerOf(state.burst.target) || defaultTargetPoint();
            return {
                mode: state.burst.mode,
                target: state.burst.target,
                point: point,
                message: state.message.until > nowSeconds() ? state.message.text : ''
            };
        }

        if (state.focusTarget) {
            if (!isLiveTarget(state.focusTarget)) {
                state.focusTarget = null;
                state.focusType = '';
            }
        }

        if (state.focusTarget) {
            const point = centerOf(state.focusTarget) || defaultTargetPoint();
            return {
                mode: state.focusType === 'password' ? 'password' : 'focus',
                target: state.focusTarget,
                point: point,
                message: state.focusType === 'password' ? copyFor('lookAway') : copyFor('lookHere')
            };
        }

        if (state.hoverTarget) {
            if (!isLiveTarget(state.hoverTarget)) {
                state.hoverTarget = null;
            }
        }

        if (state.hoverTarget) {
            const point = centerOf(state.hoverTarget) || defaultTargetPoint();
            return {
                mode: 'hover',
                target: state.hoverTarget,
                point: point,
                message: shouldBubbleOnHover(state.hoverTarget) ? targetLabel(state.hoverTarget) : ''
            };
        }

        return {
            mode: 'idle',
            target: null,
            point: state.pointer.active ? {
                x: state.pointer.x,
                y: state.pointer.y,
                width: 140,
                height: 140
            } : defaultTargetPoint(),
            message: state.message.until > nowSeconds()
                ? state.message.text
                : (sceneConfig().idleBubble ? copyFor(sceneConfig().idleKey) : '')
        };
    }

    function updateGlow(directive) {
        if (!state.glow) return;
        const point = directive.point || defaultTargetPoint();
        const size = directive.mode === 'idle' ? 156 : directive.mode === 'success' ? 214 : directive.mode === 'drag' ? 206 : 182;
        state.glow.style.left = point.x + 'px';
        state.glow.style.top = point.y + 'px';
        state.glow.style.width = size + 'px';
        state.glow.style.height = size + 'px';
        state.glow.style.opacity = directive.mode === 'idle' ? (state.pointer.active ? '0.26' : '0.08') : '0.52';
        state.glow.style.transform = 'translate(-50%,-50%) scale(' + (directive.mode === 'success' ? '1.12' : directive.mode === 'drag' ? '1.06' : '1') + ')';
    }

    function leaderChar(directive) {
        const preferred = sceneConfig().bubbleLeader;
        const point = directive.point || defaultTargetPoint();
        let chosen = null;
        let score = -Infinity;

        state.chars.forEach(function (char) {
            const dx = point.x - char.x;
            const dy = point.y - char.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const prefer = char.def.id === preferred ? 12 : 0;
            const current = 1200 / dist + prefer + char.bubbleScore;
            if (current > score) {
                score = current;
                chosen = char;
            }
        });

        return chosen || state.chars[0];
    }

    function updateBubble(directive) {
        if (!state.bubble || !state.bubbleText) return;

        const text = directive.message || (directive.mode === 'idle' && sceneConfig().idleBubble ? copyFor(sceneConfig().idleKey) : '');
        const visible = !!text && !state.reducedMotion;

        state.bubbleText.textContent = text;
        if (!visible || !state.chars.length) {
            state.bubble.classList.remove('show');
            return;
        }

        const leader = leaderChar(directive);
        if (!leader) {
            state.bubble.classList.remove('show');
            return;
        }

        const bubbleWidth = Math.max(state.bubble.offsetWidth || 0, 180);
        const bubblePadding = bubbleWidth * 0.55;
        const leaderLeft = leader.x < window.innerWidth * 0.5;
        var bubbleX = clamp(
            leader.x + (leaderLeft ? 130 : -130),
            bubblePadding + 18,
            window.innerWidth - bubblePadding - 18
        );
        var bubbleY = clamp(leader.y - leader.size * leader.aspectRatio * 0.9, 50, window.innerHeight - 120);

        // Avoid overlapping other characters
        for (var bi = 0; bi < state.chars.length; bi++) {
            var other = state.chars[bi];
            if (other === leader) continue;
            var odx = Math.abs(bubbleX - other.x);
            var ody = bubbleY - (other.y - other.size * other.aspectRatio * 0.5);
            if (odx < other.size * 0.45 && Math.abs(ody) < other.size * other.aspectRatio * 0.35) {
                bubbleY = other.y - other.size * other.aspectRatio * 0.85;
            }
        }
        bubbleY = clamp(bubbleY, 50, window.innerHeight - 120);

        state.bubble.style.left = bubbleX + 'px';
        state.bubble.style.top = bubbleY + 'px';
        state.bubble.classList.add('show');
    }

    function shouldBubbleOnHover(target) {
        if (!target) return false;
        return target.id === 'uploadArea'
            || target.id === 'homeCreatePairCodeBtn'
            || (target.closest && target.closest('.share-cta-bar'));
    }

    function shouldPressBurst(target) {
        if (!target) return false;
        return target.id === 'uploadBtn'
            || target.id === 'loginBtn'
            || target.id === 'registerBtn'
            || target.id === 'uploadArea'
            || (target.closest && target.closest('.share-cta-bar'))
            || target.getAttribute('type') === 'submit';
    }

    function smoothDirectivePoint(directive) {
        const point = directive.point || defaultTargetPoint();
        const alpha = directive.mode === 'success'
            ? 0.24
            : directive.mode === 'drag'
                ? 0.22
                : directive.mode === 'focus' || directive.mode === 'password'
                    ? 0.2
                    : 0.16;

        if (!state.aim.ready) {
            state.aim.x = point.x;
            state.aim.y = point.y;
            state.aim.width = point.width || 140;
            state.aim.height = point.height || 140;
            state.aim.ready = true;
        } else {
            state.aim.x = lerp(state.aim.x, point.x, alpha);
            state.aim.y = lerp(state.aim.y, point.y, alpha);
            state.aim.width = lerp(state.aim.width, point.width || 140, alpha);
            state.aim.height = lerp(state.aim.height, point.height || 140, alpha);
        }

        return {
            x: state.aim.x,
            y: state.aim.y,
            width: state.aim.width,
            height: state.aim.height
        };
    }

    function springTo(char, key, velKey, target, stiffness, damping) {
        if (!Number.isFinite(char[key])) {
            char[key] = target;
            char[velKey] = 0;
            return target;
        }
        char[velKey] += (target - char[key]) * stiffness;
        char[velKey] *= damping;
        char[key] += char[velKey];
        return char[key];
    }

    function applyExpression(char, directive, pose, time) {
        const def = char.def;
        const point = directive.point || defaultTargetPoint();
        const dx = point.x - char.x;
        const dy = point.y - (char.y - char.size * 0.56);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attraction = clamp(1 - dist / Math.max(window.innerWidth * 0.7, 420), 0.12, 1);
        const focusX = clamp(dx / Math.max(char.size * 0.65, 120), -1, 1);
        const focusY = clamp(dy / Math.max(char.size * 0.62, 110), -1, 1);
        const mode = directive.mode;
        const personality = def.personality;
        let mouth = { kind: 'flat', openness: 0.12 };
        let browMood = 'neutral';
        let eyeWide = 1;
        let eyeOpen = 1;
        let glanceX = focusX;
        let glanceY = focusY;
        let blush = 0;
        let browOpacity = 0.14;

        if (mode === 'hover') {
            mouth = { kind: 'smirk', openness: 0.35 };
            browMood = 'curious';
            eyeWide = 1.05;
            glanceY *= 0.72;
            blush = 0.22;
            browOpacity = 0.42;
        } else if (mode === 'focus') {
            mouth = { kind: char.def.id === 'purple' || char.def.id === 'yellow' ? 'smile' : 'flat', openness: 0.3 };
            browMood = 'curious';
            eyeWide = 1.08;
            blush = 0.18;
            browOpacity = 0.52;
        } else if (mode === 'password') {
            mouth = { kind: 'flat', openness: 0.1 };
            browMood = 'shy';
            eyeWide = 0.97;
            eyeOpen = char.def.id === 'black' ? 0.18 : 0.72;
            glanceX = (char.x < point.x ? -0.72 : 0.72) * (char.def.id === 'black' ? 1 : 0.6);
            glanceY = -0.35;
            blush = 0.28;
            browOpacity = 0.48;
        } else if (mode === 'press') {
            mouth = { kind: 'o', openness: 0.44 };
            browMood = 'curious';
            eyeWide = 1.12;
            browOpacity = 0.56;
        } else if (mode === 'success') {
            mouth = { kind: 'smile', openness: 0.72 };
            browMood = 'celebrate';
            eyeWide = 1.12;
            eyeOpen = 1.08;
            blush = 0.3;
            glanceX = Math.sin(time * 3.2 + personality.seed) * 0.2;
            glanceY = -0.45;
            browOpacity = 0.6;
        } else if (mode === 'error') {
            mouth = { kind: 'frown', openness: 0.5 };
            browMood = 'worry';
            eyeWide = 0.92;
            eyeOpen = 0.78;
            glanceX = -focusX * 0.55;
            glanceY = -0.18;
            browOpacity = 0.62;
        } else if (mode === 'inspect' || mode === 'copy') {
            mouth = { kind: 'o', openness: 0.35 };
            browMood = 'curious';
            eyeWide = 1.09;
            browOpacity = 0.46;
        } else if (mode === 'drag') {
            mouth = { kind: 'smile', openness: 0.44 };
            browMood = 'curious';
            eyeWide = 1.06;
            eyeOpen = 1.02;
            glanceY = Math.min(glanceY, -0.1);
            browOpacity = 0.52;
        } else if (mode === 'loading') {
            mouth = { kind: 'flat', openness: 0.12 };
            browMood = 'curious';
            eyeWide = 1.02;
            browOpacity = 0.42;
        } else {
            mouth = { kind: attraction > 0.64 ? 'smirk' : 'flat', openness: attraction * 0.25 };
            browMood = attraction > 0.7 ? 'curious' : 'neutral';
            eyeWide = 1 + attraction * 0.05;
            eyeOpen = 1;
            browOpacity = 0.12 + attraction * 0.18;
        }

        if (char.mouth) {
            char.mouth.setAttribute('d', mouthPath(def, mouth));
        }
        if (char.browL) {
            char.browL.setAttribute('d', browPath(def, 'left', browMood, attraction));
            char.browL.style.opacity = String(browOpacity);
        }
        if (char.browR) {
            char.browR.setAttribute('d', browPath(def, 'right', browMood, attraction));
            char.browR.style.opacity = String(browOpacity);
        }

        const blink = blinkScale(char, time);
        for (let i = 0; i < char.eyes.length; i++) {
            const eye = char.eyes[i];
            const maxMoveX = eye.er - eye.pr - 2.1;
            const maxMoveY = Math.max(1.4, eye.er - eye.pr - 2.8);
            const targetPx = eye.cx + clamp(glanceX, -1, 1) * maxMoveX;
            const targetPy = eye.cy + clamp(glanceY, -1, 1) * maxMoveY;
            eye.px = lerp(eye.px, targetPx, 0.18);
            eye.py = lerp(eye.py, targetPy, 0.18);
            if (!Number.isFinite(eye.px)) eye.px = eye.cx;
            if (!Number.isFinite(eye.py)) eye.py = eye.cy;
            eye.sx = lerp(eye.sx, eyeWide, 0.14);
            eye.sy = lerp(eye.sy, Math.max(0.04, eyeOpen * blink), 0.14);
            // Direct ellipse attribute manipulation (no CSS group transform)
            eye.sclera.setAttribute('rx', (eye.er * eye.sx).toFixed(2));
            eye.sclera.setAttribute('ry', (eye.er * eye.sy).toFixed(2));
            var pupilCx = eye.cx + (eye.px - eye.cx) * eye.sx;
            var pupilCy = eye.cy + (eye.py - eye.cy) * eye.sy;
            eye.pupil.setAttribute('cx', pupilCx.toFixed(1));
            eye.pupil.setAttribute('cy', pupilCy.toFixed(1));
            eye.pupil.setAttribute('rx', (eye.pr * eye.sx).toFixed(2));
            eye.pupil.setAttribute('ry', (eye.pr * eye.sy).toFixed(2));
        }

        Array.prototype.forEach.call(char.blush, function (blushEl) {
            blushEl.style.opacity = String(blush);
        });

        pose.gazeX = glanceX;
        pose.gazeY = glanceY;
    }

    function computePose(char, directive, time, scale) {
        const cfg = sceneConfig().layout[char.def.id] || sceneConfig().layout.purple;
        const size = cfg.size * scale;
        const baseX = cfg.x * window.innerWidth;
        const baseY = cfg.y * window.innerHeight;
        const point = directive.point || defaultTargetPoint();
        const idle = char.def.idle(time);
        const dx = point.x - baseX;
        const dy = point.y - (baseY - size * 0.56);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const followX = clamp(dx / Math.max(160, size * 0.78), -1, 1);
        const followY = clamp(dy / Math.max(160, size * 0.72), -1, 1);
        const attention = clamp(1 - dist / Math.max(window.innerWidth * 0.72, 420), 0.12, 1);
        const personality = char.def.personality;

        let tx = idle.tx + followX * 3.4 * personality.curiosity;
        let ty = idle.ty;
        let rot = idle.rot + followX * 1.6 * personality.curiosity;
        let sx = idle.sx;
        let sy = idle.sy;
        let shadow = 1;
        let leftArm = -14 + idle.arm;
        let rightArm = 14 - idle.arm;
        let bubbleScore = 0.4;

        if (directive.mode === 'hover') {
            tx += followX * 12 * personality.reach;
            ty += -6 * attention;
            rot += followX * 7 * personality.bold;
            leftArm = point.x < baseX ? -56 - attention * 16 : -18 + idle.arm * 0.4;
            rightArm = point.x > baseX ? 56 + attention * 18 : 18 - idle.arm * 0.4;
            bubbleScore = attention * 1.4;
        } else if (directive.mode === 'focus') {
            tx += followX * 14 * personality.reach;
            ty += -8 * attention;
            rot += followX * 6.5 * personality.bold;
            sx += 0.01;
            sy -= 0.015;
            leftArm = -28 + followX * 12;
            rightArm = 28 + followX * 12;
            bubbleScore = 1.2;
        } else if (directive.mode === 'password') {
            tx += (baseX < point.x ? -1 : 1) * 10 * personality.curiosity;
            rot += (baseX < point.x ? -1 : 1) * 10 * (char.def.id === 'black' ? 1 : 0.5);
            ty += char.def.id === 'black' ? -4 : 0;
            sx -= 0.01;
            sy += 0.02;
            leftArm = -36;
            rightArm = 36;
            bubbleScore = 0.8;
        } else if (directive.mode === 'press') {
            const wave = Math.sin((time - state.burst.startedAt) * 14);
            tx += followX * 10;
            ty += -10 + wave * 4;
            rot += followX * 6;
            sx += 0.035;
            sy -= 0.06;
            leftArm = -46;
            rightArm = 46;
            shadow = 1.12;
            bubbleScore = 1;
        } else if (directive.mode === 'success') {
            const burstTime = time - state.burst.startedAt;
            const bounce = Math.abs(Math.sin(burstTime * 8.2 + personality.seed)) * (12 + personality.bold * 6);
            tx += Math.sin(burstTime * 5.8 + personality.seed) * 7;
            ty += -16 - bounce;
            rot += Math.sin(burstTime * 4.8 + personality.seed) * 8;
            sx += 0.03;
            sy -= 0.04;
            leftArm = -78 + Math.sin(burstTime * 7 + personality.seed) * 9;
            rightArm = 78 - Math.sin(burstTime * 7 + personality.seed) * 9;
            shadow = 0.82;
            bubbleScore = 1.6;
        } else if (directive.mode === 'error') {
            tx += -followX * 10;
            ty += -2;
            rot += -followX * 9;
            sx -= 0.016;
            sy += 0.03;
            leftArm = -6;
            rightArm = 6;
            bubbleScore = 0.9;
        } else if (directive.mode === 'inspect' || directive.mode === 'copy') {
            tx += followX * 9 * personality.reach;
            ty += -4;
            rot += followX * 5 * personality.bold;
            leftArm = point.x < baseX ? -48 : -18;
            rightArm = point.x > baseX ? 48 : 18;
            bubbleScore = 1.25;
        } else if (directive.mode === 'drag') {
            tx += followX * 14 * personality.reach;
            ty += -9 - Math.sin(time * 7 + personality.seed) * 4;
            rot += followX * 8;
            leftArm = -72 + Math.sin(time * 6 + personality.seed) * 8;
            rightArm = 72 - Math.sin(time * 6 + personality.seed) * 8;
            shadow = 0.84;
            bubbleScore = 1.3;
        } else if (directive.mode === 'loading') {
            tx += Math.sin((time - state.burst.startedAt) * 6 + personality.seed) * 4;
            ty += -3;
            rot += Math.sin((time - state.burst.startedAt) * 6 + personality.seed) * 3;
            bubbleScore = 1;
        } else {
            bubbleScore = directive.mode === 'idle' ? 0.5 : 1;
        }

        return {
            size: size,
            x: baseX + tx,
            y: baseY + ty,
            rot: rot,
            sx: sx,
            sy: sy,
            leftArm: leftArm,
            rightArm: rightArm,
            shadow: shadow,
            bubbleScore: bubbleScore,
            mode: directive.mode
        };
    }

    function applyPose(char, pose) {
        if (char.renderSize === null) {
            char.renderSize = pose.size;
            char.renderX = pose.x;
            char.renderY = pose.y;
            char.renderRot = pose.rot;
            char.renderSx = pose.sx;
            char.renderSy = pose.sy;
            char.renderLeftArm = pose.leftArm;
            char.renderRightArm = pose.rightArm;
            char.renderShadow = pose.shadow;
        }

        const posStiffness = pose.mode === 'success' || pose.mode === 'drag' ? 0.16 : 0.09;
        const posDamping = pose.mode === 'success' || pose.mode === 'drag' ? 0.78 : 0.76;
        const rotStiffness = pose.mode === 'success' ? 0.12 : 0.07;
        const rotDamping = pose.mode === 'success' ? 0.76 : 0.74;

        char.renderSize = lerp(char.renderSize, pose.size, 0.18);
        springTo(char, 'renderX', 'vx', pose.x, posStiffness, posDamping);
        springTo(char, 'renderY', 'vy', pose.y, posStiffness, posDamping);
        springTo(char, 'renderRot', 'vrot', pose.rot, rotStiffness, rotDamping);
        springTo(char, 'renderSx', 'vsx', pose.sx, 0.06, 0.72);
        springTo(char, 'renderSy', 'vsy', pose.sy, 0.06, 0.72);
        springTo(char, 'renderLeftArm', 'varmL', pose.leftArm, 0.07, 0.78);
        springTo(char, 'renderRightArm', 'varmR', pose.rightArm, 0.07, 0.78);
        springTo(char, 'renderShadow', 'vshadow', pose.shadow, 0.1, 0.68);

        char.size = char.renderSize;
        char.x = char.renderX;
        char.y = char.renderY;
        char.bubbleScore = lerp(char.bubbleScore, pose.bubbleScore, 0.18);

        char.el.style.width = char.renderSize.toFixed(1) + 'px';
        char.el.style.zIndex = String((sceneConfig().layout[char.def.id] || {}).z || 44);
        var actualHeight = char.renderSize * char.aspectRatio;
        char.el.style.transform = 'translate(' + (char.renderX - char.renderSize / 2).toFixed(1) + 'px,' + (char.renderY - actualHeight).toFixed(1) + 'px)';

        if (char.rig) {
            char.rig.style.transform = 'rotate(' + char.renderRot.toFixed(2) + 'deg) scale(' + char.renderSx.toFixed(4) + ',' + char.renderSy.toFixed(4) + ')';
        }
        if (char.body) {
            char.body.style.transform = 'translateY(0px)';
        }
        if (char.leftArm) {
            char.leftArm.style.transform = 'rotate(' + char.renderLeftArm.toFixed(2) + 'deg)';
        }
        if (char.rightArm) {
            char.rightArm.style.transform = 'rotate(' + char.renderRightArm.toFixed(2) + 'deg)';
        }
        if (char.shadow) {
            char.shadow.style.transform = 'scale(' + char.renderShadow.toFixed(3) + ',1)';
        }
    }

    function trackEvents() {
        document.addEventListener('mousemove', function (event) {
            state.pointer.x = event.clientX;
            state.pointer.y = event.clientY;
            state.pointer.active = true;
        }, { passive: true });

        document.addEventListener('mouseout', function (event) {
            if (event.relatedTarget) return;
            state.pointer.active = false;
            state.hoverTarget = null;
        });

        var hoverDebounce = 0;
        document.addEventListener('pointerover', function (event) {
            const target = interactiveTarget(event.target);
            if (!target) return;
            state.lastActionTarget = target;
            clearTimeout(hoverDebounce);
            if (target === state.hoverTarget) return;
            hoverDebounce = setTimeout(function () {
                state.hoverTarget = target;
            }, 70);
        }, true);

        document.addEventListener('pointerout', function (event) {
            clearTimeout(hoverDebounce);
            if (!state.hoverTarget) return;
            if (state.hoverTarget.contains(event.relatedTarget)) return;
            const leaving = interactiveTarget(event.target);
            if (leaving === state.hoverTarget) {
                state.hoverTarget = null;
            }
        }, true);

        document.addEventListener('focusin', function (event) {
            const target = event.target;
            if (!target || !target.matches || !target.matches('input,textarea,select')) return;
            state.focusTarget = target;
            state.lastActionTarget = target;
            if (target.type === 'password' || /password/i.test(target.id)) {
                state.focusType = 'password';
            } else {
                state.focusType = 'text';
            }
            setMessage(state.focusType === 'password' ? copyFor('lookAway') : copyFor('lookHere'), 1.8);
        }, true);

        document.addEventListener('focusout', function (event) {
            if (event.target === state.focusTarget) {
                state.focusTarget = null;
                state.focusType = '';
            }
        }, true);

        document.addEventListener('pointerdown', function (event) {
            const target = interactiveTarget(event.target);
            if (target) {
                state.lastActionTarget = target;
                if (shouldPressBurst(target)) {
                    trigger('press', { target: target, message: targetLabel(target), duration: 0.5 });
                } else {
                    pulseAt(centerOf(target) || { x: event.clientX, y: event.clientY }, '');
                }
            } else {
                pulseAt({ x: event.clientX, y: event.clientY }, '');
            }
        }, true);

        document.addEventListener('click', function (event) {
            const target = interactiveTarget(event.target);
            if (!target) return;
            if (target.id === 'homeCreatePairCodeBtn') {
                trigger('inspect', { target: target, message: copyFor('pairCode') });
                return;
            }
            if (target.id === 'uploadBtn' || target.id === 'loginBtn' || target.id === 'registerBtn') {
                trigger('loading', { target: target, message: target.id === 'loginBtn' ? copyFor('loginReady') : target.id === 'registerBtn' ? copyFor('registerReady') : copyFor('loading') });
                return;
            }
            if (target.id === 'uploadArea' || (target.closest && target.closest('.share-cta-bar'))) {
                setMessage(targetLabel(target), 1.1);
            }
        }, true);
    }

    function hookUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        ['dragenter', 'dragover'].forEach(function (evt) {
            uploadArea.addEventListener(evt, function () {
                state.dragTarget = uploadArea;
                setMessage(copyFor('dropHere'), 1.5);
            });
        });

        ['dragleave', 'drop'].forEach(function (evt) {
            uploadArea.addEventListener(evt, function () {
                state.dragTarget = null;
            });
        });

        uploadArea.addEventListener('drop', function () {
            trigger('success', { target: uploadArea, message: copyFor('dropHere'), duration: 1.15 });
        });
    }

    function observeVisibility(selector, onVisible) {
        const element = document.querySelector(selector);
        if (!element || typeof MutationObserver === 'undefined') return;
        let lastVisible = false;
        let lastTriggeredAt = 0;

        const observer = new MutationObserver(function () {
            const style = window.getComputedStyle(element);
            const visible = style.display !== 'none' && style.visibility !== 'hidden' && element.offsetWidth > 0 && element.offsetHeight > 0;
            const time = nowSeconds();
            const changedToVisible = visible && !lastVisible;
            const cooledDown = visible && time - lastTriggeredAt > 0.6;
            if (changedToVisible || cooledDown) {
                onVisible(element);
                lastTriggeredAt = time;
            }
            lastVisible = visible;
        });

        observer.observe(element, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style']
        });

        state.observers.push(observer);
    }

    function wrapFunctions() {
        if (typeof window.showToast === 'function' && !window.showToast.__mascotWrapped) {
            const originalToast = window.showToast;
            const wrappedToast = function (message, type) {
                const result = originalToast.apply(this, arguments);
                const normalized = String(message || '').toLowerCase();
                const loadingLike = /fetching|get|processing|logging|registering|获取|处理中|登录中|注册中/.test(normalized);
                const copyLike = /copied|copy|复制/.test(normalized);
                if (type === 'success' && loadingLike) {
                    trigger('loading', {
                        target: state.lastActionTarget,
                        message: message || copyFor('loading')
                    });
                } else if (type === 'success' && copyLike) {
                    trigger('copy', {
                        target: state.lastActionTarget,
                        message: message || copyFor('copyReady'),
                        duration: 0.95
                    });
                } else if (type === 'success') {
                    trigger('success', {
                        target: state.lastActionTarget,
                        message: message || copyFor('success')
                    });
                } else if (type === 'error') {
                    trigger('error', {
                        target: state.lastActionTarget,
                        message: message || copyFor('error')
                    });
                } else {
                    trigger('inspect', {
                        target: state.lastActionTarget,
                        message: message || copyFor('loading'),
                        duration: 0.95
                    });
                }
                return result;
            };
            wrappedToast.__mascotWrapped = true;
            window.showToast = wrappedToast;
        }

        if (typeof window.switchTab === 'function' && !window.switchTab.__mascotWrapped) {
            const originalSwitchTab = window.switchTab;
            const wrappedSwitchTab = function (tab) {
                const result = originalSwitchTab.apply(this, arguments);
                state.hoverTarget = null;
                if (!sceneConfig().idleBubble) {
                    state.message.until = 0;
                }
                return result;
            };
            wrappedSwitchTab.__mascotWrapped = true;
            window.switchTab = wrappedSwitchTab;
        }
    }

    function initSceneHooks() {
        hookUploadArea();

        observeVisibility('#resultBox', function (element) {
            if (!element.innerHTML.trim()) return;
            trigger('success', {
                target: element,
                message: copyFor('uploadReady'),
                duration: 1.55
            });
        });

        observeVisibility('#downloadInfo', function (element) {
            trigger('inspect', {
                target: element,
                message: copyFor('receiveReady'),
                duration: 1.25
            });
        });

        observeVisibility('.pair-code-show', function (element) {
            if (!element.classList.contains('visible')) return;
            trigger('inspect', {
                target: element,
                message: copyFor('pairCode'),
                duration: 1.15
            });
        });

        observeVisibility('#receiveModal', function (element) {
            trigger('success', {
                target: element,
                message: copyFor('receiveReady'),
                duration: 1.6
            });
        });
    }

    function tick() {
        const time = nowSeconds();
        const scale = resolveScale() * (state.reducedMotion ? 0.92 : 1);
        const directive = activeDirective();
        const smoothedDirective = {
            mode: directive.mode,
            target: directive.target,
            message: directive.message,
            point: smoothDirectivePoint(directive)
        };

        updateGlow(smoothedDirective);

        for (let i = 0; i < state.chars.length; i++) {
            const char = state.chars[i];
            const pose = computePose(char, smoothedDirective, time, scale);
            applyPose(char, pose);
            applyExpression(char, smoothedDirective, pose, time);
        }

        updateBubble(smoothedDirective);
        state.raf = window.requestAnimationFrame(tick);
    }

    function initCrew() {
        state.chars = DEFS.map(function (def) {
            const char = createChar(def);
            state.root.appendChild(char.el);
            return char;
        });
        if (state.pulses) state.root.appendChild(state.pulses);
        if (state.bubble) state.root.appendChild(state.bubble);
    }

    function initReducedMotion() {
        const media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        state.reducedMotion = !!(media && media.matches);
        if (media && media.addEventListener) {
            media.addEventListener('change', function (event) {
                state.reducedMotion = !!event.matches;
            });
        }
    }

    window.initMascots = function () {
        if (state.initialized || !document.body) return;

        state.sceneKey = detectScene();
        injectCss();
        ensureRoot();
        initReducedMotion();
        initCrew();
        wrapFunctions();
        trackEvents();
        initSceneHooks();
        state.initialized = true;
        state.raf = window.requestAnimationFrame(tick);
    };

    window.setMascotMode = function (mode, options) {
        const opts = options || {};
        if (mode === 'username' || mode === 'password') {
            state.focusTarget = opts.target || state.focusTarget || null;
            state.focusType = mode === 'password' ? 'password' : 'text';
            setMessage(mode === 'password' ? copyFor('lookAway') : copyFor('lookHere'), 1.4);
            return;
        }
        if (mode === 'cheer') {
            trigger('success', { target: opts.target || state.lastActionTarget, message: opts.message || copyFor('success') });
            return;
        }
        if (mode === 'toggle-pw') {
            trigger('inspect', { target: opts.target || state.lastActionTarget, message: copyFor('lookAway'), duration: 0.9 });
            return;
        }
        if (mode === 'idle') {
            state.focusTarget = null;
            state.focusType = '';
            state.dragTarget = null;
            state.burst = null;
            return;
        }
        trigger(mode, opts);
    };

    window.setMascotScene = function (sceneKey) {
        if (!state.initialized) return;
        if (SCENES[sceneKey]) {
            state.sceneKey = sceneKey;
        }
        // Reset interaction state for clean scene transition
        state.focusTarget = null;
        state.focusType = '';
        state.hoverTarget = null;
        state.dragTarget = null;
        state.burst = null;
        state.message = { text: '', until: 0 };
    };

    window.getMascotScene = function () {
        return state.sceneKey;
    };
})();
