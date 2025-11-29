/**
 * netdisk.js - 网盘页面核心逻辑
 * 使用统一的 theme.js 和 lang-switch.js
 */

// ================== 全局变量 ==================
let currentView = 'list';
let currentFolder = null;
let currentCategory = 'all';
let files = [];
let folders = [];
let folderPath = [];
let isMobile = window.innerWidth <= 768;

// 文件类型映射
const FILE_TYPE_MAP = {
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'svg': 'image', 'webp': 'image',
    'doc': 'document', 'docx': 'document', 'pdf': 'document', 'txt': 'document', 'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document',
    'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'mkv': 'video',
    'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio',
    'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive'
};

// ================== 侧边栏 ==================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}
// ================== 登录验证 ==================
function checkLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('share')) return true;

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) return false;

    try {
        const user = JSON.parse(userStr);
        if (!user.username) return false;

        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.nickname || user.username;
        return true;
    } catch (e) {
        return false;
    }
}

function handleLogout() {
    if (confirm(t('logoutConfirm'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}

// ================== 视图切换 ==================
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-brand-50', 'text-brand-600');
    });
    event.target.closest('.view-btn').classList.add('active', 'bg-brand-50', 'text-brand-600');

    if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('gridView').classList.add('hidden');
    } else {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.remove('hidden');
    }
    renderFiles();
}

function showCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active', 'bg-brand-50', 'text-brand-600');
        item.classList.add('text-text-sub');
    });
    event.currentTarget.classList.remove('text-text-sub');
    event.currentTarget.classList.add('active', 'bg-brand-50', 'text-brand-600');

    // 移动端关闭侧边栏
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }

    renderFiles();
}

// ================== 文件操作 ==================
function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return FILE_TYPE_MAP[ext] || 'other';
}

function getUserStorageKey() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user.username || 'default';
    return `uploadedFiles_${userId}_${window.location.host}`;
}

function saveFiles() {
    localStorage.setItem(getUserStorageKey(), JSON.stringify({ files, folders }));
}

async function loadFiles() {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        files = [];
        folders = [];
        renderFiles();
        return;
    }

    try {
        // 加载文件夹
        const foldersResponse = await fetch(`${API_BASE}/folders`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const foldersResult = await foldersResponse.json();

        if (foldersResult.code === 401) {
            alert(t('loginExpired'));
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        if (foldersResult.code === 200 && foldersResult.data) {
            folders = foldersResult.data;
        } else {
            folders = [];
        }

        // 加载文件
        let filesUrl = `${API_BASE}/files`;
        if (currentFolder !== null) filesUrl += `?folderId=${currentFolder}`;

        const response = await fetch(filesUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.code === 401) {
            alert(t('loginExpired'));
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        if (result.code === 200 && result.data) {
            let allData = result.data;
            allData.forEach(item => {
                if (item.isFolder === 1 || item.fileType === 'folder') {
                    item.name = item.originalName || item.fileName;
                    if (!folders.find(f => f.id === item.id)) folders.push(item);
                }
            });
            files = allData.filter(item => item.isFolder !== 1 && item.fileType !== 'folder');
            files.forEach(file => {
                if (!file.type) file.type = getFileType(file.originalName || file.fileName || file.name);
            });
            saveFiles();
            renderFiles();
        } else {
            throw new Error(result.message || '加载失败');
        }
    } catch (error) {
        console.error('加载文件失败:', error);
        const saved = localStorage.getItem(getUserStorageKey());
        if (saved) {
            const savedData = JSON.parse(saved);
            files = savedData.files || [];
            folders = savedData.folders || [];
            files.forEach(file => {
                if (!file.type) file.type = getFileType(file.originalName || file.fileName || file.name);
            });
        } else {
            files = [];
            folders = [];
        }
        renderFiles();
    }
}



// ================== 文件夹操作 ==================
async function createFolder() {
    const name = prompt(t('enterFolderName'));
    if (!name || !name.trim()) return;

    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        alert(t('loginRequired'));
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: name.trim(), parentId: currentFolder })
        });
        const result = await response.json();

        if (result.code === 200) {
            alert('✅ ' + t('folderCreateSuccess'));
            loadFiles();
        } else if (result.code === 401) {
            alert(t('loginExpired'));
            localStorage.clear();
            window.location.href = 'login.html';
        } else {
            throw new Error(result.message || t('folderCreateFailed'));
        }
    } catch (error) {
        alert('❌ ' + t('folderCreateFailed') + '\n' + error.message);
    }
}

function openFolder(folderId, folderName) {
    currentFolder = folderId;
    folderPath.push({ id: folderId, name: folderName });
    currentCategory = 'all';

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active', 'bg-brand-50', 'text-brand-600');
        item.classList.add('text-text-sub');
    });
    document.querySelector('.sidebar-item').classList.remove('text-text-sub');
    document.querySelector('.sidebar-item').classList.add('active', 'bg-brand-50', 'text-brand-600');

    // 移动端关闭侧边栏
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-overlay');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }

    loadFiles();
}

function navigateToFolderByIndex(index) {
    if (index < folderPath.length - 1) {
        folderPath = folderPath.slice(0, index + 1);
        currentFolder = folderPath[index].id;
    } else {
        return;
    }
    currentCategory = 'all';
    loadFiles();
}

function navigateToFolder(folderId) {
    if (folderId === 0 || folderId === null) {
        currentFolder = null;
        folderPath = [];
        currentCategory = 'all';

        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active', 'bg-brand-50', 'text-brand-600');
            item.classList.add('text-text-sub');
        });
        document.querySelector('.sidebar-item').classList.remove('text-text-sub');
        document.querySelector('.sidebar-item').classList.add('active', 'bg-brand-50', 'text-brand-600');
    }
    loadFiles();
}

async function renameFolder(folderId, oldName) {
    const newName = prompt(t('enterNewName'), oldName);
    if (!newName || newName === oldName) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/folders/${folderId}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName })
        });
        const result = await res.json();

        if (result.code === 200) {
            alert('✅ ' + t('renameSuccess'));
            loadFiles();
        } else {
            alert('❌ ' + t('renameFailed') + ': ' + result.message);
        }
    } catch (e) {
        alert('❌ ' + t('renameFailed') + ': ' + e.message);
    }
}

async function deleteFolder(folderId, folderName) {
    if (!confirm(`${t('confirmDelete')}: ${folderName}?`)) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/folders/${folderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 404) {
            alert('该文件夹不存在或已被删除，即将刷新列表');
            loadFiles();
            return;
        }

        const result = await res.json();
        if (result.code === 200) {
            alert('✅ ' + t('deleteSuccess'));
            loadFiles();
        } else {
            alert('❌ ' + t('deleteFailed') + ': ' + (result.message || '未知错误'));
        }
    } catch (e) {
        alert('❌ ' + t('deleteFailed') + ': ' + e.message);
    }
}

// ================== 文件操作 ==================
async function shareFile(index) {
    const file = files[index];
    const token = localStorage.getItem('token');

    if (!token) {
        alert(t('loginRequired'));
        window.location.href = 'login.html';
        return;
    }

    const expireDays = prompt(t('setValidDays'), '7');
    if (!expireDays) return;

    const extractCode = prompt(t('setExtractCode'), '');

    try {
        const response = await fetch(`${API_BASE}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fileId: file.id,
                validDays: parseInt(expireDays),
                extractCode: extractCode || null
            })
        });
        const result = await response.json();

        if (result.code === 200) {
            let shareUrl = `${window.location.protocol}//${window.location.host}/index.html?share=${result.data.shareCode}`;
            if (result.data.extractCode) shareUrl += `&code=${result.data.extractCode}`;
            copyToClipboard(shareUrl);
            const lang = getCurrentLanguage();
            const codeText = lang === 'zh' ? '提取码' : 'Code';
            const noneText = lang === 'zh' ? '无' : 'None';
            alert(`✅ ${t('linkCopied')}\n${codeText}: ${result.data.extractCode || noneText}`);
        } else {
            alert('❌ ' + t('shareFailed') + ': ' + result.message);
        }
    } catch (error) {
        alert('❌ ' + t('shareFailed') + ': ' + error.message);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
    } catch (e) {
        const lang = getCurrentLanguage();
        alert((lang === 'zh' ? '复制失败，请手动复制:\n' : 'Copy failed, please copy manually:\n') + text);
    }
    document.body.removeChild(ta);
}

async function deleteFile(index) {
    const file = files[index];
    if (!confirm(`${t('confirmDelete')}: ${file.originalName || file.fileName}?`)) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/files/${file.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.code === 200) {
            files.splice(index, 1);
            saveFiles();
            renderFiles();
            alert('✅ ' + t('deleteSuccess'));
        } else {
            alert('❌ ' + t('deleteFailed') + ': ' + result.message);
        }
    } catch (e) {
        alert('❌ ' + t('deleteFailed') + ': ' + e.message);
    }
}

async function renameFile(index) {
    const file = files[index];
    const oldName = file.originalName || file.fileName;
    const newName = prompt(t('enterNewName'), oldName);

    if (!newName || newName === oldName) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE}/files/${file.id}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName })
        });
        const result = await res.json();

        if (result.code === 200) {
            if (file.originalName) file.originalName = newName;
            else file.fileName = newName;
            file.type = getFileType(newName);
            saveFiles();
            renderFiles();
            alert('✅ ' + t('renameSuccess'));
        } else {
            alert('❌ ' + t('renameFailed') + ': ' + result.message);
        }
    } catch (e) {
        alert('❌ ' + t('renameFailed') + ': ' + e.message);
    }
}

function sortFiles(sortBy) {
    if (sortBy === 'name') {
        folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        files.sort((a, b) => (a.originalName || a.fileName || '').localeCompare(b.originalName || b.fileName || ''));
    } else if (sortBy === 'time') {
        folders.sort((a, b) => new Date(b.createTime || b.createdAt || 0) - new Date(a.createTime || a.createdAt || 0));
        files.sort((a, b) => new Date(b.uploadTime || b.time) - new Date(a.uploadTime || a.time));
    } else if (sortBy === 'size') {
        folders.sort((a, b) => (b.fileCount || 0) - (a.fileCount || 0));
        files.sort((a, b) => (b.fileSize || b.size || 0) - (a.fileSize || a.size || 0));
    } else if (sortBy === 'type') {
        files.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    }
    renderFiles();
}

// ================== 工具函数 ==================
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const lang = getCurrentLanguage();
    return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================== 页面初始化 ==================
function initNetdisk() {
    // 检查登录
    if (!checkLogin()) {
        alert(t('loginRequired'));
        window.location.href = 'login.html';
        return;
    }

    // 加载文件
    loadFiles();
}

// ================== 搜索功能 ==================
let searchTimeout = null;

function handleSearch(event) {
    const keyword = event.target.value.trim().toLowerCase();

    // 防抖：延迟 300ms 执行搜索
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchFiles(keyword);
    }, 300);
}

function searchFiles(keyword) {
    if (!keyword) {
        // 关键词为空，显示当前文件夹的所有文件
        const currentViewTitle = document.getElementById('currentViewTitle');
        if (currentViewTitle) {
            currentViewTitle.textContent = t('foldersAndFiles');
        }
        renderFiles();
        return;
    }

    const listContent = document.getElementById('listContent');
    const gridView = document.getElementById('gridView');
    const emptyState = document.getElementById('emptyState');

    // 搜索所有文件和文件夹
    const matchedFolders = folders.filter(folder => {
        const name = (folder.name || '').toLowerCase();
        return name.includes(keyword);
    });

    const matchedFiles = files.filter(file => {
        const name = (file.originalName || file.fileName || '').toLowerCase();
        return name.includes(keyword);
    });

    // 按分类筛选
    let filteredFiles;
    let displayFolders;

    if (currentCategory === 'all') {
        filteredFiles = matchedFiles;
        displayFolders = matchedFolders;
    } else {
        filteredFiles = matchedFiles.filter(file => file.type === currentCategory);
        displayFolders = [];
    }

    const allItems = [...displayFolders, ...filteredFiles];

    // 更新标题显示搜索结果数量
    const currentViewTitle = document.getElementById('currentViewTitle');
    if (currentViewTitle) {
        const lang = getCurrentLanguage();
        currentViewTitle.textContent = lang === 'zh'
            ? `搜索结果: ${allItems.length} 项`
            : `Search Results: ${allItems.length} items`;
    }

    // 空状态处理
    if (allItems.length === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.add('hidden');

        const lang = getCurrentLanguage();
        emptyState.querySelector('h3').textContent = lang === 'zh' ? '未找到匹配的文件' : 'No matching files found';
        emptyState.querySelector('p').textContent = lang === 'zh' ? '尝试其他关键词' : 'Try different keywords';

        listContent.innerHTML = '';
        gridView.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('gridView').classList.add('hidden');
        renderListView(listContent, displayFolders, filteredFiles);
    } else {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.remove('hidden');
        renderGridView(gridView, displayFolders, filteredFiles);
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    const currentViewTitle = document.getElementById('currentViewTitle');
    if (currentViewTitle) {
        currentViewTitle.textContent = t('foldersAndFiles');
    }
    renderFiles();
}

// 页面加载
window.addEventListener('load', initNetdisk);

// ESC 关闭预览
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
});