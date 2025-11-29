/**
 * auth.js - 登录状态管理
 */

/**
 * 检查并更新登录状态显示
 */
function checkLoginState() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (token && user.username) {
        const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
        const logoutText = lang === 'zh' ? '退出' : 'Logout';
        const netdiskText = lang === 'zh' ? '网盘主页' : 'My Netdisk';
        const authButtons = document.getElementById('authButtons');

        if (authButtons) {
            authButtons.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px; flex-wrap: wrap; justify-content: center;">
                    <button onclick="location.href='netdisk.html'" class="btn-auth btn-register" style="padding: 8px 20px;">
                        <i class="fa-solid fa-hard-drive"></i> ${netdiskText}
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
    }
}

/**
 * 处理用户退出登录
 */
function handleLogout() {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    if (confirm(lang === 'zh' ? '确定要退出登录吗?' : 'Logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        location.reload();
    }
}

/**
 * 获取当前用户的 Token
 * @returns {string} Token 或空字符串
 */
function getAuthToken() {
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
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return !!(token && user.username);
}