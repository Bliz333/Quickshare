/**
 * auth.js - 登录状态管理
 */

/**
 * 检查并更新登录状态显示
 */
function hasAdminRole(user) {
    return !!user && typeof user.role === 'string' && user.role.toUpperCase() === 'ADMIN';
}

function renderLoggedInState(user) {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    const logoutText = lang === 'zh' ? '退出' : 'Logout';
    const netdiskText = lang === 'zh' ? '网盘主页' : 'My Netdisk';
    const upgradeText = lang === 'zh' ? '升级套餐' : 'Upgrade';
    const authButtons = document.getElementById('authButtons');

    if (!authButtons) {
        return;
    }

    const driveUrl = pageUrl('netdisk.html');
    const pricingUrl = pageUrl('pricing.html');
    authButtons.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; flex-wrap: wrap; justify-content: center;">
            <button onclick="location.href='${driveUrl}'" class="btn-auth btn-register" style="padding: 8px 20px;">
                <i class="fa-solid fa-hard-drive"></i> ${netdiskText}
            </button>
            <button onclick="location.href='${pricingUrl}'" class="btn-auth btn-login" style="padding: 8px 20px;">
                <i class="fa-solid fa-tags"></i> ${upgradeText}
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

function pageUrl(page) {
    return window.QuickShareRoutes && typeof window.QuickShareRoutes.cleanPageUrl === 'function'
        ? window.QuickShareRoutes.cleanPageUrl(page)
        : page;
}

function buildAuthRedirectUrl(targetPage, redirectTarget) {
    const page = pageUrl(targetPage || 'login.html');
    const redirect = pageUrl(redirectTarget || 'netdisk.html');
    return page + '?redirect=' + encodeURIComponent(redirect);
}

function goToAuthForNetdisk() {
    if (BrowserSession.current().authenticated) {
        window.location.href = pageUrl('netdisk.html');
        return;
    }
    window.location.href = buildAuthRedirectUrl('login.html', 'netdisk.html');
}

async function checkLoginState() {
    const session = BrowserSession.current();

    if (session.authenticated) {
        renderLoggedInState(session.user);

        try {
            const freshUser = await BrowserSession.refresh();
            if (!freshUser?.username) {
                window.location.reload();
                return;
            }
            renderLoggedInState(freshUser);
        } catch (error) {
            console.warn('Failed to sync current profile on home page:', error);
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

    BrowserSession.signOut();
    location.reload();
}

async function openAdminConsole() {
    try {
        const result = await BrowserSession.request(`${API_BASE}/admin/settings/admin-console`);
        if (Number(result?.code) !== 200 || !result.data?.entryPath) {
            throw new Error(result?.message || 'Failed to resolve admin console path');
        }
        window.location.href = result.data.entryPath;
        return;
    } catch (error) {
        console.warn('Failed to open admin console:', error);
    }

    window.location.href = pageUrl('index.html');
}
