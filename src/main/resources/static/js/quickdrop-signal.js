const QUICKDROP_SIGNAL_DEVICE_ID_KEY = 'quickdrop-device-id';
const QUICKDROP_SIGNAL_GUEST_ID_KEY = 'quickdrop-guest-id';

const QuickDropSignalManager = (() => {
    const state = {
        socket: null,
        connected: false,
        channelId: '',
        pairSessionId: '',
        latestCode: '',
        latestPeerLabel: '',
        latestPeerChannelId: '',
        latestPeerDeviceId: '',
        pingTimer: null,
        rtcConfig: null,
        peerConnection: null,
        controlChannel: null,
        fileChannel: null,
        directState: 'idle',
        pendingRemoteCandidates: [],
        pairSessionRequest: null
    };

    function text(key, fallback) {
        return typeof t === 'function' ? t(key) : fallback;
    }

    function emit(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    function ensureStorageValue(key, factory) {
        let value = localStorage.getItem(key);
        if (value) {
            return value;
        }
        value = factory();
        localStorage.setItem(key, value);
        return value;
    }

    function getDeviceId() {
        return ensureStorageValue(QUICKDROP_SIGNAL_DEVICE_ID_KEY, () => {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            return `qd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        });
    }

    function getGuestId() {
        return ensureStorageValue(QUICKDROP_SIGNAL_GUEST_ID_KEY, () => {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        });
    }

    function detectDeviceType() {
        const ua = navigator.userAgent || '';
        if (/iphone/i.test(ua)) return 'iPhone';
        if (/ipad/i.test(ua)) return 'iPad';
        if (/android/i.test(ua)) return 'Android';
        if (/macintosh|mac os x/i.test(ua)) return 'Mac';
        if (/windows/i.test(ua)) return 'Windows';
        if (/linux/i.test(ua)) return 'Linux';
        return 'Browser';
    }

    function getDeviceName() {
        const explicit = localStorage.getItem('quickdrop-device-name');
        if (explicit) {
            return explicit;
        }
        const user = typeof getStoredAuthUser === 'function' ? getStoredAuthUser() : {};
        const owner = user?.nickname || user?.username || 'QuickDrop';
        return `${owner} · ${detectDeviceType()}`;
    }

    function getWsUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const params = new URLSearchParams();
        params.set('deviceId', getDeviceId());
        params.set('deviceName', getDeviceName());
        params.set('deviceType', detectDeviceType());
        if (typeof getAuthToken === 'function' && getAuthToken()) {
            params.set('token', getAuthToken());
        } else {
            params.set('guestId', getGuestId());
        }
        return `${protocol}//${window.location.host}/ws/quickdrop?${params.toString()}`;
    }

    function extractDeviceId(channelId) {
        if (!channelId) {
            return '';
        }
        const marker = channelId.indexOf(':device:');
        if (marker < 0) {
            return '';
        }
        return channelId.slice(marker + ':device:'.length()).trim();
    }

    function setDirectState(nextState) {
        state.directState = nextState;
        updateStatusUi();
    }

    function updateStatusUi() {
        const status = document.getElementById('quickDropSignalStatus');
        const code = document.getElementById('quickDropPairCodeDisplay');
        const meta = document.getElementById('quickDropPairingMeta');
        const directStatus = document.getElementById('quickDropDirectStatus');

        if (status) {
            status.className = `status-pill ${state.connected ? 'online' : 'offline'}`;
            status.textContent = state.connected
                ? text('quickDropSignalConnected', 'Signaling Connected')
                : text('quickDropSignalDisconnected', 'Signaling Offline');
        }

        if (code) {
            code.textContent = state.latestCode || text('quickDropPairCodeEmpty', 'No active match code');
        }

        if (meta) {
            if (state.pairSessionId) {
                meta.textContent = `${text('quickDropPairReady', 'Paired with')}: ${state.latestPeerLabel || state.latestPeerChannelId || '-'}`;
            } else if (state.channelId) {
                meta.textContent = `${text('quickDropSignalChannel', 'Channel')}: ${state.channelId}`;
            } else {
                meta.textContent = text('quickDropSignalIdle', 'Connect first, then create or claim a match code.');
            }
        }

        if (directStatus) {
            const labels = {
                idle: text('quickDropDirectIdle', 'Direct Link Idle'),
                negotiating: text('quickDropDirectNegotiating', 'Direct Link Negotiating'),
                ready: text('quickDropDirectReady', 'Direct Link Ready'),
                unavailable: text('quickDropDirectUnavailable', 'Still falling back to server relay')
            };
            directStatus.textContent = labels[state.directState] || labels.idle;
            directStatus.className = `status-pill ${state.directState === 'ready' ? 'online' : 'offline'}`;
        }

        emit('quickdrop:direct-statechange', {
            directState: state.directState,
            connected: state.connected,
            pairSessionId: state.pairSessionId,
            peerLabel: state.latestPeerLabel,
            peerChannelId: state.latestPeerChannelId,
            peerDeviceId: state.latestPeerDeviceId
        });
    }

    function send(payload) {
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        state.socket.send(JSON.stringify(payload));
    }

    function hasOpenDirectChannels() {
        return state.controlChannel?.readyState === 'open' && state.fileChannel?.readyState === 'open';
    }

    async function waitForSignalConnection(timeoutMs = 1200) {
        if (state.connected) {
            return true;
        }
        return new Promise(resolve => {
            let finished = false;
            const check = () => {
                if (finished) {
                    return;
                }
                if (state.connected) {
                    finished = true;
                    cleanup();
                    resolve(true);
                }
            };
            const cleanup = () => {
                document.removeEventListener('quickdrop:signal-message', check);
                clearInterval(interval);
                clearTimeout(timer);
            };
            document.addEventListener('quickdrop:signal-message', check);
            const interval = window.setInterval(check, 50);
            const timer = window.setTimeout(() => {
                if (finished) {
                    return;
                }
                finished = true;
                cleanup();
                resolve(state.connected);
            }, timeoutMs);
        });
    }

    function updateDirectChannelState() {
        if (hasOpenDirectChannels()) {
            setDirectState('ready');
            return;
        }

        if (!state.pairSessionId) {
            setDirectState(state.connected ? 'idle' : 'idle');
            return;
        }

        if (state.peerConnection) {
            const pcState = state.peerConnection.connectionState;
            if (pcState === 'failed' || pcState === 'disconnected' || pcState === 'closed') {
                setDirectState('unavailable');
            } else {
                setDirectState('negotiating');
            }
            return;
        }

        setDirectState(state.connected ? 'negotiating' : 'idle');
    }

    function closeDataChannel(channel) {
        if (!channel) {
            return;
        }
        try {
            channel.close();
        } catch (error) {
            // ignore
        }
    }

    function cleanupPeerConnection(nextDirectState = 'idle') {
        closeDataChannel(state.controlChannel);
        closeDataChannel(state.fileChannel);
        if (state.peerConnection) {
            try {
                state.peerConnection.close();
            } catch (error) {
                // ignore
            }
        }
        state.controlChannel = null;
        state.fileChannel = null;
        state.peerConnection = null;
        state.pendingRemoteCandidates = [];
        setDirectState(nextDirectState);
        emit('quickdrop:direct-close', {
            pairSessionId: state.pairSessionId,
            peerLabel: state.latestPeerLabel,
            peerChannelId: state.latestPeerChannelId,
            peerDeviceId: state.latestPeerDeviceId
        });
    }

    async function fetchRtcConfig() {
        if (state.rtcConfig) {
            return state.rtcConfig;
        }
        if (typeof RTCPeerConnection !== 'function') {
            state.rtcConfig = { directTransferEnabled: false, iceServers: [] };
            return state.rtcConfig;
        }
        const response = await fetch(`${API_BASE}/public/quickdrop/rtc-config`);
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'RTC config failed');
        }
        state.rtcConfig = result.data || { directTransferEnabled: false, iceServers: [] };
        return state.rtcConfig;
    }

    function bindControlChannel(channel) {
        state.controlChannel = channel;
        channel.onopen = () => {
            updateDirectChannelState();
            emit('quickdrop:direct-open', {
                channel: 'control',
                pairSessionId: state.pairSessionId,
                peerLabel: state.latestPeerLabel,
                peerChannelId: state.latestPeerChannelId,
                peerDeviceId: state.latestPeerDeviceId
            });
            try {
                channel.send(JSON.stringify({ type: 'hello', channelId: state.channelId }));
            } catch (error) {
                // ignore
            }
        };
        channel.onmessage = event => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch (error) {
                return;
            }
            emit('quickdrop:direct-control', { message });
        };
        channel.onclose = updateDirectChannelState;
        channel.onerror = () => {
            setDirectState('unavailable');
        };
    }

    function bindFileChannel(channel) {
        state.fileChannel = channel;
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => {
            updateDirectChannelState();
            emit('quickdrop:direct-open', {
                channel: 'file',
                pairSessionId: state.pairSessionId,
                peerLabel: state.latestPeerLabel,
                peerChannelId: state.latestPeerChannelId,
                peerDeviceId: state.latestPeerDeviceId
            });
        };
        channel.onmessage = event => {
            emit('quickdrop:direct-binary', { data: event.data });
        };
        channel.onclose = updateDirectChannelState;
        channel.onerror = () => {
            setDirectState('unavailable');
        };
    }

    async function flushPendingRemoteCandidates() {
        if (!state.peerConnection || !state.pendingRemoteCandidates.length) {
            return;
        }
        const pending = [...state.pendingRemoteCandidates];
        state.pendingRemoteCandidates = [];
        for (const candidate of pending) {
            try {
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                // ignore candidate races
            }
        }
    }

    async function beginRtcNegotiation() {
        const rtcConfig = await fetchRtcConfig().catch(() => ({ directTransferEnabled: false, iceServers: [] }));
        if (!rtcConfig.directTransferEnabled || typeof RTCPeerConnection !== 'function') {
            setDirectState('unavailable');
            return;
        }
        if (!state.pairSessionId || !state.latestPeerChannelId) {
            return;
        }

        cleanupPeerConnection('negotiating');

        const pc = new RTCPeerConnection({
            iceServers: rtcConfig.iceServers || []
        });
        state.peerConnection = pc;

        pc.onicecandidate = event => {
            if (!event.candidate) {
                return;
            }
            QuickDropSignalManager.sendSignal('candidate', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                setDirectState('unavailable');
                return;
            }
            updateDirectChannelState();
        };

        pc.ondatachannel = event => {
            if (event.channel.label === 'quickdrop-file') {
                bindFileChannel(event.channel);
                return;
            }
            bindControlChannel(event.channel);
        };

        const initiator = state.channelId && state.latestPeerChannelId && state.channelId < state.latestPeerChannelId;
        if (initiator) {
            bindControlChannel(pc.createDataChannel('quickdrop-control', { ordered: true }));
            bindFileChannel(pc.createDataChannel('quickdrop-file', { ordered: true }));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            QuickDropSignalManager.sendSignal('offer', offer);
        }
    }

    async function handleSignalPayload(payload) {
        const rtcConfig = await fetchRtcConfig().catch(() => ({ directTransferEnabled: false, iceServers: [] }));
        if (!rtcConfig.directTransferEnabled || typeof RTCPeerConnection !== 'function') {
            setDirectState('unavailable');
            return;
        }
        if (!state.peerConnection) {
            await beginRtcNegotiation();
        }
        const pc = state.peerConnection;
        if (!pc) {
            return;
        }
        const signalType = payload.signalType;
        const signalPayload = payload.payload || {};

        if (signalType === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signalPayload));
            await flushPendingRemoteCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            QuickDropSignalManager.sendSignal('answer', answer);
            setDirectState('negotiating');
            return;
        }

        if (signalType === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signalPayload));
            await flushPendingRemoteCandidates();
            setDirectState('negotiating');
            return;
        }

        if (signalType === 'candidate') {
            if (!pc.remoteDescription || !pc.remoteDescription.type) {
                state.pendingRemoteCandidates.push(signalPayload);
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(signalPayload));
            } catch (error) {
                // ignore candidate races
            }
        }
    }

    async function createPairCode() {
        const response = await fetch(`${API_BASE}/public/quickdrop/pair-codes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {})
            },
            body: JSON.stringify({
                deviceId: getDeviceId(),
                guestId: typeof getAuthToken === 'function' && getAuthToken() ? null : getGuestId(),
                deviceName: getDeviceName(),
                deviceType: detectDeviceType()
            })
        });
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Create pair code failed');
        }
        state.latestCode = result.data.code || '';
        updateStatusUi();
        return result.data;
    }

    async function claimPairCode(code) {
        const normalizedCode = String(code || '').trim().toUpperCase();
        if (!normalizedCode) {
            throw new Error(text('quickDropPairCodeRequired', 'Match code is required'));
        }
        const response = await fetch(`${API_BASE}/public/quickdrop/pair-codes/${encodeURIComponent(normalizedCode)}/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {})
            },
            body: JSON.stringify({
                deviceId: getDeviceId(),
                guestId: typeof getAuthToken === 'function' && getAuthToken() ? null : getGuestId(),
                deviceName: getDeviceName(),
                deviceType: detectDeviceType()
            })
        });
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Claim pair code failed');
        }
        state.pairSessionId = result.data.pairSessionId || '';
        state.latestPeerLabel = result.data.peerLabel || '';
        state.latestPeerChannelId = result.data.peerChannelId || '';
        state.latestPeerDeviceId = result.data.peerDeviceId || extractDeviceId(state.latestPeerChannelId);
        updateStatusUi();
        beginRtcNegotiation().catch(() => {
            setDirectState('unavailable');
        });
        return result.data;
    }

    async function createSameAccountDirectSession(targetDeviceId) {
        const response = await fetch(`${API_BASE}/quickdrop/direct-sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {})
            },
            body: JSON.stringify({
                deviceId: getDeviceId(),
                targetDeviceId
            })
        });
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'Create direct session failed');
        }
        return result.data || {};
    }

    async function ensurePairWithDevice(targetDeviceId, options = {}) {
        const normalizedTargetDeviceId = String(targetDeviceId || '').trim();
        if (!normalizedTargetDeviceId) {
            throw new Error(text('quickDropChooseDeviceFirst', 'Choose a target device first'));
        }
        if (!(typeof getAuthToken === 'function' && getAuthToken())) {
            throw new Error(text('quickDropLoginRequired', 'Please sign in before using QuickDrop'));
        }
        if (!state.connected) {
            connect();
            const connected = await waitForSignalConnection();
            if (!connected) {
                throw new Error(text('quickDropSignalDisconnected', 'Signaling Offline'));
            }
        }
        if (!options.force
            && state.latestPeerDeviceId === normalizedTargetDeviceId
            && state.pairSessionId
            && (state.directState === 'ready' || state.directState === 'negotiating')) {
            return {
                pairSessionId: state.pairSessionId,
                peerChannelId: state.latestPeerChannelId,
                peerDeviceId: state.latestPeerDeviceId,
                peerLabel: state.latestPeerLabel
            };
        }

        if (state.pairSessionRequest && state.pairSessionRequest.targetDeviceId === normalizedTargetDeviceId) {
            return state.pairSessionRequest.promise;
        }

        const requestPromise = createSameAccountDirectSession(normalizedTargetDeviceId)
            .then(data => {
                state.pairSessionId = data.pairSessionId || state.pairSessionId;
                state.latestPeerLabel = data.peerLabel || state.latestPeerLabel;
                state.latestPeerChannelId = data.peerChannelId || state.latestPeerChannelId;
                state.latestPeerDeviceId = data.peerDeviceId || extractDeviceId(state.latestPeerChannelId);
                updateStatusUi();
                beginRtcNegotiation().catch(() => {
                    setDirectState('unavailable');
                });
                return data;
            })
            .finally(() => {
                state.pairSessionRequest = null;
            });
        state.pairSessionRequest = {
            targetDeviceId: normalizedTargetDeviceId,
            promise: requestPromise
        };
        return requestPromise;
    }

    async function waitForDirectReady(expectedPeerDeviceId, timeoutMs = 2500) {
        const normalizedExpectedPeerDeviceId = String(expectedPeerDeviceId || '').trim();
        const readyNow = state.directState === 'ready'
            && hasOpenDirectChannels()
            && (!normalizedExpectedPeerDeviceId || state.latestPeerDeviceId === normalizedExpectedPeerDeviceId);
        if (readyNow) {
            return true;
        }
        return new Promise(resolve => {
            let finished = false;
            const handler = event => {
                const detail = event.detail || {};
                const matchesPeer = !normalizedExpectedPeerDeviceId || detail.peerDeviceId === normalizedExpectedPeerDeviceId;
                if (detail.directState === 'ready' && matchesPeer) {
                    finished = true;
                    cleanup();
                    resolve(true);
                }
            };
            const cleanup = () => {
                document.removeEventListener('quickdrop:direct-statechange', handler);
                clearTimeout(timer);
            };
            document.addEventListener('quickdrop:direct-statechange', handler);
            const timer = window.setTimeout(() => {
                if (finished) {
                    return;
                }
                finished = true;
                cleanup();
                resolve(false);
            }, timeoutMs);
        });
    }

    function connect() {
        if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        state.socket = new WebSocket(getWsUrl());

        state.socket.addEventListener('open', () => {
            state.connected = true;
            updateStatusUi();
            if (state.pingTimer) {
                clearInterval(state.pingTimer);
            }
            state.pingTimer = window.setInterval(() => {
                send({ type: 'ping' });
            }, 25000);
        });

        state.socket.addEventListener('message', event => {
            let payload;
            try {
                payload = JSON.parse(event.data);
            } catch (error) {
                return;
            }

            if (payload.type === 'welcome') {
                state.channelId = payload.channelId || '';
                updateStatusUi();
            }

            if (payload.type === 'pair-ready') {
                const nextPairSessionId = payload.pairSessionId || '';
                if (state.pairSessionId && state.pairSessionId !== nextPairSessionId) {
                    cleanupPeerConnection('idle');
                }
                state.pairSessionId = nextPairSessionId;
                state.latestPeerLabel = payload.peerLabel || '';
                state.latestPeerChannelId = payload.peerChannelId || '';
                state.latestPeerDeviceId = payload.peerDeviceId || extractDeviceId(state.latestPeerChannelId);
                updateStatusUi();
                beginRtcNegotiation().catch(() => {
                    setDirectState('unavailable');
                });
                showToast(text('quickDropPairReadyToast', 'Pairing succeeded'), 'success');
            }

            if (payload.type === 'signal') {
                handleSignalPayload(payload).catch(() => {
                    setDirectState('unavailable');
                });
            }

            emit('quickdrop:signal-message', payload);
        });

        state.socket.addEventListener('close', () => {
            state.connected = false;
            if (state.pingTimer) {
                clearInterval(state.pingTimer);
                state.pingTimer = null;
            }
            cleanupPeerConnection('idle');
            updateStatusUi();
        });

        state.socket.addEventListener('error', () => {
            state.connected = false;
            cleanupPeerConnection('idle');
            updateStatusUi();
        });
    }

    function bindUi() {
        const createButton = document.getElementById('quickDropCreatePairCodeBtn');
        const claimButton = document.getElementById('quickDropClaimPairCodeBtn');
        const input = document.getElementById('quickDropPairCodeInput');

        if (createButton) {
            createButton.addEventListener('click', async () => {
                try {
                    connect();
                    await createPairCode();
                    showToast(text('quickDropPairCodeCreated', 'Match code created'), 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        }

        if (claimButton) {
            claimButton.addEventListener('click', async () => {
                try {
                    connect();
                    const code = input ? input.value : '';
                    await claimPairCode(code);
                    showToast(text('quickDropPairCodeClaimed', 'Joined match code'), 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        }

        document.addEventListener('quickshare:languagechange', updateStatusUi);
    }

    function init() {
        if (!document.getElementById('quickDropSignalStatus')) {
            return;
        }
        bindUi();
        connect();
        updateStatusUi();
    }

    return {
        init,
        connect,
        sendSignal(signalType, payload) {
            if (!state.pairSessionId) {
                return;
            }
            send({
                type: 'signal',
                pairSessionId: state.pairSessionId,
                signalType,
                payload
            });
        },
        sendDirectControl(message) {
            if (!state.controlChannel || state.controlChannel.readyState !== 'open') {
                return false;
            }
            state.controlChannel.send(JSON.stringify(message));
            return true;
        },
        sendDirectBinary(data) {
            if (!state.fileChannel || state.fileChannel.readyState !== 'open') {
                return false;
            }
            state.fileChannel.send(data);
            return true;
        },
        async waitForDirectDrain(maxBufferedAmount = 512 * 1024, timeoutMs = 5000) {
            if (!state.fileChannel || state.fileChannel.readyState !== 'open') {
                return;
            }
            const channel = state.fileChannel;
            if (channel.bufferedAmount <= maxBufferedAmount) {
                return;
            }
            await new Promise(resolve => {
                let finished = false;
                const interval = window.setInterval(() => {
                    if (finished) {
                        return;
                    }
                    if (!state.fileChannel || state.fileChannel.readyState !== 'open' || state.fileChannel.bufferedAmount <= maxBufferedAmount) {
                        finished = true;
                        clearInterval(interval);
                        clearTimeout(timeout);
                        resolve();
                    }
                }, 40);
                const timeout = window.setTimeout(() => {
                    if (finished) {
                        return;
                    }
                    finished = true;
                    clearInterval(interval);
                    resolve();
                }, timeoutMs);
            });
        },
        isDirectReady() {
            return state.directState === 'ready' && hasOpenDirectChannels();
        },
        restartDirectNegotiation() {
            return beginRtcNegotiation();
        },
        ensurePairWithDevice(targetDeviceId, options) {
            return ensurePairWithDevice(targetDeviceId, options);
        },
        waitForDirectReady(expectedPeerDeviceId, timeoutMs) {
            return waitForDirectReady(expectedPeerDeviceId, timeoutMs);
        },
        getState() {
            return {
                ...state,
                controlChannelOpen: state.controlChannel?.readyState === 'open',
                fileChannelOpen: state.fileChannel?.readyState === 'open'
            };
        }
    };
})();

window.QuickDropSignalManager = QuickDropSignalManager;

document.addEventListener('DOMContentLoaded', () => {
    QuickDropSignalManager.init();
});
