/**
 * theme.js - 主题切换（明/暗模式）
 * 与所有页面同步：index, login, register, netdisk
 */

// 存储键名
const THEME_STORAGE_KEY = 'quickshare-theme';

/**
 * 获取当前主题
 * @returns {'light' | 'dark'}
 */
function getCurrentTheme() {
    // 优先从 localStorage 读取
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
        return saved;
    }
    // 其次检测系统偏好
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    // 默认浅色
    return 'light';
}

/**
 * 设置主题
 * @param {'light' | 'dark'} theme
 */
function setTheme(theme) {
    const html = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
        html.classList.add('dark-mode');
        body.classList.add('dark-mode');
    } else {
        html.classList.remove('dark-mode');
        body.classList.remove('dark-mode');
    }

    // 保存到 localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // 更新按钮图标
    updateThemeButton(theme);
}

/**
 * 切换主题
 */
function toggleTheme() {
    const current = getCurrentTheme();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (typeof regenerateQRCodes === 'function') {
            setTimeout(regenerateQRCodes, 100);
    }
}

/**
 * 更新主题切换按钮的图标
 * @param {'light' | 'dark'} theme
 */
function updateThemeButton(theme) {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;

    if (theme === 'dark') {
        // 暗黑模式下显示太阳图标（点击切换到浅色）
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        btn.title = '切换到浅色模式';
    } else {
        // 浅色模式下显示月亮图标（点击切换到暗黑）
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        btn.title = '切换到暗黑模式';
    }
}

/**
 * 初始化主题（页面加载时调用）
 */
function initTheme() {
    const theme = getCurrentTheme();
    setTheme(theme);

    // 监听系统主题变化
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // 只有在用户没有手动设置过主题时才跟随系统
            if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

// 页面加载时立即初始化主题（防止闪烁）
// 这段代码会在 DOM 解析时立即执行
(function() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') {
        document.documentElement.classList.add('dark-mode');
    }
})();

// DOM 加载完成后初始化按钮
document.addEventListener('DOMContentLoaded', initTheme);