/**
 * nav.js — QuickShare 统一导航栏
 *
 * 使用方法：在 <body> 顶部加 <div id="qs-nav"></div>，然后加载此脚本。
 * 脚本自动读取登录状态并渲染导航。
 */

'use strict';

(function () {
    const NAV_ITEMS = [
        { key: 'navHome',      label: '首页',    labelEn: 'Home',     href: 'index.html',  icon: 'fa-house',       alwaysShow: true },
        { key: 'navNetdisk',   label: '网盘',    labelEn: 'Drive',    href: 'netdisk.html', icon: 'fa-hard-drive',  loginRequired: true },
        { key: 'navPricing',   label: '定价',    labelEn: 'Pricing',  href: 'pricing.html', icon: 'fa-tags',        alwaysShow: true },
    ];

    function currentPage() {
        return location.pathname.split('/').pop() || 'index.html';
    }

    function isLoggedIn() {
        const token = localStorage.getItem('token');
        if (!token) return false;
        try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload.exp * 1000 > Date.now();
        } catch { return false; }
    }

    function getLang() {
        return localStorage.getItem('quickshare-lang') || 'zh';
    }

    function buildNav() {
        const loggedIn = isLoggedIn();
        const lang = getLang();
        const page = currentPage();

        const items = NAV_ITEMS.filter(item => item.alwaysShow || (item.loginRequired && loggedIn));

        const links = items.map(item => {
            const label = lang === 'zh' ? item.label : item.labelEn;
            const isActive = page === item.href;
            return `<a href="${item.href}" class="qs-nav-link${isActive ? ' qs-nav-active' : ''}" title="${label}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${label}</span>
            </a>`;
        }).join('');

        // Login / user indicator
        let authEl = '';
        if (!loggedIn) {
            authEl = `<a href="login.html" class="qs-nav-login">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>${lang === 'zh' ? '登录' : 'Login'}</span>
            </a>`;
        }

        return `<nav class="qs-nav">
            <a href="index.html" class="qs-nav-brand">QuickShare</a>
            <div class="qs-nav-links">${links}</div>
            ${authEl}
        </nav>`;
    }

    const CSS = `
        .qs-nav {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 52px;
            display: flex;
            align-items: center;
            gap: 0;
            padding: 0 20px;
            background: rgba(255,255,255,0.82);
            backdrop-filter: blur(14px);
            border-bottom: 1px solid rgba(226,232,240,0.7);
            z-index: 200;
            font-family: 'Outfit', sans-serif;
        }
        .dark-mode .qs-nav {
            background: rgba(15,23,42,0.88);
            border-bottom-color: rgba(51,65,85,0.7);
        }
        .qs-nav-brand {
            font-size: 1rem;
            font-weight: 700;
            color: var(--primary-dark, #0284c7);
            text-decoration: none;
            margin-right: 20px;
            letter-spacing: -0.5px;
            flex-shrink: 0;
        }
        .dark-mode .qs-nav-brand { color: var(--primary-light, #818cf8); }
        .qs-nav-links {
            display: flex;
            align-items: center;
            gap: 4px;
            flex: 1;
        }
        .qs-nav-link {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-sub, #64748b);
            text-decoration: none;
            transition: all 0.18s;
            white-space: nowrap;
        }
        .qs-nav-link i { font-size: 0.8rem; }
        .qs-nav-link:hover {
            background: rgba(14,165,233,0.1);
            color: var(--primary, #0ea5e9);
        }
        .dark-mode .qs-nav-link:hover {
            background: rgba(99,102,241,0.15);
            color: var(--primary-light, #818cf8);
        }
        .qs-nav-active {
            background: rgba(14,165,233,0.12);
            color: var(--primary-dark, #0284c7) !important;
            font-weight: 600;
        }
        .dark-mode .qs-nav-active {
            background: rgba(99,102,241,0.18);
            color: var(--primary-light, #818cf8) !important;
        }
        .qs-nav-login {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 16px;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
            color: white;
            background: var(--primary, #0ea5e9);
            text-decoration: none;
            transition: opacity 0.18s;
            flex-shrink: 0;
        }
        .qs-nav-login:hover { opacity: 0.88; }
        @media (max-width: 480px) {
            .qs-nav-link span { display: none; }
            .qs-nav-link { padding: 6px 9px; }
            .qs-nav-brand { margin-right: 8px; font-size: 0.9rem; }
        }
    `;

    function inject() {
        // Skip pages that have their own navigation (sidebar-based layouts)
        const page = currentPage();
        if (page === 'netdisk.html' || page === 'admin.html') {
            return;
        }

        // Inject CSS once
        if (!document.getElementById('qs-nav-style')) {
            const style = document.createElement('style');
            style.id = 'qs-nav-style';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        // Inject nav HTML
        let container = document.getElementById('qs-nav');
        if (!container) {
            container = document.createElement('div');
            container.id = 'qs-nav';
            document.body.insertBefore(container, document.body.firstChild);
        }
        container.innerHTML = buildNav();

        // Adjust body top padding to account for nav bar (52px)
        const bodyTopPad = parseInt(document.body.style.paddingTop || '0');
        if (bodyTopPad < 52) {
            document.body.style.paddingTop = '52px';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }

    // Re-render on auth change (login/logout)
    window.addEventListener('storage', (e) => {
        if (e.key === 'token') inject();
    });
})();
