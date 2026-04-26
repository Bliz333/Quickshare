/**
 * session.js - 当前登录会话辅助方法
 */

const QuickShareSession = (() => {
    function getToken() {
        return localStorage.getItem('token') || '';
    }

    function getStoredUser() {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch (error) {
            return {};
        }
    }

    function normalizeRole(role) {
        return typeof role === 'string' && role.trim()
            ? role.trim().toUpperCase()
            : 'USER';
    }

    function normalizeUser(user) {
        if (!user || typeof user !== 'object') {
            return {};
        }

        return {
            ...user,
            role: normalizeRole(user.role)
        };
    }

    function setUser(user) {
        const normalizedUser = normalizeUser(user);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        return normalizedUser;
    }

    function notifyServerLogout(token) {
        try {
            const url = `${API_BASE}/auth/logout`;
            const headers = token
                ? { 'Authorization': `Bearer ${token}` }
                : {};
            fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers
            }).catch(() => {});
        } catch (error) {
            // ignore logout transport failures during local session cleanup
        }
    }

    function clear() {
        const token = getToken();
        notifyServerLogout(token);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    function hasAdminRole(user) {
        return !!user && normalizeRole(user.role) === 'ADMIN';
    }

    async function fetchProfile() {
        const token = getToken();
        if (!token) {
            return null;
        }

        const response = await fetch(`${API_BASE}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const rawText = await response.text();
        let result = null;

        if (rawText) {
            try {
                result = JSON.parse(rawText);
            } catch (error) {
                result = null;
            }
        }

        if (response.status === 401 || result?.code === 401) {
            clear();
            return null;
        }

        if (!response.ok || !result || result.code !== 200 || !result.data) {
            throw new Error(result?.message || 'Failed to load current profile');
        }

        return setUser(result.data);
    }

    async function fetchAdminConsoleAccess() {
        const token = getToken();
        const user = getStoredUser();
        if (!token || !hasAdminRole(user)) {
            throw new Error('Admin access required');
        }

        const response = await fetch(`${API_BASE}/admin/settings/admin-console`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        if (!response.ok || result?.code !== 200 || !result.data?.entryPath) {
            throw new Error(result?.message || 'Failed to resolve admin console path');
        }

        return result.data;
    }

    async function openAdminConsole() {
        const access = await fetchAdminConsoleAccess();
        window.location.href = access.entryPath;
    }

    return {
        clear,
        fetchAdminConsoleAccess,
        fetchProfile,
        getStoredUser,
        getToken,
        hasAdminRole,
        normalizeRole,
        normalizeUser,
        openAdminConsole,
        setUser
    };
})();

window.QuickShareSession = QuickShareSession;
window.openAdminConsole = async function() {
    await QuickShareSession.openAdminConsole();
};
