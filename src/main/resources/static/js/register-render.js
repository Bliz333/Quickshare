/**
 * netdisk-render.js - 网盘页面渲染逻辑
 */

// ================== 文件图标配置 ==================
const FILE_ICONS = {
    image: { icon: 'fa-regular fa-image', color: 'text-green-500', bg: 'bg-green-500/10' },
    video: { icon: 'fa-solid fa-film', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    audio: { icon: 'fa-solid fa-music', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    pdf: { icon: 'fa-solid fa-file-pdf', color: 'text-red-500', bg: 'bg-red-500/10' },
    word: { icon: 'fa-solid fa-file-word', color: 'text-blue-600', bg: 'bg-blue-600/10' },
    excel: { icon: 'fa-solid fa-file-excel', color: 'text-green-600', bg: 'bg-green-600/10' },
    ppt: { icon: 'fa-solid fa-file-powerpoint', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    zip: { icon: 'fa-solid fa-file-zipper', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
    text: { icon: 'fa-solid fa-file-lines', color: 'text-gray-500', bg: 'bg-gray-500/10' },
    code: { icon: 'fa-solid fa-file-code', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    default: { icon: 'fa-regular fa-file', color: 'text-text-sub', bg: 'bg-gray-500/10' }
};

// 根据文件类型获取图标
function getFileIcon(file) {
    const fileType = file.fileType || file.type || '';
    const fileName = (file.originalName || file.fileName || '').toLowerCase();
    const ext = fileName.split('.').pop();

    if (fileType.startsWith('image/')) return FILE_ICONS.image;
    if (fileType.startsWith('video/')) return FILE_ICONS.video;
    if (fileType.startsWith('audio/')) return FILE_ICONS.audio;
    if (fileType === 'application/pdf' || ext === 'pdf') return FILE_ICONS.pdf;
    if (['doc', 'docx'].includes(ext)) return FILE_ICONS.word;
    if (['xls', 'xlsx'].includes(ext)) return FILE_ICONS.excel;
    if (['ppt', 'pptx'].includes(ext)) return FILE_ICONS.ppt;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FILE_ICONS.zip;
    if (['txt', 'md', 'rtf'].includes(ext)) return FILE_ICONS.text;
    if (['js', 'ts', 'html', 'css', 'json', 'xml', 'java', 'py', 'c', 'cpp', 'h'].includes(ext)) return FILE_ICONS.code;

    return FILE_ICONS.default;
}

// ================== 渲染文件列表 ==================
function renderFiles() {
    const listContent = document.getElementById('listContent');
    const gridView = document.getElementById('gridView');
    const emptyState = document.getElementById('emptyState');

    updateBreadcrumb();

    // 筛选当前文件夹的内容
    let currentFolders = folders.filter(folder => {
        const parentId = folder.parentId === undefined ? 0 : folder.parentId;
        const targetFolder = currentFolder === null ? 0 : currentFolder;
        return parentId === targetFolder;
    });

    let currentFiles = files.filter(file => {
        const folderId = file.folderId === undefined ? 0 : file.folderId;
        const targetFolder = currentFolder === null ? 0 : currentFolder;
        return folderId === targetFolder;
    });

    // 按分类筛选
    let filteredFiles;
    let displayFolders;

    if (currentCategory === 'all') {
        filteredFiles = currentFiles;
        displayFolders = currentFolders;
    } else {
        filteredFiles = currentFiles.filter(file => file.type === currentCategory);
        displayFolders = []; // 非"全部文件"分类时不显示文件夹
    }

    const allItems = [...displayFolders, ...filteredFiles];

    // 空状态处理
    if (allItems.length === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('gridView').classList.add('hidden');

        if (currentFolder === null && currentCategory === 'all') {
            emptyState.querySelector('h3').textContent = t('emptyStateTitle');
            emptyState.querySelector('p').textContent = t('emptyStateText');
        } else if (currentCategory !== 'all') {
            emptyState.querySelector('h3').textContent = t('emptyCategoryTitle');
            emptyState.querySelector('p').textContent = t('emptyCategoryText');
        } else {
            emptyState.querySelector('h3').textContent = t('emptyFolderTitle');
            emptyState.querySelector('p').textContent = t('emptyFolderText');
        }
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

function updateBreadcrumb() {
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    if (folderPath.length === 0) {
        breadcrumbPath.innerHTML = '';
    } else {
        breadcrumbPath.innerHTML = folderPath.map((folder, index) => {
            return `<i class="fa-solid fa-chevron-right text-xs mx-2 text-text-sub"></i>
                    <span class="hover:text-brand-600 cursor-pointer hover:underline" onclick="navigateToFolderByIndex(${index})">${folder.name}</span>`;
        }).join('');
    }
}

// ================== 列表视图渲染 ==================
function renderListView(container, currentFolders, filteredFiles) {
    let html = '';

    // 渲染文件夹
    currentFolders.forEach(folder => {
        const folderName = folder.name || '未命名文件夹';
        const safeName = folderName.replace(/'/g, "\\'");
        html += `
        <div class="group grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 border-b border-border hover:bg-brand-50/20 items-center transition-colors cursor-pointer tap-highlight-transparent">
            <div class="col-span-8 md:col-span-6 flex items-center gap-3" onclick="openFolder(${folder.id}, '${safeName}')">
                <div class="w-10 h-10 shrink-0 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <i class="fa-solid fa-folder text-lg"></i>
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-medium text-text-main group-hover:text-brand-600 truncate">${folderName}</p>
                    <p class="text-xs text-text-sub mt-0.5 md:hidden">${folder.fileCount || 0} ${t('items')}</p>
                </div>
            </div>
            <div class="hidden md:block col-span-2 text-sm text-text-sub">${folder.fileCount || 0} ${t('items')}</div>
            <div class="hidden md:block col-span-3 text-sm text-text-sub">${formatDate(folder.createTime || folder.createdAt)}</div>
            <div class="col-span-4 md:col-span-1 text-right flex justify-end items-center">
                <div class="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button class="p-2 text-text-sub hover:text-brand-600" title="${t('openBtn')}" onclick="event.stopPropagation(); openFolder(${folder.id}, '${safeName}')"><i class="fa-solid fa-folder-open"></i></button>
                    <button class="p-2 text-text-sub hover:text-brand-600" title="${t('renameBtn')}" onclick="event.stopPropagation(); renameFolder(${folder.id}, '${safeName}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="p-2 text-text-sub hover:text-red-600" title="${t('deleteBtn')}" onclick="event.stopPropagation(); deleteFolder(${folder.id}, '${safeName}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });

    // 渲染文件
    filteredFiles.forEach(file => {
        const originalIndex = files.indexOf(file);
        const fileName = file.originalName || file.fileName || file.name;
        const icon = getFileIcon(file);

        html += `
        <div class="group grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 border-b border-border hover:bg-brand-50/20 items-center transition-colors cursor-pointer tap-highlight-transparent" onclick="previewFile(${originalIndex})">
            <div class="col-span-8 md:col-span-6 flex items-center gap-3">
                <div class="w-10 h-10 shrink-0 rounded-lg ${icon.bg} flex items-center justify-center ${icon.color}">
                    <i class="${icon.icon} text-lg"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-text-main group-hover:text-brand-600 truncate">${fileName}</p>
                    <p class="text-xs text-text-sub mt-0.5 md:hidden flex items-center gap-2">
                        <span>${formatFileSize(file.fileSize || file.size)}</span>
                    </p>
                </div>
            </div>
            <div class="hidden md:block col-span-2 text-sm text-text-sub">${formatFileSize(file.fileSize || file.size)}</div>
            <div class="hidden md:block col-span-3 text-sm text-text-sub">${formatDate(file.uploadTime || file.time)}</div>
            <div class="col-span-4 md:col-span-1 text-right flex justify-end items-center">
                <div class="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-card/80 md:bg-transparent rounded-lg">
                    <button class="p-2 text-text-sub hover:text-brand-600" title="${t('shareBtn')}" onclick="event.stopPropagation(); shareFile(${originalIndex})"><i class="fa-solid fa-share-nodes"></i></button>
                    <button class="p-2 text-text-sub hover:text-brand-600" title="${t('downloadBtn')}" onclick="event.stopPropagation(); downloadFile(${originalIndex})"><i class="fa-solid fa-download"></i></button>
                    <button class="p-2 text-text-sub hover:text-brand-600" title="${t('renameBtn')}" onclick="event.stopPropagation(); renameFile(${originalIndex})"><i class="fa-solid fa-pen"></i></button>
                    <button class="p-2 text-text-sub hover:text-red-600" title="${t('deleteBtn')}" onclick="event.stopPropagation(); deleteFile(${originalIndex})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ================== 网格视图渲染 ==================
function renderGridView(container, currentFolders, filteredFiles) {
    let html = '';

    // 渲染文件夹
    currentFolders.forEach(folder => {
        const folderName = folder.name || '未命名文件夹';
        const safeName = folderName.replace(/'/g, "\\'");
        html += `
        <div class="group bg-card/80 backdrop-blur-sm border border-border hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 rounded-xl p-3 md:p-4 cursor-pointer transition-all relative" onclick="openFolder(${folder.id}, '${safeName}')">
            <div class="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                <button class="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-sm text-text-sub hover:text-brand-600 border border-border" onclick="event.stopPropagation(); renameFolder(${folder.id}, '${safeName}')"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button class="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-sm text-text-sub hover:text-red-600 border border-border" onclick="event.stopPropagation(); deleteFolder(${folder.id}, '${safeName}')"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
            <div class="w-full h-24 md:h-32 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-2 md:mb-3 text-yellow-400 group-hover:text-yellow-500 transition-colors">
                <i class="fa-solid fa-folder text-5xl md:text-7xl drop-shadow-sm"></i>
            </div>
            <p class="font-medium text-text-main truncate text-sm">${folderName}</p>
            <p class="text-xs text-text-sub mt-1">${folder.fileCount || 0} ${t('items')}</p>
        </div>`;
    });

    // 渲染文件
    filteredFiles.forEach(file => {
        const originalIndex = files.indexOf(file);
        const fileName = file.originalName || file.fileName || file.name;
        const icon = getFileIcon(file);

        html += `
        <div class="group bg-card/80 backdrop-blur-sm border border-border hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 rounded-xl p-3 md:p-4 cursor-pointer transition-all relative" onclick="previewFile(${originalIndex})">
            <div class="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                <button class="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-sm text-text-sub hover:text-brand-600 border border-border" onclick="event.stopPropagation(); shareFile(${originalIndex})"><i class="fa-solid fa-share-nodes text-[10px]"></i></button>
                <button class="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-sm text-text-sub hover:text-brand-600 border border-border" onclick="event.stopPropagation(); renameFile(${originalIndex})"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button class="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-sm text-text-sub hover:text-red-600 border border-border" onclick="event.stopPropagation(); deleteFile(${originalIndex})"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
            <div class="w-full h-24 md:h-32 rounded-lg ${icon.bg} flex items-center justify-center mb-2 md:mb-3 ${icon.color} group-hover:scale-105 transition-transform">
                <i class="${icon.icon} text-4xl md:text-5xl"></i>
            </div>
            <p class="font-medium text-text-main truncate text-sm">${fileName}</p>
            <p class="text-xs text-text-sub mt-1">${formatFileSize(file.fileSize || file.size)}</p>
        </div>`;
    });

    container.innerHTML = html;
}

// ================== 文件预览 ==================
async function previewFile(index) {
    const file = files[index];
    const token = localStorage.getItem('token');

    if (!token) {
        alert(t('loginRequired'));
        return;
    }

    const previewUrl = `${API_BASE}/files/${file.id}/preview?token=${encodeURIComponent(token)}&max_size=720`;
    const originalUrl = `${API_BASE}/files/${file.id}/preview?token=${encodeURIComponent(token)}`;
    const container = document.getElementById('previewContainer');
    const modal = document.getElementById('previewModal');

    container.innerHTML = '';
    const type = file.fileType || file.type || '';

    if (type.startsWith('image/')) {
        const btnText = t('viewOriginal');
        container.innerHTML = `
        <div class="relative inline-block">
            <img src="${previewUrl}" class="preview-image shadow-2xl" alt="${file.originalName || file.fileName}">
            <a href="${originalUrl}" target="_blank" onclick="event.stopPropagation()"
               class="absolute bottom-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md transition-all border border-white/10 flex items-center gap-2 decoration-0">
                <i class="fa-solid fa-expand"></i>
                <span>${btnText}</span>
            </a>
        </div>`;
    } else if (type.startsWith('video/')) {
        container.innerHTML = `<video class="preview-video" controls autoplay><source src="${originalUrl}"></video>`;
    } else if (type === 'application/pdf') {
        container.innerHTML = `<iframe src="${originalUrl}" class="preview-pdf" style="width:90vw;height:90vh;border:none;"></iframe>`;
    } else if (type === 'text/plain' || (file.originalName || '').endsWith('.txt')) {
        try {
            const res = await fetch(originalUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const text = await res.text();
            container.innerHTML = `<div class="preview-text">${escapeHtml(text)}</div>`;
        } catch (e) {
            alert(t('readFailed'));
            return;
        }
    } else {
        const icon = getFileIcon(file);
        container.innerHTML = `
        <div class="preview-unsupported">
            <div class="w-20 h-20 rounded-2xl ${icon.bg} flex items-center justify-center ${icon.color} mx-auto mb-4">
                <i class="${icon.icon} text-4xl"></i>
            </div>
            <h3 class="text-lg font-medium mb-2">${t('cannotPreview')}</h3>
            <p class="text-gray-400 mb-4">${file.originalName || file.fileName}</p>
            <button class="bg-brand-600 hover:bg-brand-700 text-white py-2.5 px-6 rounded-lg transition-colors" onclick="downloadFile(${index})">
                <i class="fa-solid fa-download mr-2"></i>${t('downloadBtn')}
            </button>
        </div>`;
    }

    modal.classList.add('active');
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
    const v = document.querySelector('video');
    if (v) v.pause();
}