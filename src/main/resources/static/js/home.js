/**
 * home.js — QuickShare 首页逻辑
 *
 * 功能：
 *  1. 连接 /ws/transfer，IP 分组发现同局域网设备
 *  2. 点击/拖拽设备 → 选文件 → 通过 request-transfer 发起配对
 *  3. 发送方：用公开 Share API 上传（无需登录），上传完毕后 WS 信令通知接收方
 *  4. 接收方：收到 relay-done 信令 → 弹出下载卡片
 *  5. 已登录用户额外展示账号下的已注册设备（来自 /api/transfer/sync）
 */

'use strict';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const HOME_DEVICE_ID_KEY  = 'transfer-device-id';
const HOME_DEVICE_NAME_KEY = 'transfer-device-name';
const HOME_GUEST_ID_KEY   = 'home-guest-id';
const HOME_CHUNK_SIZE     = 2 * 1024 * 1024; // 2 MB

// ─── 状态 ─────────────────────────────────────────────────────────────────────

const homeState = {
    ws: null,
    selfChannelId: null,
    selfLabel: null,
    roomDevices: [],          // [{channelId, label, isMe}]
    accountDevices: [],       // [{deviceId, deviceName, deviceType, online}]
    pendingTargetChannelId: null,
    pairSessionId: null,
    peerChannelId: null,
    transferFile: null,
    transferState: 'idle',   // idle | pairing | paired | sending | done | error
    userId: null,
    token: null,
    pairCode: null,
    peerLabel: null,
    lastReceivedShare: null,
};

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function getOrCreateGuestId() {
    let id = localStorage.getItem(HOME_GUEST_ID_KEY);
    if (!id) {
        id = 'guest-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(HOME_GUEST_ID_KEY, id);
    }
    return id;
}

function getHomeDeviceId() {
    let id = localStorage.getItem(HOME_DEVICE_ID_KEY);
    if (!id) {
        id = window.crypto?.randomUUID?.() || ('dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem(HOME_DEVICE_ID_KEY, id);
    }
    return id;
}

function getHomeDeviceName() {
    return localStorage.getItem(HOME_DEVICE_NAME_KEY) || detectDeviceLabel();
}

function detectDeviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua) && /Mobile/.test(ua)) return 'Android Phone';
    if (/Android/.test(ua)) return 'Android Tablet';
    if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Browser';
}

function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'phone';
    if (/iPad/.test(ua)) return 'tablet';
    if (/Android/.test(ua) && /Mobile/.test(ua)) return 'phone';
    if (/Android/.test(ua)) return 'tablet';
    return 'laptop';
}

function deviceTypeIcon(label) {
    const l = String(label || '').toLowerCase();
    if (/iphone|android phone|phone/.test(l)) return 'fa-mobile-screen-button';
    if (/ipad|tablet/.test(l)) return 'fa-tablet-screen-button';
    if (/mac|windows|linux|laptop|pc/.test(l)) return 'fa-laptop';
    return 'fa-display';
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseJwtPayload(token) {
    try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(b64));
    } catch { return null; }
}

function apiBase() {
    return window.API_BASE || '';
}

function authHeader() {
    return homeState.token ? { 'Authorization': 'Bearer ' + homeState.token } : {};
}

function homeText(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

// ─── WebSocket ─────────────────────────────────────────────────────────────────

function buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = `${proto}://${location.host}/ws/transfer`;
    const params = new URLSearchParams();
    params.set('deviceName', getHomeDeviceName());
    params.set('deviceType', detectDeviceType());
    if (homeState.token) {
        params.set('token', homeState.token);
        params.set('deviceId', getHomeDeviceId());
    } else {
        params.set('guestId', getOrCreateGuestId());
    }
    return `${base}?${params.toString()}`;
}

function connectHomeWs() {
    if (homeState.ws && homeState.ws.readyState < 2) return;

    const ws = new WebSocket(buildWsUrl());
    homeState.ws = ws;

    ws.addEventListener('open', () => setWsStatus('connected'));

    ws.addEventListener('message', (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        handleWsMessage(msg);
    });

    ws.addEventListener('close', () => {
        setWsStatus('disconnected');
        homeState.selfChannelId = null;
        homeState.roomDevices = [];
        homeState.pairSessionId = null;
        homeState.peerChannelId = null;
        homeState.peerLabel = null;
        renderRing();
        renderPairState();
        setTimeout(connectHomeWs, 3000);
    });

    ws.addEventListener('error', () => { /* close will reconnect */ });

    // keep-alive ping
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);
}

function handleWsMessage(msg) {
    switch (msg.type) {
        case 'welcome':
            homeState.selfChannelId = msg.channelId;
            homeState.selfLabel = msg.label;
            updateSelfNode();
            renderRing();
            break;

        case 'room-update':
            homeState.roomDevices = msg.devices || [];
            renderRing();
            break;

        case 'pair-ready':
            homeState.pairSessionId = msg.pairSessionId;
            homeState.peerChannelId = msg.peerChannelId;
            homeState.peerLabel = msg.peerLabel || homeState.peerLabel || msg.peerChannelId || null;
            onPairReady(msg);
            break;

        case 'signal':
            if (msg.signalType === 'relay-done' && msg.payload) {
                showReceiveCard(msg.payload);
            }
            break;

        case 'pong':
            break;

        case 'error':
            showHomeToast(msg.message || '操作失败', 'error');
            resetTransferState();
            break;
    }
}

function sendWs(obj) {
    if (homeState.ws && homeState.ws.readyState === WebSocket.OPEN) {
        homeState.ws.send(JSON.stringify(obj));
    }
}

// ─── 设备环渲染 ────────────────────────────────────────────────────────────────

function updateSelfNode() {
    const label = document.getElementById('selfDeviceLabel');
    if (label) label.textContent = homeState.selfLabel || getHomeDeviceName();
    const icon = document.getElementById('selfDeviceIcon');
    if (icon) icon.className = `fa-solid ${deviceTypeIcon(detectDeviceLabel())}`;
}

function renderRing() {
    const peersEl = document.getElementById('peerDevices');
    const noHint  = document.getElementById('noDevicesHint');
    if (!peersEl) return;

    // Merge: room devices + account devices (dedup by channelId)
    const allDevices = [...homeState.roomDevices];
    for (const d of homeState.accountDevices) {
        const chId = homeState.userId ? `user:${homeState.userId}:device:${d.deviceId}` : null;
        if (chId && !allDevices.find(r => r.channelId === chId)) {
            allDevices.push({ channelId: chId, label: d.deviceName || d.deviceType, isMe: false });
        }
    }

    const others = allDevices.filter(d => !d.isMe);

    if (noHint) noHint.style.display = others.length === 0 ? 'flex' : 'none';

    peersEl.innerHTML = '';
    if (others.length === 0) return;

    others.forEach((dev) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'peer-node';
        node.dataset.channelId = dev.channelId;
        node.innerHTML = `
            <span class="peer-icon-wrap">
                <i class="fa-solid ${deviceTypeIcon(dev.label)}"></i>
            </span>
            <span class="peer-copy">
                <strong class="peer-label">${escapeHtml(dev.label)}</strong>
                <small class="peer-meta">${dev.channelId.startsWith('user:') ? 'Account Device' : 'Nearby Device'}</small>
            </span>
            <span class="peer-cta">
                <i class="fa-solid fa-paperclip"></i>
            </span>
        `;

        node.addEventListener('click', () => onDeviceClick(dev.channelId, dev.label));

        node.addEventListener('dragover', (e) => {
            e.preventDefault();
            node.classList.add('drag-over');
        });
        node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
        node.addEventListener('drop', (e) => {
            e.preventDefault();
            node.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) initiateTransfer(dev.channelId, dev.label, file);
        });

        peersEl.appendChild(node);
    });
}

// ─── 传输流程：发起 ────────────────────────────────────────────────────────────

function onDeviceClick(channelId, label) {
    if (homeState.transferState !== 'idle') return;
    homeState.pendingTargetChannelId = channelId;
    homeState.transferFile = null;
    showHomeToast(homeText('homeSelectFileForPeer', `选择文件并发送给 ${label}`).replace('{name}', label), 'info');
    openHomeFilePicker();
}

function showSendModal(label) {
    const modal = document.getElementById('sendModal');
    const target = document.getElementById('sendModalTarget');
    if (target) target.textContent = `发送给：${label}`;
    if (modal) modal.classList.add('visible');
}

function closeSendModal() {
    const modal = document.getElementById('sendModal');
    if (modal) modal.classList.remove('visible');
    homeState.pendingTargetChannelId = null;
}

function initiateTransfer(targetChannelId, label, file) {
    if (homeState.transferState !== 'idle') return;
    homeState.transferFile = file;
    homeState.pendingTargetChannelId = targetChannelId;
    homeState.peerLabel = label || homeState.peerLabel;
    homeState.transferState = 'pairing';
    showSendProgress(file.name, 0, '正在连接…');
    sendWs({ type: 'request-transfer', targetChannelId });
}

async function onPairReady(msg) {
    homeState.pairSessionId = msg.pairSessionId || homeState.pairSessionId;
    homeState.peerChannelId = msg.peerChannelId || homeState.peerChannelId;
    homeState.peerLabel = msg.peerLabel || homeState.peerLabel || msg.peerChannelId || null;
    homeState.transferState = homeState.transferFile ? 'paired' : 'idle';
    renderPairState();

    if (!homeState.transferFile) {
        // 接收方：等待对方上传完毕的信令
        return;
    }
    // 发送方：开始上传
    try {
        await sendViaPublicShare(homeState.transferFile, homeState.pairSessionId);
        homeState.transferState = 'done';
        showSendProgress(homeState.transferFile.name, 100, '✓ 发送完成');
        showHomeToast(`已发送 "${homeState.transferFile.name}"`, 'success');
        setTimeout(resetTransferState, 3000);
    } catch (err) {
        homeState.transferState = 'error';
        hideSendProgress();
        showHomeToast('发送失败：' + err.message, 'error');
        resetTransferState();
    }
}

// ─── 公开 Share API 上传（无需登录） ──────────────────────────────────────────

async function sendViaPublicShare(file, pairSessionId) {
    homeState.transferState = 'sending';

    // 1. 创建公开 Share
    const createRes = await fetch(`${apiBase()}/api/public/transfer/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
            senderLabel: getHomeDeviceName(),
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
            chunkSize: HOME_CHUNK_SIZE,
        }),
    });
    if (!createRes.ok) throw new Error('创建传输失败 (' + createRes.status + ')');
    const createBody = await createRes.json();
    if (!createBody || createBody.code !== 200) throw new Error(createBody?.message || '创建传输失败');
    const shareToken = createBody.data?.shareToken;
    if (!shareToken) throw new Error('未获取到 shareToken');

    // 2. 分片上传
    const totalChunks = Math.ceil(file.size / HOME_CHUNK_SIZE) || 1;
    for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * HOME_CHUNK_SIZE, (i + 1) * HOME_CHUNK_SIZE);
        const res = await fetch(`${apiBase()}/api/public/transfer/shares/${shareToken}/chunks/${i}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream', ...authHeader() },
            body: chunk,
        });
        if (!res.ok) throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败`);
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        showSendProgress(file.name, pct, `上传中 ${pct}%`);
    }

    // 3. 通过 WS 信令通知接收方
    sendWs({
        type: 'signal',
        pairSessionId,
        signalType: 'relay-done',
        payload: {
            shareToken,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
        },
    });

    return shareToken;
}

// ─── 传输流程：接收方弹窗 ──────────────────────────────────────────────────────

function showReceiveCard({ shareToken, fileName, fileSize, contentType }) {
    const modal = document.getElementById('receiveModal');
    const nameEl = document.getElementById('receiveFileName');
    const sizeEl = document.getElementById('receiveFileSize');
    const btn    = document.getElementById('receiveDownloadBtn');
    const copyBtn = document.getElementById('receiveCopyLinkBtn');
    const saveBtn = document.getElementById('receiveSaveBtn');
    if (!modal || !nameEl || !sizeEl || !btn) {
        // fallback: browser prompt
        showHomeToast(`收到文件：${fileName}，点击下载`, 'success');
        return;
    }
    homeState.lastReceivedShare = {
        shareToken,
        fileName,
        fileSize,
        contentType: contentType || 'application/octet-stream'
    };
    nameEl.textContent = fileName || '未知文件';
    sizeEl.textContent = fileSize ? formatBytes(fileSize) : '';
    const url = `${apiBase()}/api/public/transfer/shares/${shareToken}/download`;
    btn.href = url;
    btn.download = fileName || 'download';
    if (copyBtn) {
        copyBtn.disabled = !shareToken;
    }
    if (saveBtn) {
        saveBtn.classList.toggle('hidden', !isLoggedIn());
        saveBtn.disabled = !shareToken || !isLoggedIn();
    }
    modal.classList.add('visible');
    showHomeToast('收到文件，请查看下载卡片', 'success');
}

function closeReceiveCard() {
    const modal = document.getElementById('receiveModal');
    if (modal) modal.classList.remove('visible');
}

async function copyReceivedShareLink() {
    const share = homeState.lastReceivedShare;
    if (!share?.shareToken) {
        showHomeToast(homeText('homeReceiveCopyLinkMissing', '当前没有可复制的链接'), 'warning');
        return;
    }
    const url = `${window.location.origin}/transfer-share.html?share=${encodeURIComponent(share.shareToken)}`;
    try {
        await navigator.clipboard.writeText(url);
        showHomeToast(homeText('homeReceiveCopyLinkSuccess', '取件链接已复制'), 'success');
    } catch (error) {
        showHomeToast(homeText('homePairCodeCopyFailed', '复制失败，请手动复制'), 'warning');
    }
}

async function saveReceivedShareToNetdisk() {
    const share = homeState.lastReceivedShare;
    if (!share?.shareToken) {
        showHomeToast(homeText('homeReceiveSaveMissing', '当前没有可保存的文件'), 'warning');
        return;
    }
    if (!isLoggedIn()) {
        showHomeToast(homeText('transferLoginRequired', '请先登录后再使用设备快传'), 'warning');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/transfer/public-shares/${encodeURIComponent(share.shareToken)}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ folderId: 0 })
        });
        const text = await response.text();
        const result = text ? JSON.parse(text) : null;
        if (!response.ok || !result || result.code !== 200) {
            throw new Error(result?.message || 'Save failed');
        }
        showHomeToast(homeText('transferSavedToNetdisk', '已保存到你的网盘'), 'success');
    } catch (error) {
        showHomeToast(error.message, 'error');
    }
}

// ─── 进度 UI ──────────────────────────────────────────────────────────────────

function showSendProgress(fileName, pct, statusText) {
    const wrap  = document.getElementById('homeTransferProgress');
    const label = document.getElementById('homeTransferLabel');
    const bar   = document.getElementById('homeTransferBar');
    const hint  = document.getElementById('homeTransferHint');
    if (!wrap) return;
    wrap.classList.add('visible');
    if (label) label.textContent = fileName || '';
    if (bar)   bar.style.width = pct + '%';
    if (hint)  hint.textContent = statusText || '';
}

function hideSendProgress() {
    const wrap = document.getElementById('homeTransferProgress');
    if (wrap) wrap.classList.remove('visible');
}

function resetTransferState() {
    homeState.transferState   = 'idle';
    homeState.transferFile    = null;
    homeState.pendingTargetChannelId = null;
    setTimeout(hideSendProgress, 800);
    renderPairState();
}

// ─── WS 状态 ──────────────────────────────────────────────────────────────────

function setWsStatus(status) {
    const dot  = document.getElementById('wsStatusDot');
    const text = document.getElementById('wsStatusText');
    if (dot)  dot.dataset.status = status;
    if (text) text.textContent   = status === 'connected'
        ? homeText('homeWsConnected', '已连接')
        : homeText('homeWsConnecting', '连接中…');
}

function renderPairState() {
    const codeDisplay = document.getElementById('homePairCodeDisplay');
    const peerLabel = document.getElementById('homeActivePeerLabel');
    const pairMeta = document.getElementById('homePairStateMeta');
    const sendButton = document.getElementById('homeSendToPeerBtn');
    const copyButton = document.getElementById('homeCopyPairCodeBtn');

    if (codeDisplay) {
        codeDisplay.textContent = homeState.pairCode || '-';
    }
    if (copyButton) {
        copyButton.disabled = !homeState.pairCode;
    }
    if (peerLabel) {
        peerLabel.textContent = homeState.peerLabel || homeText('homeActivePeerEmpty', '未连接设备');
    }
    if (pairMeta) {
        pairMeta.textContent = homeState.pairSessionId
            ? homeText('homePairStateReady', '已建立配对会话，可以直接选文件发送')
            : homeText('homeActivePeerHint', '生成配对码后，对方输入即可建立一条临时传输通道。');
    }
    if (sendButton) {
        sendButton.disabled = !(homeState.pairSessionId && homeState.peerChannelId) || homeState.transferState === 'sending';
    }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showHomeToast(msg, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
        return;
    }
    console.log(`[home] ${type}: ${msg}`);
}

// ─── 配对码输入（跨网段） ──────────────────────────────────────────────────────

async function createPairCode() {
    try {
        const res = await fetch(`${apiBase()}/api/public/transfer/pair-codes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
                deviceId: getHomeDeviceId(),
                guestId: homeState.token ? null : getOrCreateGuestId(),
                deviceName: getHomeDeviceName(),
                deviceType: detectDeviceType()
            }),
        });
        const body = await res.json();
        if (!res.ok || body.code !== 200) {
            showHomeToast(body?.message || homeText('homeCreatePairCodeFailed', '生成配对码失败'), 'error');
            return;
        }
        homeState.pairCode = body.data?.code || null;
        renderPairState();
        showHomeToast(homeText('homePairCodeCreated', '配对码已生成'), 'success');
    } catch (err) {
        showHomeToast(`${homeText('homeCreatePairCodeFailed', '生成配对码失败')}：${err.message}`, 'error');
    }
}

async function copyCurrentPairCode() {
    if (!homeState.pairCode) {
        showHomeToast(homeText('homePairCodeMissing', '当前还没有可复制的配对码'), 'warning');
        return;
    }
    try {
        await navigator.clipboard.writeText(homeState.pairCode);
        showHomeToast(homeText('homePairCodeCopied', '配对码已复制'), 'success');
    } catch (err) {
        showHomeToast(homeText('homePairCodeCopyFailed', '复制失败，请手动复制'), 'warning');
    }
}

async function joinByPairCode() {
    const input = document.getElementById('homePairCodeInput');
    const code  = input?.value?.trim().toUpperCase();
    if (!code || code.length < 4) {
        showHomeToast(homeText('homePairCodeInvalid', '请输入有效的配对码'), 'warning');
        return;
    }
    try {
        const res = await fetch(`${apiBase()}/api/public/transfer/pair-codes/${encodeURIComponent(code)}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
                deviceId: getHomeDeviceId(),
                guestId: homeState.token ? null : getOrCreateGuestId(),
                deviceName: getHomeDeviceName(),
                deviceType: detectDeviceType()
            }),
        });
        const body = await res.json();
        if (!res.ok || body.code !== 200) {
            showHomeToast(body?.message || homeText('homePairCodeExpired', '配对码无效或已过期'), 'error');
            return;
        }
        homeState.pairSessionId = body.data?.pairSessionId || homeState.pairSessionId;
        homeState.peerChannelId = body.data?.peerChannelId || homeState.peerChannelId;
        homeState.peerLabel = body.data?.peerLabel || homeState.peerLabel;
        if (input) input.value = '';
        renderPairState();
        showHomeToast(homeText('homePairCodeClaimed', '配对成功，等待对方操作…'), 'success');
    } catch (err) {
        showHomeToast(`${homeText('homePairCodeJoinFailed', '配对失败')}：${err.message}`, 'error');
    }
}

function openHomeFilePicker() {
    const fileInput = document.getElementById('homeFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function sendToPairedPeer() {
    if (!homeState.pairSessionId || !homeState.peerChannelId) {
        showHomeToast(homeText('homePairFirst', '请先完成配对'), 'warning');
        return;
    }
    homeState.pendingTargetChannelId = homeState.peerChannelId;
    openHomeFilePicker();
}

// ─── 账号设备同步（登录用户） ──────────────────────────────────────────────────

async function syncAccountDevices() {
    if (!homeState.token) return;
    try {
        const res = await fetch(`${apiBase()}/api/transfer/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
                deviceId:   getHomeDeviceId(),
                deviceName: getHomeDeviceName(),
                deviceType: detectDeviceType(),
            }),
        });
        if (!res.ok) return;
        const body = await res.json();
        homeState.accountDevices = (body.data?.devices || []).filter(d => d.deviceId !== getHomeDeviceId());
        renderRing();
    } catch { /* ignore */ }
}

// ─── 初始化 ────────────────────────────────────────────────────────────────────

window.addEventListener('load', async () => {
    // 读取 auth 状态
    const token = localStorage.getItem('token');
    if (token) {
        homeState.token = token;
        const payload = parseJwtPayload(token);
        homeState.userId = payload?.userId || payload?.sub;
    }

    // 更新自身设备名
    updateSelfNode();

    // 连接 WS
    connectHomeWs();

    // 登录用户：同步账号设备
    if (homeState.token) {
        await syncAccountDevices();
        setInterval(syncAccountDevices, 30000);
    }

    // 文件选择器
    const fileInput = document.getElementById('homeFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const targetChannelId = homeState.pendingTargetChannelId || homeState.peerChannelId;
            if (file && targetChannelId) {
                if (homeState.pairSessionId && targetChannelId === homeState.peerChannelId) {
                    homeState.transferFile = file;
                    onPairReady({
                        pairSessionId: homeState.pairSessionId,
                        peerChannelId: homeState.peerChannelId,
                        peerLabel: homeState.peerLabel
                    });
                } else {
                    initiateTransfer(targetChannelId, null, file);
                }
            }
            fileInput.value = '';
            homeState.pendingTargetChannelId = null;
        });
    }

    const createPairCodeButton = document.getElementById('homeCreatePairCodeBtn');
    if (createPairCodeButton) {
        createPairCodeButton.addEventListener('click', createPairCode);
    }

    const copyPairCodeButton = document.getElementById('homeCopyPairCodeBtn');
    if (copyPairCodeButton) {
        copyPairCodeButton.addEventListener('click', copyCurrentPairCode);
    }

    const sendToPeerButton = document.getElementById('homeSendToPeerBtn');
    if (sendToPeerButton) {
        sendToPeerButton.addEventListener('click', sendToPairedPeer);
    }

    const copyReceivedLinkButton = document.getElementById('receiveCopyLinkBtn');
    if (copyReceivedLinkButton) {
        copyReceivedLinkButton.addEventListener('click', copyReceivedShareLink);
    }

    const saveReceivedButton = document.getElementById('receiveSaveBtn');
    if (saveReceivedButton) {
        saveReceivedButton.addEventListener('click', saveReceivedShareToNetdisk);
    }

    renderPairState();

    // 整页拖拽（单一 peer 时自动目标）
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        if (homeState.transferState !== 'idle') return;
        const others = homeState.roomDevices.filter(d => !d.isMe);
        if (others.length === 1) {
            const file = e.dataTransfer.files[0];
            if (file) initiateTransfer(others[0].channelId, others[0].label, file);
        } else if (others.length > 1) {
            showHomeToast('请点击目标设备后再拖入文件', 'info');
        }
    });
});
