package com.finalpre.quickshare.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.service.QuickDropSignalingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class QuickDropSignalingServiceImpl implements QuickDropSignalingService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> labels = new ConcurrentHashMap<>();
    private final Map<String, PairBinding> pairs = new ConcurrentHashMap<>();

    @Override
    public void registerSession(String channelId, String label, WebSocketSession session) throws IOException {
        sessions.put(channelId, session);
        labels.put(channelId, label);
        send(channelId, buildWelcomeMessage(channelId, label));
    }

    @Override
    public void unregisterSession(String channelId) {
        sessions.remove(channelId);
        labels.remove(channelId);
    }

    @Override
    public void bindPairSession(String pairSessionId, String leftChannelId, String rightChannelId) throws IOException {
        pairs.put(pairSessionId, new PairBinding(leftChannelId, rightChannelId));
        send(leftChannelId, Map.of(
                "type", "pair-ready",
                "pairSessionId", pairSessionId,
                "peerChannelId", rightChannelId,
                "peerDeviceId", extractDeviceId(rightChannelId),
                "peerLabel", labels.getOrDefault(rightChannelId, rightChannelId)
        ));
        send(rightChannelId, Map.of(
                "type", "pair-ready",
                "pairSessionId", pairSessionId,
                "peerChannelId", leftChannelId,
                "peerDeviceId", extractDeviceId(leftChannelId),
                "peerLabel", labels.getOrDefault(leftChannelId, leftChannelId)
        ));
    }

    @Override
    public void forwardSignal(String pairSessionId, String fromChannelId, String signalType, Object payload) throws IOException {
        String peerChannelId = resolvePeerChannel(pairSessionId, fromChannelId);
        if (peerChannelId == null) {
            return;
        }
        send(peerChannelId, Map.of(
                "type", "signal",
                "pairSessionId", pairSessionId,
                "fromChannelId", fromChannelId,
                "signalType", signalType,
                "payload", payload == null ? Map.of() : payload
        ));
    }

    @Override
    public boolean isConnected(String channelId) {
        WebSocketSession session = sessions.get(channelId);
        return session != null && session.isOpen();
    }

    @Override
    public String resolvePeerChannel(String pairSessionId, String channelId) {
        PairBinding pairBinding = pairs.get(pairSessionId);
        if (pairBinding == null) {
            return null;
        }
        if (Objects.equals(pairBinding.leftChannelId(), channelId)) {
            return pairBinding.rightChannelId();
        }
        if (Objects.equals(pairBinding.rightChannelId(), channelId)) {
            return pairBinding.leftChannelId();
        }
        return null;
    }

    @Override
    public Map<String, Object> buildWelcomeMessage(String channelId, String label) {
        return Map.of(
                "type", "welcome",
                "channelId", channelId,
                "label", label
        );
    }

    private void send(String channelId, Map<String, Object> payload) throws IOException {
        WebSocketSession session = sessions.get(channelId);
        if (session == null || !session.isOpen()) {
            return;
        }
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }

    private String extractDeviceId(String channelId) {
        if (channelId == null) {
            return null;
        }
        int marker = channelId.indexOf(":device:");
        if (marker < 0) {
            return null;
        }
        String value = channelId.substring(marker + ":device:".length()).trim();
        return value.isBlank() ? null : value;
    }

    private record PairBinding(String leftChannelId, String rightChannelId) {
    }
}
