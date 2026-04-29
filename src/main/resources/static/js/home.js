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
    wsReconnectTimer: null,
    allowReconnect: true,
    pingTimer: null,
    selfChannelId: null,
    selfLabel: null,
    roomDevices: [],          // [{channelId, label, isMe}]
    accountDevices: [],       // [{deviceId, deviceName, deviceType, online}]
    selectionMode: false,
    selectedChannelIds: new Set(),
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
    chooserMode: 'single',
    batchPhase: 'idle',      // idle | uploading | sending | done | error
    batchQueue: [],
    batchCurrentTargetId: null,
    batchShareToken: null,
    batchFileInfo: null,
    batchE2ee: null,
    batchPairTimer: null,
    relayPeerKeyOffer: null,
    batchProgress: { done: 0, total: 0, failed: 0 },
    accountSyncTimer: null,
    globalEventsBound: false,
    dragOverHandler: null,
    dropHandler: null,
};

function bindElementListener(element, eventName, handler, key) {
    if (!element) return;
    const prop = `__qsBound_${key}`;
    if (element[prop]) return;
    element.addEventListener(eventName, handler);
    element[prop] = true;
}

function shouldSuppressHomePairCodeAutoFocus() {
    const coarsePointer = typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;
    const narrowViewport = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 768px)').matches
        : window.innerWidth <= 768;
    return detectDeviceType() !== 'laptop' || (coarsePointer && narrowViewport);
}

function suppressHomePairCodeAutoFocus() {
    const input = document.getElementById('homePairCodeInput');
    if (!input || !shouldSuppressHomePairCodeAutoFocus()) {
        return;
    }

    window.requestAnimationFrame(() => {
        window.setTimeout(() => {
            if (document.activeElement === input) {
                input.blur();
            }
        }, 0);
    });
}

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

function homeTextFmt(key, fallback, vars) {
    let text = homeText(key, fallback);
    Object.entries(vars || {}).forEach(([name, value]) => {
        text = text.split(`{${name}}`).join(String(value));
    });
    return text;
}

// ─── WebSocket ─────────────────────────────────────────────────────────────────

function buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = `${proto}://${location.host}/ws/transfer`;
    const params = new URLSearchParams();
    params.set('deviceName', getHomeDeviceName());
    params.set('deviceType', detectDeviceType());
    if (homeState.token) {
        params.set('deviceId', getHomeDeviceId());
    } else {
        params.set('guestId', getOrCreateGuestId());
    }
    return `${base}?${params.toString()}`;
}

function connectHomeWs() {
    if (homeState.ws && homeState.ws.readyState < 2) {
        setWsStatus(homeState.ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected');
        updateSelfNode();
        renderRing();
        renderPairState();
        return;
    }

    if (homeState.wsReconnectTimer) {
        clearTimeout(homeState.wsReconnectTimer);
        homeState.wsReconnectTimer = null;
    }

    homeState.allowReconnect = true;

    const ws = new WebSocket(buildWsUrl());
    homeState.ws = ws;

    ws.addEventListener('open', () => {
        if (homeState.ws !== ws) return;
        setWsStatus('connected');
    });

    ws.addEventListener('message', (e) => {
        if (homeState.ws !== ws) return;
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        handleWsMessage(msg);
    });

    ws.addEventListener('close', () => {
        if (homeState.ws !== ws) return;
        homeState.ws = null;
        setWsStatus('disconnected');
        homeState.selfChannelId = null;
        homeState.roomDevices = [];
        homeState.pairSessionId = null;
        homeState.peerChannelId = null;
        homeState.peerLabel = null;
        renderRing();
        renderPairState();
        if (homeState.allowReconnect) {
            homeState.wsReconnectTimer = setTimeout(connectHomeWs, 3000);
        }
    });

    ws.addEventListener('error', () => { /* close will reconnect */ });

    // keep-alive ping (clear previous to avoid leaks on reconnect)
    if (homeState.pingTimer) clearInterval(homeState.pingTimer);
    homeState.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);
}

function clearHomeRealtimeState() {
    homeState.selfChannelId = null;
    homeState.selfLabel = null;
    homeState.roomDevices = [];
    homeState.accountDevices = [];
    homeState.pendingTargetChannelId = null;
    homeState.pairSessionId = null;
    homeState.peerChannelId = null;
    homeState.pairCode = null;
    homeState.peerLabel = null;
    homeState.selectionMode = false;
    homeState.selectedChannelIds.clear();
    clearBatchPairTimer();
    resetBatchState();
}

function stopAccountDeviceSync() {
    if (homeState.accountSyncTimer) {
        clearInterval(homeState.accountSyncTimer);
        homeState.accountSyncTimer = null;
    }
}

function unbindHomeGlobalEvents() {
    if (homeState.dragOverHandler) {
        document.removeEventListener('dragover', homeState.dragOverHandler);
        homeState.dragOverHandler = null;
    }
    if (homeState.dropHandler) {
        document.removeEventListener('drop', homeState.dropHandler);
        homeState.dropHandler = null;
    }
    homeState.globalEventsBound = false;
}

function disconnectHomeWs() {
    homeState.allowReconnect = false;
    if (homeState.wsReconnectTimer) {
        clearTimeout(homeState.wsReconnectTimer);
        homeState.wsReconnectTimer = null;
    }
    if (homeState.pingTimer) {
        clearInterval(homeState.pingTimer);
        homeState.pingTimer = null;
    }
    stopAccountDeviceSync();
    clearHomeRealtimeState();
    unbindHomeGlobalEvents();
    setWsStatus('disconnected');
    renderRing();
    renderPairState();
    const ws = homeState.ws;
    if (ws && ws.readyState < 2) {
        try { ws.close(); } catch { /* ignore */ }
    }
    homeState.ws = null;
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
            announceHomeRelayRecipientKey(msg.pairSessionId).catch(error => console.warn('Failed to announce relay E2EE key:', error));
            if (homeState.batchPhase === 'sending') {
                onBatchPairReady(msg);
            } else {
                onPairReady(msg);
            }
            break;

        case 'signal':
            if (msg.signalType === 'relay-e2ee-offer' && msg.payload) {
                homeState.relayPeerKeyOffer = msg.payload;
            } else if (msg.signalType === 'relay-e2ee-offer-request') {
                announceHomeRelayRecipientKey(msg.payload?.pairSessionId).catch(error => console.warn('Failed to answer relay E2EE key request:', error));
            } else if (msg.signalType === 'relay-done' && msg.payload) {
                Promise.resolve(msg.payload.e2ee)
                    .then(e2ee => completeHomeRelayE2ee(e2ee))
                    .then(e2ee => showReceiveCard({ ...msg.payload, e2ee }))
                    .catch(error => showHomeToast(error.message || 'Decrypt key exchange failed', 'error'));
            }
            break;

        case 'pong':
            break;

        case 'error':
            if (homeState.batchPhase === 'sending' && homeState.batchCurrentTargetId) {
                onBatchTargetFailure(homeState.batchCurrentTargetId, msg.message || homeText('homeBatchTargetFailed', '发送失败'));
            } else {
                showHomeToast(msg.message || '操作失败', 'error');
                resetTransferState();
            }
            break;
    }
}

function sendWs(obj) {
    if (homeState.ws && homeState.ws.readyState === WebSocket.OPEN) {
        homeState.ws.send(JSON.stringify(obj));
    }
}

async function announceHomeRelayRecipientKey(pairSessionId) {
    if (!window.QuickShareE2EE?.prepareRelayRecipient) return;
    const sessionId = String(pairSessionId || homeState.pairSessionId || '').trim();
    if (!sessionId) return;
    const offer = await window.QuickShareE2EE.prepareRelayRecipient(sessionId);
    sendWs({
        type: 'signal',
        pairSessionId: sessionId,
        signalType: 'relay-e2ee-offer',
        payload: offer
    });
}

async function completeHomeRelayE2ee(e2ee) {
    if (!e2ee?.encrypted || !window.QuickShareE2EE?.completeRelayRecipientE2ee) {
        return e2ee;
    }
    return window.QuickShareE2EE.completeRelayRecipientE2ee(e2ee);
}

// ─── 设备环渲染 ────────────────────────────────────────────────────────────────

function buildPeerDeviceList() {
    const allDevices = [...homeState.roomDevices];
    for (const d of homeState.accountDevices) {
        const chId = homeState.userId ? `user:${homeState.userId}:device:${d.deviceId}` : null;
        if (chId && !allDevices.find(r => r.channelId === chId)) {
            allDevices.push({ channelId: chId, label: d.deviceName || d.deviceType, isMe: false });
        }
    }

    if (homeState.peerChannelId && homeState.pairSessionId) {
        if (!allDevices.find(d => d.channelId === homeState.peerChannelId)) {
            allDevices.push({
                channelId: homeState.peerChannelId,
                label: homeState.peerLabel || 'Paired Device',
                isMe: false,
                isPaired: true
            });
        }
    }

    return allDevices.filter(d => !d.isMe);
}

function clearBatchPairTimer() {
    if (homeState.batchPairTimer) {
        clearTimeout(homeState.batchPairTimer);
        homeState.batchPairTimer = null;
    }
}

function resetBatchState() {
    clearBatchPairTimer();
    homeState.batchPhase = 'idle';
    homeState.batchQueue = [];
    homeState.batchCurrentTargetId = null;
    homeState.batchShareToken = null;
    homeState.batchFileInfo = null;
    homeState.batchE2ee = null;
    homeState.batchProgress = { done: 0, total: 0, failed: 0 };
    homeState.chooserMode = 'single';
}

function batchProgressText() {
    if (!homeState.batchProgress.total) return '';
    return homeTextFmt('homeBatchProgressSummary', '{done}/{total} completed · {failed} failed', {
        done: homeState.batchProgress.done,
        total: homeState.batchProgress.total,
        failed: homeState.batchProgress.failed,
    });
}

function updateMultiSelectBar() {
    const toggleBtn = document.getElementById('peerSelectModeBtn');
    const bar = document.getElementById('multiSelectBar');
    const sendBtn = document.getElementById('sendSelectedPeersBtn');
    const selectAllBtn = document.getElementById('selectAllPeersBtn');
    const count = homeState.selectedChannelIds.size;
    const visiblePeers = buildPeerDeviceList();
    const showToggle = visiblePeers.length >= 2
        && homeState.transferState === 'idle'
        && homeState.batchPhase !== 'uploading'
        && homeState.batchPhase !== 'sending';
    const allSelected = visiblePeers.length > 0 && count === visiblePeers.length;

    if (toggleBtn) {
        toggleBtn.classList.toggle('active', homeState.selectionMode);
        toggleBtn.classList.toggle('hidden', !showToggle);
        toggleBtn.disabled = !showToggle;
        const label = toggleBtn.querySelector('span');
        if (label) {
            label.textContent = homeTextFmt('homeSelectModeCount', 'Send to Many ({count})', { count: visiblePeers.length });
        }
    }
    if (bar) bar.classList.toggle('hidden', !homeState.selectionMode);
    if (sendBtn) {
        sendBtn.disabled = count < 2 || homeState.transferState !== 'idle' || homeState.batchPhase === 'uploading' || homeState.batchPhase === 'sending';
        const label = sendBtn.querySelector('span');
        if (label) {
            label.textContent = count > 0
                ? homeTextFmt('homeSendSelectedPeersCount', 'Send to selected ({count})', { count })
                : homeText('homeSendSelectedPeers', 'Send to selected');
        }
    }
    if (selectAllBtn) {
        const label = selectAllBtn.querySelector('span');
        if (label) {
            label.textContent = allSelected
                ? homeText('homeUnselectAllPeers', 'Clear all')
                : homeText('homeSelectAllPeers', 'Select all');
        }
    }
}

function clearSelectedPeers(exitSelectionMode = true) {
    homeState.selectedChannelIds.clear();
    if (exitSelectionMode) {
        homeState.selectionMode = false;
    }
    updateMultiSelectBar();
    renderRing();
}

function toggleSelectionMode() {
    if (homeState.transferState !== 'idle' || homeState.batchPhase === 'uploading' || homeState.batchPhase === 'sending') return;
    const peers = buildPeerDeviceList();
    if (!homeState.selectionMode && peers.length < 2) {
        showHomeToast(homeText('homeBatchNeedMorePeers', '至少需要两台可用设备才能多人发送'), 'warning');
        return;
    }
    homeState.selectionMode = !homeState.selectionMode;
    if (!homeState.selectionMode) {
        homeState.selectedChannelIds.clear();
    }
    updateMultiSelectBar();
    renderRing();
}

function togglePeerSelection(channelId) {
    if (!homeState.selectionMode) return;
    if (homeState.selectedChannelIds.has(channelId)) {
        homeState.selectedChannelIds.delete(channelId);
    } else {
        homeState.selectedChannelIds.add(channelId);
    }
    updateMultiSelectBar();
    renderRing();
}

function toggleSelectAllPeers() {
    if (!homeState.selectionMode) return;
    const peers = buildPeerDeviceList();
    const allSelected = peers.length > 0 && peers.every(peer => homeState.selectedChannelIds.has(peer.channelId));
    homeState.selectedChannelIds.clear();
    if (!allSelected) {
        peers.forEach(peer => homeState.selectedChannelIds.add(peer.channelId));
    }
    updateMultiSelectBar();
    renderRing();
}

function openBatchSendChooser() {
    if (homeState.selectedChannelIds.size < 2) {
        showHomeToast(homeText('homeBatchPickPeers', '请先选择至少两台设备'), 'warning');
        return;
    }
    homeState.chooserMode = 'batch';
    showSendChooser(homeTextFmt('homeSelectedDevicesLabel', '{count} 台设备', {
        count: homeState.selectedChannelIds.size,
    }));
}

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

    const others = buildPeerDeviceList();

    if (noHint) noHint.classList.toggle('show', others.length === 0);

    peersEl.innerHTML = '';
    updateMultiSelectBar();
    if (others.length === 0) return;

    others.forEach((dev) => {
        const isPaired = dev.isPaired || dev.channelId === homeState.peerChannelId;
        const isAccount = dev.channelId.startsWith('user:');
        const isSelected = homeState.selectedChannelIds.has(dev.channelId);
        const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
        const metaText = isPaired
            ? (lang === 'zh' ? '已配对' : 'Paired')
            : isAccount
                ? (lang === 'zh' ? '同账号设备' : 'My Device')
                : (lang === 'zh' ? '附近' : 'Nearby');
        const metaBadge = isPaired ? 'paired-badge' : isAccount ? 'account-badge' : 'nearby-badge';

        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'peer-card'
            + (isPaired ? ' paired' : '')
            + (isAccount ? ' account' : ' nearby')
            + (homeState.selectionMode ? ' select-mode' : '')
            + (isSelected ? ' selected' : '');
        node.dataset.channelId = dev.channelId;
        node.innerHTML = `
            <div class="peer-card-icon">
                <i class="fa-solid ${deviceTypeIcon(dev.label)}"></i>
                <span class="peer-online-dot"></span>
            </div>
            <div class="peer-card-info">
                <div class="peer-card-name">${escapeHtml(dev.label)}</div>
                <div class="peer-card-meta"><span class="meta-badge ${metaBadge}">${escapeHtml(metaText)}</span></div>
            </div>
            ${homeState.selectionMode ? '<span class="peer-card-check"><i class="fa-solid fa-check"></i></span>' : ''}
        `;

        node.addEventListener('click', () => {
            if (homeState.selectionMode) {
                togglePeerSelection(dev.channelId);
                return;
            }
            onDeviceClick(dev.channelId, dev.label);
        });

        node.addEventListener('dragover', (e) => {
            if (homeState.selectionMode) return;
            e.preventDefault();
            node.classList.add('drag-over');
        });
        node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
        node.addEventListener('drop', (e) => {
            if (homeState.selectionMode) return;
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
    if (homeState.transferState !== 'idle' || homeState.selectionMode || homeState.batchPhase === 'uploading' || homeState.batchPhase === 'sending') return;
    homeState.chooserMode = 'single';
    homeState.pendingTargetChannelId = channelId;
    homeState.peerLabel = label || homeState.peerLabel;
    homeState.transferFile = null;
    showSendChooser(label);
}

function initiateTransfer(targetChannelId, label, file) {
    if (homeState.transferState !== 'idle') return;
    homeState.transferFile = file;
    homeState.pendingTargetChannelId = targetChannelId;
    homeState.peerLabel = label || homeState.peerLabel;
    homeState.transferState = 'pairing';
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
    showSendProgress(file.name, 0, lang === 'zh' ? '正在连接…' : 'Connecting…');

    // Account device (cross-network, same user) → use direct session API
    // Room device (same network) → use WS request-transfer
    if (homeState.token && targetChannelId.startsWith('user:')) {
        initiateDirectSession(targetChannelId, file);
    } else {
        sendWs({ type: 'request-transfer', targetChannelId });
    }
}

async function initiateDirectSession(targetChannelId) {
    // Extract target deviceId from channelId format "user:{userId}:device:{deviceId}"
    const deviceMatch = targetChannelId.match(/:device:(.+)$/);
    if (!deviceMatch) {
        homeState.transferState = 'error';
        hideSendProgress();
        showHomeToast('Invalid target device', 'error');
        resetTransferState();
        return;
    }
    const targetDeviceId = deviceMatch[1];
    try {
        const res = await fetch(`${apiBase()}/api/transfer/direct-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
                deviceId: getHomeDeviceId(),
                targetDeviceId: targetDeviceId,
            }),
        });
        const body = await res.json();
        if (!res.ok || body.code !== 200) {
            throw new Error(body?.message || 'Direct session failed');
        }
        // pair-ready will arrive via WebSocket, triggering onPairReady → upload
    } catch (err) {
        homeState.transferState = 'error';
        hideSendProgress();
        showHomeToast(err.message, 'error');
        resetTransferState();
    }
}

async function onPairReady(msg) {
    homeState.pairSessionId = msg.pairSessionId || homeState.pairSessionId;
    homeState.peerChannelId = msg.peerChannelId || homeState.peerChannelId;
    homeState.peerLabel = msg.peerLabel || homeState.peerLabel || msg.peerChannelId || null;
    homeState.transferState = homeState.transferFile ? 'paired' : 'idle';

    // Always re-render so paired device shows in the peer grid
    renderRing();

    if (!homeState.transferFile) {
        // Receiver: wait for relay-done signal
        showHomeToast(homeText('homePairConnected', 'Paired! Waiting for file…'), 'success');
        return;
    }
    // Sender: start upload
    try {
        await sendViaPublicShare(homeState.transferFile, homeState.pairSessionId);
        homeState.transferState = 'done';
        const doneText = homeText('homeTransferDone', 'Sent');
        showSendProgress(homeState.transferFile.name, 100, '✓ ' + doneText);
        showHomeToast(homeText('homeTransferSentOk', 'File sent successfully'), 'success');
        setTimeout(resetTransferState, 3000);
    } catch (err) {
        homeState.transferState = 'error';
        hideSendProgress();
        showHomeToast(homeText('homeTransferFailed', 'Send failed') + ': ' + err.message, 'error');
        resetTransferState();
    }
}

// ─── 公开 Share API 上传（无需登录） ──────────────────────────────────────────

async function uploadToPublicShare(file, onProgress, recipientOffer = null) {
    const totalChunks = Math.ceil(file.size / HOME_CHUNK_SIZE) || 1;
    let e2ee = null;
    let encryptKey = null;
    if (window.QuickShareE2EE) {
        if (recipientOffer && window.QuickShareE2EE.encryptForRelayRecipient) {
            const prepared = await window.QuickShareE2EE.encryptForRelayRecipient(recipientOffer, {
                fileName: file.name,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
                chunkSize: HOME_CHUNK_SIZE,
                totalChunks
            });
            encryptKey = prepared.key;
            e2ee = prepared.e2ee;
        } else {
            const generated = await window.QuickShareE2EE.generateKey();
            encryptKey = generated.key;
            e2ee = {
                encrypted: true,
                version: 1,
                key: generated.rawKey,
                fileName: file.name,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
                chunkSize: HOME_CHUNK_SIZE,
                totalChunks
            };
        }
    }

    if (recipientOffer && !encryptKey) {
        throw new Error('Recipient encryption key is unavailable');
    }

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
    for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * HOME_CHUNK_SIZE, (i + 1) * HOME_CHUNK_SIZE);
        const body = encryptKey
            ? await window.QuickShareE2EE.encryptChunk(encryptKey, chunk, e2ee, i)
            : chunk;
        const res = await fetch(`${apiBase()}/api/public/transfer/shares/${shareToken}/chunks/${i}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream', ...authHeader() },
            body,
        });
        if (!res.ok) throw new Error(`分片 ${i + 1}/${totalChunks} 上传失败`);
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        if (typeof onProgress === 'function') {
            onProgress(pct);
        }
    }

    return { shareToken, e2ee };
}

function sendRelayDoneSignal(pairSessionId, fileInfo, shareToken, e2ee) {
    sendWs({
        type: 'signal',
        pairSessionId,
        signalType: 'relay-done',
        payload: {
            shareToken,
            fileName: fileInfo.fileName,
            fileSize: fileInfo.fileSize,
            contentType: fileInfo.contentType,
            e2ee: e2ee || null,
        },
    });
}

async function sendViaPublicShare(file, pairSessionId) {
    homeState.transferState = 'sending';
    if (!homeState.relayPeerKeyOffer) {
        sendWs({
            type: 'signal',
            pairSessionId,
            signalType: 'relay-e2ee-offer-request',
            payload: { pairSessionId }
        });
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (!homeState.relayPeerKeyOffer) {
        throw new Error('Recipient encryption key is unavailable');
    }
    const uploaded = await uploadToPublicShare(file, (pct) => {
        const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'zh';
        const statusText = lang === 'zh' ? `上传中 ${pct}%` : `Uploading ${pct}%`;
        showSendProgress(file.name, pct, statusText);
    }, homeState.relayPeerKeyOffer);
    const shareToken = uploaded.shareToken;
    sendRelayDoneSignal(pairSessionId, {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
    }, shareToken, uploaded.e2ee);

    return shareToken;
}

async function initiateDirectSessionBatch(targetChannelId) {
    const deviceMatch = targetChannelId.match(/:device:(.+)$/);
    if (!deviceMatch) {
        onBatchTargetFailure(targetChannelId, homeText('homeBatchInvalidTarget', '无效的目标设备'));
        return;
    }
    const targetDeviceId = deviceMatch[1];
    try {
        const res = await fetch(`${apiBase()}/api/transfer/direct-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
                deviceId: getHomeDeviceId(),
                targetDeviceId,
            }),
        });
        const body = await res.json();
        if (!res.ok || body.code !== 200) {
            throw new Error(body?.message || 'Direct session failed');
        }
    } catch (err) {
        onBatchTargetFailure(targetChannelId, err.message);
    }
}

function updateBatchProgress(statusText) {
    const total = homeState.batchProgress.total || 1;
    const handled = homeState.batchProgress.done + homeState.batchProgress.failed;
    const pct = homeState.batchPhase === 'uploading'
        ? 0
        : Math.round((handled / total) * 100);
    showSendProgress(
        homeState.batchFileInfo?.fileName || homeText('homeBatchPreparing', '多人发送中'),
        pct,
        statusText,
        batchProgressText(),
    );
}

async function startBatchTransfer(file) {
    const targets = buildPeerDeviceList().filter(peer => homeState.selectedChannelIds.has(peer.channelId));
    if (targets.length < 2) {
        showHomeToast(homeText('homeBatchPickPeers', '请先选择至少两台设备'), 'warning');
        return;
    }
    homeState.batchPhase = 'uploading';
    homeState.batchQueue = targets.map(target => ({ ...target, status: 'pending' }));
    homeState.batchProgress = { done: 0, total: targets.length, failed: 0 };
    homeState.batchCurrentTargetId = null;
    homeState.transferFile = null;
    hideSendChooser();
    try {
        const uploaded = await uploadToPublicShare(file, (pct) => {
            showSendProgress(file.name, pct, homeTextFmt('homeBatchUploading', 'Uploading once… {pct}%', { pct }), batchProgressText());
        });
        homeState.batchShareToken = uploaded.shareToken;
        homeState.batchE2ee = uploaded.e2ee;
        homeState.batchFileInfo = {
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
        };
        homeState.batchPhase = 'sending';
        processNextBatchTarget();
    } catch (err) {
        homeState.batchPhase = 'error';
        hideSendProgress();
        showHomeToast(`${homeText('homeTransferFailed', 'Send failed')}: ${err.message}`, 'error');
        resetBatchState();
    }
}

function processNextBatchTarget() {
    clearBatchPairTimer();
    if (homeState.batchPhase !== 'sending') return;
    const next = homeState.batchQueue.find(item => item.status === 'pending');
    if (!next) {
        finishBatchTransfer();
        return;
    }
    next.status = 'pairing';
    homeState.batchCurrentTargetId = next.channelId;
    updateBatchProgress(homeTextFmt('homeBatchPairing', 'Connecting to {name}…', { name: next.label || 'Device' }));

    if (homeState.pairSessionId && next.channelId === homeState.peerChannelId) {
        onBatchPairReady({
            pairSessionId: homeState.pairSessionId,
            peerChannelId: homeState.peerChannelId,
            peerLabel: homeState.peerLabel,
        });
        return;
    }

    homeState.batchPairTimer = setTimeout(() => {
        onBatchTargetFailure(next.channelId, homeText('homeBatchPairTimeout', '连接超时'));
    }, 15000);

    if (homeState.token && next.channelId.startsWith('user:')) {
        initiateDirectSessionBatch(next.channelId);
    } else {
        sendWs({ type: 'request-transfer', targetChannelId: next.channelId });
    }
}

function onBatchPairReady(msg) {
    if (homeState.batchPhase !== 'sending') return;
    clearBatchPairTimer();
    const current = homeState.batchQueue.find(item => item.status === 'pairing' && item.channelId === (homeState.batchCurrentTargetId || msg.peerChannelId))
        || homeState.batchQueue.find(item => item.status === 'pairing');
    if (!current) return;

    sendRelayDoneSignal(msg.pairSessionId, homeState.batchFileInfo, homeState.batchShareToken, homeState.batchE2ee);
    current.status = 'sent';
    homeState.batchProgress.done += 1;
    homeState.batchCurrentTargetId = null;
    updateBatchProgress(homeTextFmt('homeBatchSentOne', 'Sent to {name}', { name: current.label || 'Device' }));
    setTimeout(processNextBatchTarget, 0);
}

function onBatchTargetFailure(channelId, message) {
    if (homeState.batchPhase !== 'sending') return;
    clearBatchPairTimer();
    const current = homeState.batchQueue.find(item => item.channelId === channelId && (item.status === 'pairing' || item.status === 'pending'));
    if (!current) return;
    current.status = 'failed';
    homeState.batchProgress.failed += 1;
    homeState.batchCurrentTargetId = null;
    showHomeToast(homeTextFmt('homeBatchPeerFailed', '{name} failed: {message}', {
        name: current.label || 'Device',
        message: message || homeText('homeBatchTargetFailed', '发送失败'),
    }), 'warning');
    updateBatchProgress(homeTextFmt('homeBatchSkippedOne', 'Skipped {name}', { name: current.label || 'Device' }));
    setTimeout(processNextBatchTarget, 0);
}

function finishBatchTransfer() {
    clearBatchPairTimer();
    homeState.batchPhase = 'done';
    const done = homeState.batchProgress.done;
    const total = homeState.batchProgress.total;
    const failed = homeState.batchProgress.failed;
    const summary = failed > 0
        ? homeTextFmt('homeBatchFinishedPartial', 'Sent to {done}/{total} devices', { done, total })
        : homeText('homeBatchFinishedAll', 'Sent to all selected devices');
    showSendProgress(homeState.batchFileInfo?.fileName || '', 100, summary, batchProgressText());
    showHomeToast(summary, failed > 0 ? 'warning' : 'success');
    setTimeout(() => {
        clearSelectedPeers(true);
        resetBatchState();
        hideSendProgress();
    }, 2600);
}

// ─── 传输流程：接收方弹窗 ──────────────────────────────────────────────────────

var _receiveCardVersion = 0;

function showReceiveCard({ shareToken, fileName, fileSize, contentType, e2ee }) {
    _receiveCardVersion++;
    const currentVersion = _receiveCardVersion;
    const modal = document.getElementById('receiveModal');
    const nameEl = document.getElementById('receiveFileName');
    const sizeEl = document.getElementById('receiveFileSize');
    const btn    = document.getElementById('receiveDownloadBtn');
    const copyBtn = document.getElementById('receiveCopyLinkBtn');
    const saveBtn = document.getElementById('receiveSaveBtn');
    const textPanel = document.getElementById('receiveTextPanel');
    const textContent = document.getElementById('receiveTextContent');
    const copyTextBtn = document.getElementById('receiveCopyTextBtn');
    const previewPanel = document.getElementById('receivePreviewPanel');
    const iconEl = modal ? modal.querySelector('.recv-icon i') : null;
    const labelEl = modal ? modal.querySelector('.recv-label') : null;
    if (!modal || !nameEl || !sizeEl || !btn) {
        showHomeToast(homeText('homeReceivedFallback', 'File received: ') + fileName, 'success');
        return;
    }
    homeState.lastReceivedShare = {
        shareToken,
        fileName,
        fileSize,
        contentType: contentType || 'application/octet-stream',
        e2ee: e2ee || null
    };

    const ct = contentType || 'application/octet-stream';
    const previewKind = (typeof window.getInlinePreviewKind === 'function')
        ? window.getInlinePreviewKind(fileName, ct)
        : null;
    const isTextPlain = ct.startsWith('text/plain');
    const encryptedOfficePreview = Boolean(e2ee?.encrypted && previewKind === 'office');
    const shouldUseWideModal = Boolean(previewKind && !encryptedOfficePreview);
    const previewRequestWidth = Math.max(280, Math.min(Math.round(window.innerWidth * 0.8), 1600));
    const cardEl = modal.querySelector('.recv-card');

    if (iconEl) iconEl.className = previewKind === 'text' ? 'fa-solid fa-align-left' : 'fa-solid fa-file-arrow-down';
    if (labelEl) labelEl.textContent = previewKind === 'text'
        ? homeText('homeTextReceived', '收到文本')
        : homeText('homeReceiveFromLabel', '收到文件');

    nameEl.textContent = fileName || homeText('homeUnknownFile', 'Unknown file');
    sizeEl.textContent = fileSize ? formatBytes(fileSize) : '';
    const url = `${apiBase()}/api/public/transfer/shares/${shareToken}/download`;
    btn.href = url;
    btn.download = fileName || 'download';
    btn.onclick = null;
    if (e2ee?.encrypted && window.QuickShareE2EE) {
        btn.onclick = async (event) => {
            event.preventDefault();
            try {
                await window.QuickShareE2EE.downloadDecrypted(url, e2ee, fileName || 'download');
            } catch (error) {
                showHomeToast(error.message || 'Decrypt failed', 'error');
            }
        };
    }

    if (isTextPlain && textPanel && textContent) {
        textPanel.classList.remove('hidden');
        textContent.textContent = '…';
        const textPromise = e2ee?.encrypted && window.QuickShareE2EE
            ? window.QuickShareE2EE.fetchAndDecrypt(url, e2ee).then(blob => blob.text())
            : fetch(url).then(r => r.ok ? r.text() : Promise.reject('fetch failed'));
        textPromise
            .then(txt => { if (_receiveCardVersion === currentVersion) textContent.textContent = txt; })
            .catch(() => { if (_receiveCardVersion === currentVersion) textContent.textContent = '(' + homeText('homeTextLoadFailed', '加载失败') + ')'; });
    } else if (textPanel) {
        textPanel.classList.add('hidden');
        textContent.textContent = '';
    }

    if (previewPanel && previewKind) {
        if (typeof window.injectInlinePreviewStyles === 'function') window.injectInlinePreviewStyles();
        const previewUrl = `${apiBase()}/api/public/transfer/shares/${shareToken}/preview`;
        const downloadUrl = `${apiBase()}/api/public/transfer/shares/${shareToken}/download`;
        if (e2ee?.encrypted && window.QuickShareE2EE && previewKind !== 'office') {
            previewPanel.innerHTML = '<div class="inline-preview-wrap"><div style="padding:12px;color:var(--text2,#64748b);font-size:.82rem"><i class="fa-solid fa-spinner fa-spin"></i></div></div>';
            previewPanel.classList.remove('hidden');
            window.QuickShareE2EE.fetchAndDecrypt(downloadUrl, e2ee)
                .then(blob => {
                    if (_receiveCardVersion !== currentVersion) return;
                    const blobUrl = URL.createObjectURL(blob);
                    previewPanel.innerHTML = window.renderInlinePreviewHtml({
                        previewUrl: blobUrl,
                        kind: previewKind,
                        fileName: fileName,
                        maxWidth: previewRequestWidth,
                        downloadUrl: blobUrl
                    });
                    if (previewKind === 'text' && typeof window.fillTextPreviews === 'function') window.fillTextPreviews(previewPanel);
                })
                .catch(() => {
                    if (_receiveCardVersion === currentVersion) previewPanel.classList.add('hidden');
                });
        } else if (e2ee?.encrypted && previewKind === 'office') {
            previewPanel.innerHTML = '';
            previewPanel.classList.add('hidden');
        } else
        if (previewKind === 'text' && !isTextPlain) {
            previewPanel.innerHTML = window.renderInlinePreviewHtml({
                previewUrl: previewUrl,
                kind: 'text',
                fileName: fileName,
                maxWidth: previewRequestWidth,
                downloadUrl: downloadUrl
            });
            previewPanel.classList.remove('hidden');
            if (typeof window.fillTextPreviews === 'function') window.fillTextPreviews(previewPanel);
        } else if (previewKind !== 'text') {
            previewPanel.innerHTML = window.renderInlinePreviewHtml({
                previewUrl: previewUrl,
                kind: previewKind,
                fileName: fileName,
                maxWidth: previewRequestWidth,
                downloadUrl: downloadUrl
            });
            previewPanel.classList.remove('hidden');
        } else {
            previewPanel.innerHTML = '';
            previewPanel.classList.add('hidden');
        }
    } else if (previewPanel) {
        previewPanel.innerHTML = '';
        previewPanel.classList.add('hidden');
    }

    if (cardEl) {
        cardEl.classList.toggle('has-preview', shouldUseWideModal);
    }

    if (copyTextBtn) copyTextBtn.classList.toggle('hidden', !isTextPlain);
    if (copyBtn) {
        copyBtn.disabled = !shareToken;
    }
    if (saveBtn) {
        saveBtn.classList.toggle('hidden', !isLoggedIn() || Boolean(e2ee?.encrypted));
        saveBtn.disabled = !shareToken || !isLoggedIn() || Boolean(e2ee?.encrypted);
    }
    modal.classList.add('visible');
    showHomeToast(isTextPlain ? homeText('homeTextReceived', '收到文本!') : homeText('homeFileReceived', '收到文件!'), 'success');
}

function closeReceiveCard() {
    _receiveCardVersion++;
    const modal = document.getElementById('receiveModal');
    if (modal) {
        modal.classList.remove('visible');
        const cardEl = modal.querySelector('.recv-card');
        if (cardEl) {
            cardEl.classList.remove('has-preview');
        }
    }
    const textPanel = document.getElementById('receiveTextPanel');
    if (textPanel) textPanel.classList.add('hidden');
    const textContent = document.getElementById('receiveTextContent');
    if (textContent) textContent.textContent = '';
    const previewPanel = document.getElementById('receivePreviewPanel');
    if (previewPanel) {
        if (typeof window.cleanupInlinePreview === 'function') window.cleanupInlinePreview(previewPanel);
        previewPanel.classList.add('hidden');
    }
    const copyTextBtn = document.getElementById('receiveCopyTextBtn');
    if (copyTextBtn) copyTextBtn.classList.add('hidden');
    const iconEl = modal ? modal.querySelector('.recv-icon i') : null;
    if (iconEl) iconEl.className = 'fa-solid fa-file-arrow-down';
}

async function copyReceivedText() {
    const textContent = document.getElementById('receiveTextContent');
    const text = textContent?.textContent;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showHomeToast(homeText('homeTextCopied', '文本已复制'), 'success');
    } catch {
        showHomeToast(homeText('homeTextCopyFailed', '复制失败'), 'warning');
    }
}

async function copyReceivedShareLink() {
    const share = homeState.lastReceivedShare;
    if (!share?.shareToken) {
        showHomeToast(homeText('homeReceiveCopyLinkMissing', '当前没有可复制的链接'), 'warning');
        return;
    }
    let url = `${window.location.origin}/share.html?pickup=${encodeURIComponent(share.shareToken)}`;
    if (share.e2ee?.encrypted && window.QuickShareE2EE) {
        url += `#${window.QuickShareE2EE.buildFragment(share.e2ee)}`;
    }
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
        const response = await fetch(`${apiBase()}/api/transfer/public-shares/${encodeURIComponent(share.shareToken)}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader()
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

function showSendProgress(fileName, pct, statusText, batchInfo = '') {
    const wrap  = document.getElementById('homeTransferProgress');
    const label = document.getElementById('homeTransferLabel');
    const bar   = document.getElementById('homeTransferBar');
    const hint  = document.getElementById('homeTransferHint');
    const batch = document.getElementById('homeTransferBatchInfo');
    if (!wrap) return;
    wrap.classList.add('visible');
    if (label) label.textContent = fileName || '';
    if (bar)   bar.style.width = Math.min(pct, 100) + '%';
    if (hint)  hint.textContent = statusText || '';
    if (batch) {
        batch.textContent = batchInfo || '';
        batch.classList.toggle('visible', !!batchInfo);
    }
    // Push toast container up when progress is visible
    const toast = document.getElementById('toastContainer');
    if (toast) toast.style.bottom = '80px';
}

function hideSendProgress() {
    const wrap = document.getElementById('homeTransferProgress');
    const batch = document.getElementById('homeTransferBatchInfo');
    if (wrap) wrap.classList.remove('visible');
    if (batch) {
        batch.textContent = '';
        batch.classList.remove('visible');
    }
    const toast = document.getElementById('toastContainer');
    if (toast) toast.style.bottom = '';
}

function resetTransferState() {
    homeState.transferState   = 'idle';
    homeState.transferFile    = null;
    homeState.pendingTargetChannelId = null;
    const textInput = document.getElementById('sendChooserTextInput');
    if (textInput && !homeState.pairSessionId) {
        textInput.value = '';
    }
    if (homeState.batchPhase === 'idle') {
        setTimeout(hideSendProgress, 800);
    }
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
    const codeWrap = document.getElementById('homePairCodeDisplay');
    const codeValue = document.getElementById('homePairCodeValue');
    const copyButton = document.getElementById('homeCopyPairCodeBtn');

    if (codeWrap && codeValue) {
        if (homeState.pairCode) {
            codeValue.textContent = homeState.pairCode;
            codeWrap.classList.add('visible');
        } else {
            codeValue.textContent = '';
            codeWrap.classList.remove('visible');
        }
    }
    if (copyButton) {
        copyButton.disabled = !homeState.pairCode;
    }

    // Re-render peers to show/hide paired device
    renderRing();
    updateMultiSelectBar();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showHomeToast(msg, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
        return;
    }
    console.log(`[home] ${type}: ${msg}`);
}

function localizeHomeErrorMessage(message) {
    const normalized = String(message || '').trim();
    const directMap = {
        '匹配码不存在或已过期': 'pairCodeExpired',
        '不能使用自己的匹配码': 'pairCodeSelfUse',
        '请选择另一台设备': 'transferChooseOtherDevice',
        '无权限执行该操作': 'noPermissionAction'
    };

    if (directMap[normalized]) {
        return homeText(directMap[normalized], normalized);
    }

    if (normalized.includes('匹配码不存在') || normalized.includes('匹配码已过期')) {
        return homeText('pairCodeExpired', normalized);
    }
    if (normalized.includes('不能使用自己的匹配码')) {
        return homeText('pairCodeSelfUse', normalized);
    }

    return normalized;
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
            showHomeToast(localizeHomeErrorMessage(body?.message || homeText('homePairCodeExpired', '配对码无效或已过期')), 'error');
            return;
        }
        homeState.pairSessionId = body.data?.pairSessionId || homeState.pairSessionId;
        homeState.peerChannelId = body.data?.peerChannelId || homeState.peerChannelId;
        homeState.peerLabel = body.data?.peerLabel || homeState.peerLabel;
        if (input) input.value = '';
        renderPairState();
        showHomeToast(homeText('homePairCodeClaimed', '配对成功，等待对方操作…'), 'success');
    } catch (err) {
        showHomeToast(`${homeText('homePairCodeJoinFailed', '配对失败')}：${localizeHomeErrorMessage(err.message)}`, 'error');
    }
}

function openHomeFilePicker() {
    const fileInput = document.getElementById('homeFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function showSendChooser(label) {
    const overlay = document.getElementById('sendChooser');
    const targetEl = document.getElementById('sendChooserTarget');
    const textInput = document.getElementById('sendChooserTextInput');
    if (targetEl) targetEl.textContent = label || 'Device';
    if (textInput) textInput.value = '';
    showSendChooserOptions();
    if (overlay) overlay.classList.add('visible');
}

function hideSendChooser() {
    const overlay = document.getElementById('sendChooser');
    if (overlay) overlay.classList.remove('visible');
}

function cancelSendChooser() {
    hideSendChooser();
    homeState.pendingTargetChannelId = null;
    homeState.chooserMode = 'single';
}

function showSendChooserOptions() {
    const options = document.getElementById('sendChooserOptions');
    const compose = document.getElementById('sendChooserCompose');
    if (options) options.classList.remove('hidden');
    if (compose) compose.classList.remove('visible');
}

function onChooserSendFile() {
    hideSendChooser();
    openHomeFilePicker();
}

function onChooserSendText() {
    const options = document.getElementById('sendChooserOptions');
    const compose = document.getElementById('sendChooserCompose');
    if (options) options.classList.add('hidden');
    if (compose) compose.classList.add('visible');
    const textInput = document.getElementById('sendChooserTextInput');
    if (textInput) textInput.focus();
}

async function sendTextFromChooser() {
    const textInput = document.getElementById('sendChooserTextInput');
    const text = textInput?.value?.trim();
    if (!text) {
        showHomeToast(homeText('homeTextEmpty', '请输入要发送的文本'), 'warning');
        return;
    }
    if (homeState.transferState !== 'idle') {
        showHomeToast(homeText('homeTransferBusy', '传输进行中，请稍候'), 'warning');
        return;
    }

    const channelId = homeState.pendingTargetChannelId;
    const label = homeState.peerLabel;

    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], 'text-message.txt', { type: 'text/plain', lastModified: Date.now() });

    hideSendChooser();

    if (homeState.chooserMode === 'batch') {
        homeState.chooserMode = 'single';
        await startBatchTransfer(file);
        return;
    }

    if (homeState.pairSessionId && channelId === homeState.peerChannelId) {
        homeState.transferFile = file;
        onPairReady({
            pairSessionId: homeState.pairSessionId,
            peerChannelId: homeState.peerChannelId,
            peerLabel: homeState.peerLabel
        });
    } else {
        initiateTransfer(channelId, label, file);
    }
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
        homeState.accountDevices = (body.data?.devices || []).filter(d => d.deviceId !== getHomeDeviceId() && d.online);
        renderRing();
    } catch { /* ignore */ }
}

// ─── 初始化 ────────────────────────────────────────────────────────────────────

async function initHomePage() {
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
        stopAccountDeviceSync();
        homeState.accountSyncTimer = setInterval(syncAccountDevices, 30000);
    } else {
        stopAccountDeviceSync();
    }

    // 文件选择器
    const fileInput = document.getElementById('homeFileInput');
    if (fileInput) {
        bindElementListener(fileInput, 'change', async (e) => {
            const file = e.target.files[0];
            const chooserMode = homeState.chooserMode;
            const targetChannelId = homeState.pendingTargetChannelId || homeState.peerChannelId;
            if (file && chooserMode === 'batch') {
                homeState.chooserMode = 'single';
                await startBatchTransfer(file);
            } else if (file && targetChannelId) {
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
        }, 'fileInputChange');
    }

    const createPairCodeButton = document.getElementById('homeCreatePairCodeBtn');
    if (createPairCodeButton) {
        bindElementListener(createPairCodeButton, 'click', createPairCode, 'createPairCode');
    }

    const copyPairCodeButton = document.getElementById('homeCopyPairCodeBtn');
    if (copyPairCodeButton) {
        bindElementListener(copyPairCodeButton, 'click', copyCurrentPairCode, 'copyPairCode');
    }

    const copyReceivedLinkButton = document.getElementById('receiveCopyLinkBtn');
    if (copyReceivedLinkButton) {
        bindElementListener(copyReceivedLinkButton, 'click', copyReceivedShareLink, 'copyReceivedLink');
    }

    const saveReceivedButton = document.getElementById('receiveSaveBtn');
    if (saveReceivedButton) {
        bindElementListener(saveReceivedButton, 'click', saveReceivedShareToNetdisk, 'saveReceivedShare');
    }

    const copyTextButton = document.getElementById('receiveCopyTextBtn');
    if (copyTextButton) {
        bindElementListener(copyTextButton, 'click', copyReceivedText, 'copyReceivedText');
    }

    const chooserSendFileBtn = document.getElementById('chooserSendFileBtn');
    if (chooserSendFileBtn) {
        bindElementListener(chooserSendFileBtn, 'click', onChooserSendFile, 'chooserSendFile');
    }

    const chooserSendTextBtn = document.getElementById('chooserSendTextBtn');
    if (chooserSendTextBtn) {
        bindElementListener(chooserSendTextBtn, 'click', onChooserSendText, 'chooserSendText');
    }

    const chooserSendBtn = document.getElementById('sendChooserSendBtn');
    if (chooserSendBtn) {
        bindElementListener(chooserSendBtn, 'click', sendTextFromChooser, 'chooserSendTextSubmit');
    }

    const selectModeBtn = document.getElementById('peerSelectModeBtn');
    if (selectModeBtn) {
        bindElementListener(selectModeBtn, 'click', toggleSelectionMode, 'toggleSelectionMode');
    }

    const selectAllPeersBtn = document.getElementById('selectAllPeersBtn');
    if (selectAllPeersBtn) {
        bindElementListener(selectAllPeersBtn, 'click', toggleSelectAllPeers, 'selectAllPeers');
    }

    const sendSelectedPeersBtn = document.getElementById('sendSelectedPeersBtn');
    if (sendSelectedPeersBtn) {
        bindElementListener(sendSelectedPeersBtn, 'click', openBatchSendChooser, 'sendSelectedPeers');
    }

    const clearSelectedPeersBtn = document.getElementById('clearSelectedPeersBtn');
    if (clearSelectedPeersBtn) {
        bindElementListener(clearSelectedPeersBtn, 'click', () => clearSelectedPeers(true), 'clearSelectedPeers');
    }

    const chooserOverlay = document.getElementById('sendChooser');
    if (chooserOverlay) {
        bindElementListener(chooserOverlay, 'click', (e) => {
            if (e.target === chooserOverlay) cancelSendChooser();
        }, 'chooserOverlayClick');
    }

    renderPairState();
    suppressHomePairCodeAutoFocus();

    // 整页拖拽（单一 peer 时自动目标）
    if (!homeState.globalEventsBound) {
        homeState.dragOverHandler = (e) => {
            if (!document.getElementById('peerDevices')) return;
            e.preventDefault();
        };
        homeState.dropHandler = (e) => {
            if (!document.getElementById('peerDevices')) return;
            e.preventDefault();
            if (homeState.transferState !== 'idle') return;
            if (homeState.selectionMode) {
                showHomeToast(homeText('homeBatchDropDisabled', '多人发送模式下请先点击“发送给已选设备”'), 'info');
                return;
            }
            const others = homeState.roomDevices.filter(d => !d.isMe);
            if (others.length === 1) {
                const file = e.dataTransfer.files[0];
                if (file) initiateTransfer(others[0].channelId, others[0].label, file);
            } else if (others.length > 1) {
                showHomeToast('请点击目标设备后再拖入文件', 'info');
            }
        };
        document.addEventListener('dragover', homeState.dragOverHandler);
        document.addEventListener('drop', homeState.dropHandler);
        homeState.globalEventsBound = true;
    }
}

function reinitHomePage() {
    initHomePage();
}

window.__spaBeforeNavigate = function (targetFile) {
    const file = (targetFile || '').split('/').pop().toLowerCase();
    if (file !== 'index.html' && file !== '') {
        disconnectHomeWs();
    }
};

window.__spaAfterNavigate = function (targetFile) {
    const file = (targetFile || '').split('/').pop().toLowerCase();
    if (file === 'index.html' || file === '') {
        reinitHomePage();
    }
};

window.addEventListener('pageshow', () => {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (file === 'index.html' || file === '') {
        reinitHomePage();
    }
});

/* SPA-aware bootstrap: run immediately if document already loaded */
if (document.readyState === 'complete') {
    initHomePage();
} else {
    window.addEventListener('load', initHomePage);
}
