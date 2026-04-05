/**
 * auth.js - 登录状态管理
 */

/**
 * 检查并更新登录状态显示
 */
function hasAdminRole(user) {
    if (window.QuickShareSession && typeof window.QuickShareSession.hasAdminRole === 'function') {
        return window.QuickShareSession.hasAdminRole(user);
    }
    return !!user && typeof user.role === 'string' && user.role.toUpperCase() === 'ADMIN';
}

function getStoredAuthUser() {
    if (window.QuickShareSession && typeof window.QuickShareSession.getStoredUser === 'function') {
        return window.QuickShareSession.getStoredUser();
    }

    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
        return {};
    }
}

function renderLoggedInState(user) {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    const logoutText = lang === 'zh' ? '退出' : 'Logout';
    const netdiskText = lang === 'zh' ? '网盘主页' : 'My Netdisk';
    const upgradeText = lang === 'zh' ? '升级套餐' : 'Upgrade';
    const transferText = lang === 'zh' ? '快传' : 'Quick Transfer';
    const authButtons = document.getElementById('authButtons');

    if (!authButtons) {
        return;
    }

    authButtons.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; flex-wrap: wrap; justify-content: center;">
            <button onclick="location.href='netdisk.html'" class="btn-auth btn-register" style="padding: 8px 20px;">
                <i class="fa-solid fa-hard-drive"></i> ${netdiskText}
            </button>
            <button onclick="location.href='pricing.html'" class="btn-auth btn-login" style="padding: 8px 20px;">
                <i class="fa-solid fa-tags"></i> ${upgradeText}
            </button>
            <button onclick="location.href='transfer.html'" class="btn-auth btn-login" style="padding: 8px 20px;">
                <i class="fa-solid fa-wifi"></i> ${transferText}
            </button>
            <div style="display:flex; align-items:center; gap:8px; background: rgba(255, 255, 255, 0.05); padding: 6px 12px; border-radius: 50px; border: 1px solid var(--glass-border);">
                <div style="width:30px; height:30px; background: linear-gradient(45deg, #6d28d9, #06b6d4); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size: 0.9rem;">
                    ${user.nickname ? user.nickname[0].toUpperCase() : user.username[0].toUpperCase()}
                </div>
                <span style="font-weight:500; font-size: 0.9rem;">${user.nickname || user.username}</span>
                <button onclick="handleLogout()" class="btn-auth btn-login" style="padding: 4px 12px; font-size: 0.75rem; margin-left: 4px;">
                    <i class="fa-solid fa-right-from-bracket"></i> ${logoutText}
                </button>
            </div>
        </div>
    `;
}

async function checkLoginState() {
    const token = localStorage.getItem('token');
    const user = getStoredAuthUser();

    if (token && user.username) {
        renderLoggedInState(user);

        if (window.QuickShareSession && typeof window.QuickShareSession.fetchProfile === 'function') {
            try {
                const freshUser = await window.QuickShareSession.fetchProfile();
                if (!freshUser || !freshUser.username) {
                    window.location.reload();
                    return;
                }
                renderLoggedInState(freshUser);
            } catch (error) {
                console.warn('Failed to sync current profile on home page:', error);
            }
        } else {
            renderLoggedInState(user);
        }
    }
}

/**
 * 处理用户退出登录
 */
async function handleLogout() {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    const confirmed = await showAppConfirm(lang === 'zh' ? '确定要退出登录吗?' : 'Logout?', {
        title: lang === 'zh' ? '退出登录' : 'Log Out',
        tone: 'danger',
        icon: 'fa-right-from-bracket',
        confirmText: lang === 'zh' ? '退出' : 'Log out'
    });

    if (!confirmed) {
        return;
    }

    if (window.QuickShareSession && typeof window.QuickShareSession.clear === 'function') {
        window.QuickShareSession.clear();
    } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    location.reload();
}

async function openAdminConsole() {
    try {
        if (window.QuickShareSession && typeof window.QuickShareSession.openAdminConsole === 'function') {
            await window.QuickShareSession.openAdminConsole();
            return;
        }
    } catch (error) {
        console.warn('Failed to open admin console:', error);
    }

    window.location.href = 'index.html';
}

/**
 * 获取当前用户的 Token
 * @returns {string} Token 或空字符串
 */
function getAuthToken() {
    if (window.QuickShareSession && typeof window.QuickShareSession.getToken === 'function') {
        return window.QuickShareSession.getToken();
    }
    return localStorage.getItem('token') || '';
}

/**
 * 获取认证请求头
 * @returns {Object} 包含 Authorization 的请求头对象
 */
function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * 检查用户是否已登录
 * @returns {boolean}
 */
function isLoggedIn() {
    const token = localStorage.getItem('token');
    const user = getStoredAuthUser();
    return !!(token && user.username);
}
