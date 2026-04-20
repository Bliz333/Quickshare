/**
 * transfer.js - 文件传输管理
 */

// ================== 初始化传输面板 HTML ==================
function initTransferPanel() {
    const panelHTML = `
    <div id="transferPanel" class="fixed top-16 right-4 w-80 md:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 hidden overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-border bg-page/50">
            <h3 class="font-semibold text-text-main flex items-center gap-2">
                <i class="fa-solid fa-arrow-right-arrow-left text-brand-500"></i>
                <span id="transferPanelTitle">${t('fileTransfer')}</span>
            </h3>
            <div class="flex items-center gap-2">
                <button onclick="clearCompletedTransfers()" class="text-xs text-text-sub hover:text-brand-500 transition-colors" id="clearCompletedBtn">
                    ${t('clearCompleted')}
                </button>
                <button onclick="toggleTransferPanel()" class="text-text-sub hover:text-text-main">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>

        <div id="transferList" class="max-h-80 overflow-y-auto">
            <div id="transferEmpty" class="py-12 text-center text-text-sub">
                <i class="fa-solid fa-inbox text-3xl mb-3 opacity-50"></i>
                <p class="text-sm">${t('noTransferTask')}</p>
            </div>
        </div>
    </div>

    <div id="transferOverlay" class="fixed inset-0 bg-black/20 z-40 hidden md:hidden" onclick="toggleTransferPanel()"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);
}

// ================== 传输管理器 ==================
const TransferManager = {
    tasks: [],
    controllers: new Map(),
    speedTrackers: new Map(), // 速度追踪器

    addTask(task) {
        // 初始化速度追踪
        this.speedTrackers.set(task.id, {
            lastLoaded: 0,
            lastTime: Date.now(),
            speed: 0
        });

        this.tasks.unshift(task);
        this.updateUI();
        return task.id;
    },

    updateTask(id, updates) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            // 计算速度
            if (updates.loaded !== undefined) {
                const tracker = this.speedTrackers.get(id);
                if (tracker) {
                    const now = Date.now();
                    const timeDiff = (now - tracker.lastTime) / 1000; // 秒

                    if (timeDiff >= 0.5) { // 每0.5秒更新一次速度
                        const loadedDiff = updates.loaded - tracker.lastLoaded;
                        tracker.speed = loadedDiff / timeDiff;
                        tracker.lastLoaded = updates.loaded;
                        tracker.lastTime = now;
                    }

                    updates.speed = tracker.speed;
                }
            }

            Object.assign(task, updates);
            this.updateUI();
        }
    },

    removeTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index > -1) {
            this.tasks.splice(index, 1);
            this.controllers.delete(id);
            this.speedTrackers.delete(id);
            this.updateUI();
        }
    },

    cancelTask(id) {
        const controller = this.controllers.get(id);
        if (controller) {
            if (typeof controller.abort === 'function') {
                controller.abort();
            } else if (controller.abort) {
                controller.abort();
            }
            this.controllers.delete(id);
        }

        const task = this.tasks.find(t => t.id === id);
        if (task && task.status === 'progress') {
            task.status = 'cancelled';
            this.updateUI();
        }
    },

    clearCompleted() {
        this.tasks = this.tasks.filter(t => t.status === 'progress');
        this.updateUI();
    },

    getActiveTasks() {
        return this.tasks.filter(t => t.status === 'progress');
    },

    getTotalProgress() {
        const active = this.getActiveTasks();
        if (active.length === 0) return 0;
        const total = active.reduce((sum, t) => sum + (t.progress || 0), 0);
        return Math.round(total / active.length);
    },

    updateUI() {
        this.renderList();
        this.updateProgressBar();
        this.updateCount();
    },

    renderList() {
        const container = document.getElementById('transferList');
        if (!container) return;

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div id="transferEmpty" class="py-12 text-center text-text-sub">
                    <i class="fa-solid fa-inbox text-3xl mb-3 opacity-50"></i>
                    <p class="text-sm">${t('noTransferTask')}</p>
                </div>
            `;
            return;
        }

        const html = this.tasks.map(task => {
            const isProgress = task.status === 'progress';
            const isSuccess = task.status === 'success';
            const isCancelled = task.status === 'cancelled';
            const isError = task.status === 'error';

            const statusIcon = isProgress ? 'fa-spinner fa-spin' :
                              isSuccess ? 'fa-check text-green-500' :
                              isCancelled ? 'fa-ban text-text-sub' :
                              'fa-xmark text-red-500';

            const typeIcon = task.type === 'upload' ? 'fa-arrow-up text-blue-500' : 'fa-arrow-down text-green-500';
            const typeBg = task.type === 'upload' ? 'bg-blue-500/10' : 'bg-green-500/10';

            // 格式化速度
            const speedText = task.speed ? formatSpeed(task.speed) : '';

            return `
            <div class="p-3 border-b border-border hover:bg-page/50 transition-colors ${isCancelled ? 'opacity-50' : ''}">
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg ${typeBg} flex items-center justify-center shrink-0">
                        <i class="fa-solid ${typeIcon} text-sm"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-text-main truncate">${escapeHtml(task.fileName)}</p>
                        <div class="flex items-center gap-2 mt-1">
                            ${isProgress ? `
                                <div class="flex-1 bg-page rounded-full h-1.5">
                                    <div class="bg-brand-500 h-1.5 rounded-full transition-all duration-300" style="width: ${task.progress}%"></div>
                                </div>
                                <span class="text-xs text-text-sub shrink-0">${task.progress}%</span>
                            ` : `
                                <span class="text-xs text-text-sub flex items-center gap-1">
                                    <i class="fa-solid ${statusIcon}"></i>
                                    ${isSuccess ? (task.type === 'upload' ? t('uploadSuccess') : t('downloadComplete')) :
                                      isCancelled ? t('transferCancelled') : t('transferFailed')}
                                </span>
                            `}
                        </div>
                        ${isProgress ? `
                            <div class="flex items-center justify-between mt-1">
                                <span class="text-xs text-text-sub">${formatFileSize(task.loaded)} / ${formatFileSize(task.total)}</span>
                                ${speedText ? `<span class="text-xs text-brand-500 font-medium">${speedText}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${isProgress ? `
                        <button onclick="TransferManager.cancelTask('${task.id}')" class="p-1 text-text-sub hover:text-red-500 transition-colors shrink-0">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    ` : ''}
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    },

    updateProgressBar() {
        const progressBar = document.getElementById('transferProgressBar');
        const progressWrap = document.getElementById('transferProgressWrap');
        if (!progressBar || !progressWrap) return;

        const active = this.getActiveTasks();

        if (active.length === 0) {
            progressBar.style.width = '0%';
            progressWrap.classList.add('hidden');
        } else {
            progressWrap.classList.remove('hidden');
            const progress = this.getTotalProgress();
            progressBar.style.width = progress + '%';
        }
    },

    updateCount() {
        const badge = document.getElementById('transferCount');
        const icon = document.getElementById('transferIcon');
        if (!badge) return;

        const active = this.getActiveTasks();
        const hasActive = active.length > 0;

        // 1. 处理角标数字
        if (hasActive) {
            badge.textContent = active.length;
        }

        // 2. 使用 requestAnimationFrame 确保 UI 渲染流畅（可选，但推荐）
        requestAnimationFrame(() => {
            if (hasActive) {
                // --- 有任务状态 ---

                // 角标：弹入
                // 如果你用 Tailwind，这里改为: badge.classList.remove('scale-0', 'opacity-0');
                badge.classList.add('is-visible');

                // 图标：放大
                // 如果你用 Tailwind，这里改为: icon && icon.classList.add('scale-125');
                if (icon) icon.classList.add('is-active');

            } else {
                // --- 无任务状态 ---

                // 角标：缩小并消失
                // 如果你用 Tailwind，这里改为: badge.classList.add('scale-0', 'opacity-0');
                badge.classList.remove('is-visible');

                // 图标：恢复原大小
                // 如果你用 Tailwind，这里改为: icon && icon.classList.remove('scale-125');
                if (icon) icon.classList.remove('is-active');
            }
        });
    },
};

// ================== 格式化速度 ==================
function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond <= 0) return '';

    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let unitIndex = 0;
    let speed = bytesPerSecond;

    while (speed >= 1024 && unitIndex < units.length - 1) {
        speed /= 1024;
        unitIndex++;
    }

    return speed.toFixed(1) + ' ' + units[unitIndex];
}

// ================== 传输面板控制 ==================
let transferPanelOpen = false;

function toggleTransferPanel() {
    const panel = document.getElementById('transferPanel');
    const overlay = document.getElementById('transferOverlay');

    if (!panel) return;

    transferPanelOpen = !transferPanelOpen;

    if (transferPanelOpen) {
        panel.classList.remove('hidden');
        overlay.classList.remove('hidden');
        updateTransferPanelText();
    } else {
        panel.classList.add('hidden');
        overlay.classList.add('hidden');
    }
}

function updateTransferPanelText() {
    const title = document.getElementById('transferPanelTitle');
    const clearBtn = document.getElementById('clearCompletedBtn');

    if (title) title.textContent = t('fileTransfer');
    if (clearBtn) clearBtn.textContent = t('clearCompleted');
}

function clearCompletedTransfers() {
    TransferManager.clearCompleted();
}

// ================== 带进度的下载 ==================
async function downloadFile(index) {
    const file = files[index];
    const token = localStorage.getItem('token');

    if (!token) {
        await showAppAlert(t('loginRequired'), {
            icon: 'fa-right-to-bracket'
        });
        window.location.href = 'login.html';
        return;
    }

    const fileName = file.originalName || file.fileName || 'download';
    const url = `${API_BASE}/files/${file.id}/download?token=${encodeURIComponent(token)}`;

    const taskId = 'dl_' + Date.now();
    const controller = new AbortController();

    // 确保 controller 正确存储
    TransferManager.controllers.set(taskId, controller);

    TransferManager.addTask({
        id: taskId,
        type: 'download',
        fileName: fileName,
        status: 'progress',
        progress: 0,
        loaded: 0,
        total: file.fileSize || file.size || 0,
        speed: 0
    });

    animateToTransferButton();

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            TransferManager.updateTask(taskId, { status: 'error' });
            await showAppAlert(t('loginExpired'), {
                tone: 'danger',
                icon: 'fa-user-clock'
            });
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error(t('downloadFailed'));

        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : (file.fileSize || file.size || 0);

        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            // 检查是否已取消
            const task = TransferManager.tasks.find(t => t.id === taskId);
            if (task && task.status === 'cancelled') {
                reader.cancel();
                throw new DOMException('Aborted', 'AbortError');
            }

            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            received += value.length;

            const progress = total > 0 ? Math.round((received / total) * 100) : 0;
            TransferManager.updateTask(taskId, {
                progress: progress,
                loaded: received,
                total: total
            });
        }

        const blob = new Blob(chunks);
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        TransferManager.updateTask(taskId, { status: 'success', progress: 100 });

    } catch (error) {
        if (error.name === 'AbortError') {
            // 已在 cancelTask 中处理状态
            console.log('下载已取消:', fileName);
        } else {
            TransferManager.updateTask(taskId, { status: 'error' });
            console.error('下载失败:', error);
        }
    } finally {
        TransferManager.controllers.delete(taskId);
    }
}

// ================== 带进度的上传 ==================
async function handleFileUpload(event) {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const token = localStorage.getItem('token');
    if (!token || token === 'test-token-12345') {
        await showAppAlert(t('loginRequired'), {
            icon: 'fa-right-to-bracket'
        });
        window.location.href = 'login.html';
        return;
    }

    for (const file of uploadedFiles) {
        const uploaded = await uploadSingleFile(file, token);
        if (uploaded && typeof loadFiles === 'function') {
            await loadFiles();
        }
    }

    event.target.value = '';
}
async function uploadSingleFile(file, token) {
    const taskId = 'ul_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    TransferManager.addTask({
        id: taskId,
        type: 'upload',
        fileName: file.name,
        status: 'progress',
        progress: 0,
        loaded: 0,
        total: file.size,
        speed: 0
    });

    animateToTransferButton();

    try {
        const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // 存储 xhr 用于取消
            TransferManager.controllers.set(taskId, {
                abort: () => {
                    xhr.abort();
                }
            });

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    // 检查是否已取消
                    const task = TransferManager.tasks.find(t => t.id === taskId);
                    if (task && task.status === 'cancelled') {
                        xhr.abort();
                        return;
                    }

                    const progress = Math.round((e.loaded / e.total) * 100);
                    TransferManager.updateTask(taskId, {
                        progress: progress,
                        loaded: e.loaded,
                        total: e.total
                    });
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        reject(new Error(t('parseResponseFailed')));
                    }
                } else {
                    reject(new Error(xhr.statusText || '上传失败'));
                }
            };

            xhr.onerror = () => reject(new Error(t('networkError')));
            xhr.onabort = () => reject(new Error('AbortError'));

            const formData = new FormData();
            formData.append('file', file);
            if (currentFolder) {
                formData.append('folderId', currentFolder);
            }

            xhr.open('POST', `${API_BASE}/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });

        if (result.code === 200) {
            TransferManager.updateTask(taskId, { status: 'success', progress: 100 });
            return true;
        } else if (result.code === 401) {
            TransferManager.updateTask(taskId, { status: 'error' });
            await showAppAlert(t('loginExpired'), {
                tone: 'danger',
                icon: 'fa-user-clock'
            });
            localStorage.clear();
            window.location.href = 'login.html';
        } else {
            throw new Error(result.message || t('uploadFailed'));
        }

    } catch (error) {
        if (error.message === 'AbortError') {
            // 已在 cancelTask 中处理状态
            console.log('上传已取消:', file.name);
        } else {
            const task = TransferManager.tasks.find(t => t.id === taskId);
            if (task && task.status !== 'cancelled') {
                TransferManager.updateTask(taskId, { status: 'error' });
            }
            console.error('上传失败:', error);
        }
    } finally {
        TransferManager.controllers.delete(taskId);
    }

    return false;
}

// ================== 收缩动画 ==================
function animateToTransferButton() {
    const btn = document.getElementById('transferBtn');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const dot = document.createElement('div');

    dot.style.cssText = `
        position: fixed;
        width: 12px;
        height: 12px;
        background: var(--primary);
        border-radius: 50%;
        z-index: 9999;
        pointer-events: none;
        left: ${window.innerWidth / 2}px;
        top: ${window.innerHeight / 2}px;
        transform: translate(-50%, -50%);
        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 20px var(--primary);
    `;

    document.body.appendChild(dot);

    requestAnimationFrame(() => {
        dot.style.left = rect.left + rect.width / 2 + 'px';
        dot.style.top = rect.top + rect.height / 2 + 'px';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.opacity = '0';
    });

    setTimeout(() => {
        dot.remove();
        btn.classList.add('animate-pulse');
        setTimeout(() => btn.classList.remove('animate-pulse'), 500);
    }, 500);
}

// ================== 页面加载时初始化 ==================
document.addEventListener('DOMContentLoaded', initTransferPanel);
