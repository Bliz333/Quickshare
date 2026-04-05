const TRANSFER_SIGNAL_DEVICE_ID_KEY = 'transfer-device-id';
const TRANSFER_SIGNAL_GUEST_ID_KEY = 'transfer-guest-id';

const TransferSignalManager = (() => {
    function nowIso() {
        return new Date().toISOString();
    }

    function createCandidateTypeCounts() {
        return {
            host: 0,
            srflx: 0,
            relay: 0,
            prflx: 0,
            unknown: 0
        };
    }

    function createCandidateProtocolCounts() {
        return {
            udp: 0,
            tcp: 0,
            unknown: 0
        };
    }

    function createDirectDiagnostics(previous = {}) {
        return {
            negotiationId: Number(previous.negotiationId || 0),
            rtcFetchedAt: previous.rtcFetchedAt || '',
            rtcHasTurn: Boolean(previous.rtcHasTurn),
            rtcHasStun: Boolean(previous.rtcHasStun),
            iceServerUrls: Array.isArray(previous.iceServerUrls) ? [...previous.iceServerUrls] : [],
            negotiationStartedAt: '',
            lastSignalType: '',
            connectionState: '',
            iceConnectionState: '',
            iceGatheringState: '',
            signalingState: '',
            controlChannelState: '',
            fileChannelState: '',
            localCandidateTypes: createCandidateTypeCounts(),
            remoteCandidateTypes: createCandidateTypeCounts(),
            localCandidateProtocols: createCandidateProtocolCounts(),
            remoteCandidateProtocols: createCandidateProtocolCounts(),
            selectedCandidatePair: null,
            selectedCandidatePairAt: '',
            lastReadyAt: previous.lastReadyAt || '',
            lastUnavailableAt: previous.lastUnavailableAt || '',
            lastCloseAt: '',
            lastWaitTimeoutMs: 0,
            lastWaitResult: '',
            lastWaitCompletedAt: '',
            events: []
        };
    }

    function cloneDirectDiagnostics(diagnostics) {
        const current = diagnostics || createDirectDiagnostics();
        return {
            ...current,
            iceServerUrls: [...(current.iceServerUrls || [])],
            localCandidateTypes: { ...(current.localCandidateTypes || createCandidateTypeCounts()) },
            remoteCandidateTypes: { ...(current.remoteCandidateTypes || createCandidateTypeCounts()) },
            localCandidateProtocols: { ...(current.localCandidateProtocols || createCandidateProtocolCounts()) },
            remoteCandidateProtocols: { ...(current.remoteCandidateProtocols || createCandidateProtocolCounts()) },
            selectedCandidatePair: current.selectedCandidatePair ? { ...current.selectedCandidatePair } : null,
            events: [...(current.events || [])].map(event => ({ ...event }))
        };
    }

    const state = {
        socket: null,
        connected: false,
        channelId: '',
        roomId: '',
        roomDevices: [],
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
        negotiationContextKey: '',
        negotiationPromise: null,
        pendingRemoteCandidates: [],
        pairSessionRequest: null,
        directDiagnostics: createDirectDiagnostics()
    };

    function text(key, fallback) {
        return typeof t === 'function' ? t(key) : fallback;
    }

    function emit(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    function parseCandidateType(candidate) {
        const explicitType = candidate?.type;
        if (explicitType) {
            return String(explicitType).trim().toLowerCase();
        }
        const raw = typeof candidate === 'string' ? candidate : candidate?.candidate || '';
        const match = String(raw).match(/\btyp\s+([a-z]+)/i);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    function parseCandidateProtocol(candidate) {
        const explicitProtocol = candidate?.protocol;
        if (explicitProtocol) {
            return String(explicitProtocol).trim().toLowerCase();
        }
        const raw = typeof candidate === 'string' ? candidate : candidate?.candidate || '';
        const match = String(raw).match(/\b(udp|tcp)\b/i);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    function incrementCandidateCount(target, key) {
        const normalizedKey = target[key] != null ? key : 'unknown';
        target[normalizedKey] = Number(target[normalizedKey] || 0) + 1;
    }

    function recordDirectCandidate(side, candidate) {
        const diagnostics = state.directDiagnostics;
        const typeKey = parseCandidateType(candidate);
        const protocolKey = parseCandidateProtocol(candidate);
        if (side === 'local') {
            incrementCandidateCount(diagnostics.localCandidateTypes, typeKey);
            incrementCandidateCount(diagnostics.localCandidateProtocols, protocolKey);
            return;
        }
        incrementCandidateCount(diagnostics.remoteCandidateTypes, typeKey);
        incrementCandidateCount(diagnostics.remoteCandidateProtocols, protocolKey);
    }

    function recordDirectEvent(type, extra = {}) {
        state.directDiagnostics.events = [
            ...(state.directDiagnostics.events || []),
            {
                at: nowIso(),
                type,
                ...extra
            }
        ].slice(-40);
    }

    function updatePeerConnectionDiagnostics(pc) {
        if (!pc) {
            return;
        }
        state.directDiagnostics.connectionState = pc.connectionState || '';
        state.directDiagnostics.iceConnectionState = pc.iceConnectionState || '';
        state.directDiagnostics.iceGatheringState = pc.iceGatheringState || '';
        state.directDiagnostics.signalingState = pc.signalingState || '';
    }

    async function refreshSelectedCandidatePair(pc) {
        if (!pc || typeof pc.getStats !== 'function') {
            return;
        }
        try {
            const stats = await pc.getStats();
            let selectedPair = null;
            for (const stat of stats.values()) {
                if (stat.type === 'transport' && stat.selectedCandidatePairId) {
                    selectedPair = stats.get(stat.selectedCandidatePairId) || null;
                    break;
                }
            }
            if (!selectedPair) {
                for (const stat of stats.values()) {
                    if (stat.type === 'candidate-pair' && (stat.selected || (stat.nominated && stat.state === 'succeeded'))) {
                        selectedPair = stat;
                        break;
                    }
                }
            }
            if (!selectedPair) {
                return;
            }
            const localCandidate = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
            const remoteCandidate = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;
            state.directDiagnostics.selectedCandidatePair = {
                state: selectedPair.state || '',
                nominated: Boolean(selectedPair.nominated),
                localCandidateType: localCandidate?.candidateType || '',
                remoteCandidateType: remoteCandidate?.candidateType || '',
                localProtocol: localCandidate?.protocol || '',
                remoteProtocol: remoteCandidate?.protocol || '',
                localAddress: localCandidate?.address || localCandidate?.ip || '',
                remoteAddress: remoteCandidate?.address || remoteCandidate?.ip || ''
            };
            state.directDiagnostics.selectedCandidatePairAt = nowIso();
            recordDirectEvent('selected_candidate_pair', {
                localCandidateType: state.directDiagnostics.selectedCandidatePair.localCandidateType,
                remoteCandidateType: state.directDiagnostics.selectedCandidatePair.remoteCandidateType,
                localProtocol: state.directDiagnostics.selectedCandidatePair.localProtocol,
                remoteProtocol: state.directDiagnostics.selectedCandidatePair.remoteProtocol,
                pairState: state.directDiagnostics.selectedCandidatePair.state
            });
        } catch (error) {
            recordDirectEvent('stats_error', {
                message: error?.message || String(error)
            });
        }
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
        return ensureStorageValue(TRANSFER_SIGNAL_DEVICE_ID_KEY, () => {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            return `qd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        });
    }

    function getGuestId() {
        return ensureStorageValue(TRANSFER_SIGNAL_GUEST_ID_KEY, () => {
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
        const explicit = localStorage.getItem('transfer-device-name');
        if (explicit) {
            return explicit;
        }
        const user = typeof getStoredAuthUser === 'function' ? getStoredAuthUser() : {};
        const owner = user?.nickname || user?.username || 'Transfer';
        return `${owner} · ${detectDeviceType()}`;
    }

    function getWsOrigin() {
        const configuredApiBase = window.AppConfig?.API_BASE || '';
        if (configuredApiBase) {
            try {
                const apiUrl = new URL(configuredApiBase, window.location.href);
                const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
                return `${protocol}//${apiUrl.host}`;
            } catch (error) {
                // fall back to the current page origin
            }
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}`;
    }

    function getWsUrl() {
        const params = new URLSearchParams();
        params.set('deviceId', getDeviceId());
        params.set('deviceName', getDeviceName());
        params.set('deviceType', detectDeviceType());
        if (typeof getAuthToken === 'function' && getAuthToken()) {
            params.set('token', getAuthToken());
        } else {
            params.set('guestId', getGuestId());
        }
        return `${getWsOrigin()}/ws/transfer?${params.toString()}`;
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
        const previousState = state.directState;
        state.directState = nextState;
        if (nextState === 'ready' && previousState !== 'ready') {
            state.directDiagnostics.lastReadyAt = nowIso();
            recordDirectEvent('direct_ready', {
                pairSessionId: state.pairSessionId,
                peerDeviceId: state.latestPeerDeviceId
            });
        } else if (nextState === 'unavailable' && previousState !== 'unavailable') {
            state.directDiagnostics.lastUnavailableAt = nowIso();
            recordDirectEvent('direct_unavailable', {
                pairSessionId: state.pairSessionId,
                peerDeviceId: state.latestPeerDeviceId,
                connectionState: state.directDiagnostics.connectionState,
                iceConnectionState: state.directDiagnostics.iceConnectionState
            });
        } else if (nextState !== previousState) {
            recordDirectEvent('direct_state', {
                from: previousState,
                to: nextState
            });
        }
        updateStatusUi();
    }

    function updateStatusUi() {
        const status = document.getElementById('transferSignalStatus');
        const code = document.getElementById('transferPairCodeDisplay');
        const meta = document.getElementById('transferPairingMeta');
        const directStatus = document.getElementById('transferDirectStatus');

        if (status) {
            status.className = `status-pill ${state.connected ? 'online' : 'offline'}`;
            status.textContent = state.connected
                ? text('transferSignalConnected', 'Signaling Connected')
                : text('transferSignalDisconnected', 'Signaling Offline');
        }

        if (code) {
            code.textContent = state.latestCode || text('transferPairCodeEmpty', 'No active match code');
        }

        if (meta) {
            if (state.pairSessionId) {
                meta.textContent = `${text('transferPairReady', 'Paired with')}: ${state.latestPeerLabel || state.latestPeerChannelId || '-'}`;
            } else if (state.channelId) {
                meta.textContent = `${text('transferSignalChannel', 'Channel')}: ${state.channelId}`;
            } else {
                meta.textContent = text('transferSignalIdle', 'Connect first, then create or claim a match code.');
            }
        }

        if (directStatus) {
            const labels = {
                idle: text('transferDirectIdle', 'Direct Link Idle'),
                negotiating: text('transferDirectNegotiating', 'Direct Link Negotiating'),
                ready: text('transferDirectReady', 'Direct Link Ready'),
                unavailable: text('transferDirectUnavailable', 'Still falling back to server relay')
            };
            directStatus.textContent = labels[state.directState] || labels.idle;
            directStatus.className = `status-pill ${state.directState === 'ready' ? 'online' : 'offline'}`;
        }

        emit('transfer:direct-statechange', {
            directState: state.directState,
            connected: state.connected,
            roomId: state.roomId,
            roomDevices: [...(state.roomDevices || [])],
            pairSessionId: state.pairSessionId,
            peerLabel: state.latestPeerLabel,
            peerChannelId: state.latestPeerChannelId,
            peerDeviceId: state.latestPeerDeviceId,
            diagnostics: cloneDirectDiagnostics(state.directDiagnostics)
        });
    }

    function requestRoomDevices() {
        send({ type: 'room-devices' });
    }

    function getNegotiationContextKey(pairSessionId = state.pairSessionId, peerChannelId = state.latestPeerChannelId) {
        const normalizedPairSessionId = String(pairSessionId || '').trim();
        const normalizedPeerChannelId = String(peerChannelId || '').trim();
        if (!normalizedPairSessionId || !normalizedPeerChannelId) {
            return '';
        }
        return `${normalizedPairSessionId}::${normalizedPeerChannelId}`;
    }

    function isNegotiationContextCurrent(contextKey) {
        return Boolean(contextKey) && contextKey === state.negotiationContextKey;
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
                document.removeEventListener('transfer:signal-message', check);
                clearInterval(interval);
                clearTimeout(timer);
            };
            document.addEventListener('transfer:signal-message', check);
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
        if (nextDirectState !== 'negotiating') {
            state.negotiationContextKey = '';
        }
        state.directDiagnostics.controlChannelState = 'closed';
        state.directDiagnostics.fileChannelState = 'closed';
        state.directDiagnostics.connectionState = '';
        state.directDiagnostics.iceConnectionState = '';
        state.directDiagnostics.iceGatheringState = '';
        state.directDiagnostics.signalingState = '';
        state.directDiagnostics.lastCloseAt = nowIso();
        setDirectState(nextDirectState);
        emit('transfer:direct-close', {
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
        const response = await fetch(`${API_BASE}/public/transfer/rtc-config`);
        const result = await response.json();
        if (!response.ok || result.code !== 200) {
            throw new Error(result.message || 'RTC config failed');
        }
        state.rtcConfig = result.data || { directTransferEnabled: false, iceServers: [] };
        const urls = (state.rtcConfig.iceServers || [])
            .flatMap(server => Array.isArray(server?.urls) ? server.urls : [])
            .filter(Boolean)
            .map(url => String(url));
        state.directDiagnostics.rtcFetchedAt = nowIso();
        state.directDiagnostics.rtcHasTurn = urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
        state.directDiagnostics.rtcHasStun = urls.some(url => url.startsWith('stun:') || url.startsWith('stuns:'));
        state.directDiagnostics.iceServerUrls = urls;
        recordDirectEvent('rtc_config', {
            directTransferEnabled: Boolean(state.rtcConfig.directTransferEnabled),
            rtcHasTurn: state.directDiagnostics.rtcHasTurn,
            rtcHasStun: state.directDiagnostics.rtcHasStun,
            iceServers: urls.length
        });
        return state.rtcConfig;
    }

    function bindControlChannel(channel) {
        state.controlChannel = channel;
        state.directDiagnostics.controlChannelState = channel.readyState || 'connecting';
        channel.onopen = () => {
            state.directDiagnostics.controlChannelState = channel.readyState || 'open';
            updateDirectChannelState();
            emit('transfer:direct-open', {
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
            emit('transfer:direct-control', { message });
        };
        channel.onclose = () => {
            state.directDiagnostics.controlChannelState = channel.readyState || 'closed';
            updateDirectChannelState();
        };
        channel.onerror = () => {
            state.directDiagnostics.controlChannelState = channel.readyState || 'error';
            setDirectState('unavailable');
        };
    }

    function bindFileChannel(channel) {
        state.fileChannel = channel;
        channel.binaryType = 'arraybuffer';
        state.directDiagnostics.fileChannelState = channel.readyState || 'connecting';
        channel.onopen = () => {
            state.directDiagnostics.fileChannelState = channel.readyState || 'open';
            updateDirectChannelState();
            emit('transfer:direct-open', {
                channel: 'file',
                pairSessionId: state.pairSessionId,
                peerLabel: state.latestPeerLabel,
                peerChannelId: state.latestPeerChannelId,
                peerDeviceId: state.latestPeerDeviceId
            });
        };
        channel.onmessage = event => {
            emit('transfer:direct-binary', { data: event.data });
        };
        channel.onclose = () => {
            state.directDiagnostics.fileChannelState = channel.readyState || 'closed';
            updateDirectChannelState();
        };
        channel.onerror = () => {
            state.directDiagnostics.fileChannelState = channel.readyState || 'error';
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

    async function beginRtcNegotiation(options = {}) {
        const contextKey = getNegotiationContextKey();
        if (!contextKey) {
            return;
        }

        const activePeerConnection = state.peerConnection
            && (state.directState === 'negotiating' || state.directState === 'ready');
        if (!options.force && isNegotiationContextCurrent(contextKey)) {
            if (state.negotiationPromise) {
                return state.negotiationPromise;
            }
            if (activePeerConnection) {
                return;
            }
        }

        state.negotiationContextKey = contextKey;
        const negotiationPromise = (async () => {
            const rtcConfig = await fetchRtcConfig().catch(() => ({ directTransferEnabled: false, iceServers: [] }));
            if (!isNegotiationContextCurrent(contextKey)) {
                return;
            }
            if (!rtcConfig.directTransferEnabled || typeof RTCPeerConnection !== 'function') {
                setDirectState('unavailable');
                return;
            }
            if (!state.pairSessionId || !state.latestPeerChannelId) {
                return;
            }

            cleanupPeerConnection('negotiating');
            state.negotiationContextKey = contextKey;
            state.directDiagnostics = {
                ...createDirectDiagnostics(state.directDiagnostics),
                negotiationId: Number(state.directDiagnostics.negotiationId || 0) + 1,
                rtcFetchedAt: state.directDiagnostics.rtcFetchedAt,
                rtcHasTurn: state.directDiagnostics.rtcHasTurn,
                rtcHasStun: state.directDiagnostics.rtcHasStun,
                iceServerUrls: [...(state.directDiagnostics.iceServerUrls || [])],
                lastReadyAt: state.directDiagnostics.lastReadyAt,
                lastUnavailableAt: state.directDiagnostics.lastUnavailableAt
            };
            state.directDiagnostics.negotiationStartedAt = nowIso();
            recordDirectEvent('negotiation_start', {
                pairSessionId: state.pairSessionId,
                peerDeviceId: state.latestPeerDeviceId,
                rtcHasTurn: state.directDiagnostics.rtcHasTurn
            });

            const pc = new RTCPeerConnection({
                iceServers: rtcConfig.iceServers || []
            });
            if (!isNegotiationContextCurrent(contextKey)) {
                try {
                    pc.close();
                } catch (error) {
                    // ignore
                }
                return;
            }
            state.peerConnection = pc;
            updatePeerConnectionDiagnostics(pc);

            pc.onicecandidate = event => {
                if (!event.candidate) {
                    recordDirectEvent('local_candidate_complete', {
                        iceGatheringState: pc.iceGatheringState || ''
                    });
                    return;
                }
                const candidatePayload = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
                recordDirectCandidate('local', candidatePayload);
                TransferSignalManager.sendSignal('candidate', candidatePayload);
            };

            pc.oniceconnectionstatechange = () => {
                updatePeerConnectionDiagnostics(pc);
                recordDirectEvent('ice_connection_state', {
                    value: pc.iceConnectionState || ''
                });
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    refreshSelectedCandidatePair(pc).catch(() => {});
                }
                updateDirectChannelState();
            };

            pc.onicegatheringstatechange = () => {
                updatePeerConnectionDiagnostics(pc);
                recordDirectEvent('ice_gathering_state', {
                    value: pc.iceGatheringState || ''
                });
            };

            pc.onsignalingstatechange = () => {
                updatePeerConnectionDiagnostics(pc);
                recordDirectEvent('signaling_state', {
                    value: pc.signalingState || ''
                });
            };

            pc.onconnectionstatechange = () => {
                updatePeerConnectionDiagnostics(pc);
                recordDirectEvent('connection_state', {
                    value: pc.connectionState || ''
                });
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                    setDirectState('unavailable');
                    return;
                }
                if (pc.connectionState === 'connected') {
                    refreshSelectedCandidatePair(pc).catch(() => {});
                }
                updateDirectChannelState();
            };

            pc.ondatachannel = event => {
                if (event.channel.label === 'transfer-file') {
                    bindFileChannel(event.channel);
                    return;
                }
                bindControlChannel(event.channel);
            };

            const initiator = state.channelId && state.latestPeerChannelId && state.channelId < state.latestPeerChannelId;
            if (initiator) {
                bindControlChannel(pc.createDataChannel('transfer-control', { ordered: true }));
                bindFileChannel(pc.createDataChannel('transfer-file', { ordered: true }));
                const offer = await pc.createOffer();
                if (!isNegotiationContextCurrent(contextKey)) {
                    return;
                }
                await pc.setLocalDescription(offer);
                if (!isNegotiationContextCurrent(contextKey)) {
                    return;
                }
                TransferSignalManager.sendSignal('offer', offer);
            }
        })();
        state.negotiationPromise = negotiationPromise;
        try {
            return await negotiationPromise;
        } finally {
            if (state.negotiationPromise === negotiationPromise) {
                state.negotiationPromise = null;
            }
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
        state.directDiagnostics.lastSignalType = signalType || '';
        recordDirectEvent('signal', {
            signalType
        });

        if (signalType === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signalPayload));
            await flushPendingRemoteCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            TransferSignalManager.sendSignal('answer', answer);
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
            recordDirectCandidate('remote', signalPayload);
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
        const response = await fetch(`${API_BASE}/public/transfer/pair-codes`, {
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
            throw new Error(text('transferPairCodeRequired', 'Match code is required'));
        }
        const response = await fetch(`${API_BASE}/public/transfer/pair-codes/${encodeURIComponent(normalizedCode)}/claim`, {
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
        const response = await fetch(`${API_BASE}/transfer/direct-sessions`, {
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
            throw new Error(text('transferChooseDeviceFirst', 'Choose a target device first'));
        }
        if (!(typeof getAuthToken === 'function' && getAuthToken())) {
            throw new Error(text('transferLoginRequired', 'Please sign in before using Transfer'));
        }
        if (!state.connected) {
            connect();
            const connected = await waitForSignalConnection();
            if (!connected) {
                throw new Error(text('transferSignalDisconnected', 'Signaling Offline'));
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
        state.directDiagnostics.lastWaitTimeoutMs = timeoutMs;
        const readyNow = state.directState === 'ready'
            && hasOpenDirectChannels()
            && (!normalizedExpectedPeerDeviceId || state.latestPeerDeviceId === normalizedExpectedPeerDeviceId);
        if (readyNow) {
            state.directDiagnostics.lastWaitResult = 'ready_immediate';
            state.directDiagnostics.lastWaitCompletedAt = nowIso();
            return true;
        }
        return new Promise(resolve => {
            let finished = false;
            const handler = event => {
                const detail = event.detail || {};
                const matchesPeer = !normalizedExpectedPeerDeviceId || detail.peerDeviceId === normalizedExpectedPeerDeviceId;
                if (detail.directState === 'ready' && matchesPeer) {
                    finished = true;
                    state.directDiagnostics.lastWaitResult = 'ready_after_wait';
                    state.directDiagnostics.lastWaitCompletedAt = nowIso();
                    cleanup();
                    resolve(true);
                }
            };
            const cleanup = () => {
                document.removeEventListener('transfer:direct-statechange', handler);
                clearTimeout(timer);
            };
            document.addEventListener('transfer:direct-statechange', handler);
            const timer = window.setTimeout(() => {
                if (finished) {
                    return;
                }
                finished = true;
                state.directDiagnostics.lastWaitResult = 'timeout';
                state.directDiagnostics.lastWaitCompletedAt = nowIso();
                recordDirectEvent('ready_timeout', {
                    timeoutMs,
                    peerDeviceId: normalizedExpectedPeerDeviceId,
                    directState: state.directState
                });
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
            requestRoomDevices();
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
                requestRoomDevices();
            }

            if (payload.type === 'room-update') {
                state.roomId = payload.roomId || '';
                state.roomDevices = Array.isArray(payload.devices) ? payload.devices : [];
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
                showToast(text('transferPairReadyToast', 'Pairing succeeded'), 'success');
            }

            if (payload.type === 'signal') {
                handleSignalPayload(payload).catch(() => {
                    setDirectState('unavailable');
                });
            }

            if (payload.type === 'error') {
                showToast(payload.message || text('transferSignalDisconnected', 'Signaling Offline'), 'error');
            }

            emit('transfer:signal-message', payload);
        });

        state.socket.addEventListener('close', () => {
            state.connected = false;
            state.roomId = '';
            state.roomDevices = [];
            if (state.pingTimer) {
                clearInterval(state.pingTimer);
                state.pingTimer = null;
            }
            cleanupPeerConnection('idle');
            updateStatusUi();
        });

        state.socket.addEventListener('error', () => {
            state.connected = false;
            state.roomId = '';
            state.roomDevices = [];
            cleanupPeerConnection('idle');
            updateStatusUi();
        });
    }

    function bindUi() {
        const createButton = document.getElementById('transferCreatePairCodeBtn');
        const claimButton = document.getElementById('transferClaimPairCodeBtn');
        const input = document.getElementById('transferPairCodeInput');

        if (createButton) {
            createButton.addEventListener('click', async () => {
                try {
                    connect();
                    await createPairCode();
                    showToast(text('transferPairCodeCreated', 'Match code created'), 'success');
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
                    showToast(text('transferPairCodeClaimed', 'Joined match code'), 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        }

        document.addEventListener('quickshare:languagechange', updateStatusUi);
    }

    function init() {
        if (!document.getElementById('transferSignalStatus')) {
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
        requestRoomTransfer(targetChannelId) {
            const normalizedTargetChannelId = String(targetChannelId || '').trim();
            if (!normalizedTargetChannelId) {
                throw new Error(text('transferChooseDeviceFirst', 'Choose a target device first'));
            }
            if (!state.connected) {
                throw new Error(text('transferSignalDisconnected', 'Signaling Offline'));
            }
            send({
                type: 'request-transfer',
                targetChannelId: normalizedTargetChannelId
            });
            return {
                targetChannelId: normalizedTargetChannelId
            };
        },
        refreshRoomDevices() {
            requestRoomDevices();
        },
        waitForDirectReady(expectedPeerDeviceId, timeoutMs) {
            return waitForDirectReady(expectedPeerDeviceId, timeoutMs);
        },
        getRecommendedDirectWaitMs(baseMs = 2500) {
            let recommended = Number(baseMs) || 0;
            if (state.directDiagnostics.rtcHasTurn) {
                recommended = Math.max(recommended, 4500);
            }
            if (state.directState === 'negotiating') {
                recommended = Math.max(recommended, state.directDiagnostics.rtcHasTurn ? 7000 : 3200);
            }
            return recommended;
        },
        getState() {
            return {
                ...state,
                controlChannelOpen: state.controlChannel?.readyState === 'open',
                fileChannelOpen: state.fileChannel?.readyState === 'open',
                directDiagnostics: cloneDirectDiagnostics(state.directDiagnostics)
            };
        }
    };
})();

window.TransferSignalManager = TransferSignalManager;

document.addEventListener('DOMContentLoaded', () => {
    TransferSignalManager.init();
});
