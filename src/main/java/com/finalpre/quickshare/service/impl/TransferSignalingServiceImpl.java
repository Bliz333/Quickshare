package com.finalpre.quickshare.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.service.TransferSignalingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransferSignalingServiceImpl implements TransferSignalingService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // channelId → session
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    // channelId → display label
    private final Map<String, String> labels = new ConcurrentHashMap<>();
    // pairSessionId → PairBinding
    private final Map<String, PairBinding> pairs = new ConcurrentHashMap<>();
    // roomId → set of channelIds in that room
    private final Map<String, Set<String>> rooms = new ConcurrentHashMap<>();
    // channelId → roomId (reverse index)
    private final Map<String, String> channelRooms = new ConcurrentHashMap<>();

    // -------------------------------------------------------------------------
    // Session lifecycle
    // -------------------------------------------------------------------------

    @Override
    public void registerSession(String channelId, String label, String clientIp, WebSocketSession session) throws IOException {
        sessions.put(channelId, session);
        labels.put(channelId, label);

        // Join IP-based room
        String roomId = getRoomId(clientIp);
        channelRooms.put(channelId, roomId);
        rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(channelId);

        // Send welcome first
        send(channelId, buildWelcomeMessage(channelId, label));

        // Then broadcast room-update to every member (including the new one)
        broadcastRoomUpdate(roomId);
    }

    @Override
    public void unregisterSession(String channelId) {
        sessions.remove(channelId);
        labels.remove(channelId);

        String roomId = channelRooms.remove(channelId);
        if (roomId != null) {
            Set<String> roomMembers = rooms.get(roomId);
            if (roomMembers != null) {
                roomMembers.remove(channelId);
                if (roomMembers.isEmpty()) {
                    rooms.remove(roomId);
                } else {
                    // Broadcast updated list to remaining members
                    try {
                        broadcastRoomUpdate(roomId);
                    } catch (IOException e) {
                        log.warn("Failed to broadcast room-update after disconnect: {}", e.getMessage());
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Pair / signal
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Room discovery
    // -------------------------------------------------------------------------

    @Override
    public String getRoomId(String clientIp) {
        if (clientIp == null || clientIp.isBlank() || "unknown".equals(clientIp)) {
            // Unknown IP: each connection gets an isolated room (no cross-user leakage)
            return "room:isolated:" + java.util.UUID.randomUUID().toString().replace("-", "");
        }
        // Group by EXACT IP address, not /24 subnet.
        //
        // Rationale: on a public server, /24 grouping would expose devices to
        // strangers sharing the same ISP subnet (e.g. 1.2.3.4 and 1.2.3.200).
        // With exact-IP grouping, only devices behind the SAME NAT router
        // (identical public IP) share a room — matching real-world LAN semantics.
        //
        // Localhost is kept as a shared room to allow multi-tab testing in dev.
        if ("127.0.0.1".equals(clientIp) || "::1".equals(clientIp)) {
            return "room:localhost";
        }
        return "room:" + clientIp;
    }

    @Override
    public List<Map<String, Object>> getRoomDevices(String roomId) {
        Set<String> members = rooms.getOrDefault(roomId, Set.of());
        return members.stream()
                .filter(ch -> isConnected(ch))
                .map(ch -> {
                    Map<String, Object> info = new LinkedHashMap<>();
                    info.put("channelId", ch);
                    info.put("label", labels.getOrDefault(ch, ch));
                    return info;
                })
                .collect(Collectors.toList());
    }

    @Override
    public String requestRoomTransfer(String initiatorChannelId, String targetChannelId) throws IOException {
        if (!isConnected(initiatorChannelId) || !isConnected(targetChannelId)) {
            throw new IllegalStateException("Both devices must be online to initiate transfer");
        }
        String pairSessionId = UUID.randomUUID().toString().replace("-", "");
        bindPairSession(pairSessionId, initiatorChannelId, targetChannelId);
        return pairSessionId;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private void broadcastRoomUpdate(String roomId) throws IOException {
        Set<String> members = rooms.getOrDefault(roomId, Set.of());
        List<Map<String, Object>> devices = getRoomDevices(roomId);
        for (String channelId : new HashSet<>(members)) {
            // Build a personalised list (mark self)
            List<Map<String, Object>> personalised = devices.stream().map(d -> {
                Map<String, Object> copy = new LinkedHashMap<>(d);
                copy.put("isMe", channelId.equals(d.get("channelId")));
                return copy;
            }).collect(Collectors.toList());
            try {
                send(channelId, Map.of(
                        "type", "room-update",
                        "roomId", roomId,
                        "devices", personalised
                ));
            } catch (IOException e) {
                log.warn("room-update send failed for {}: {}", channelId, e.getMessage());
            }
        }
    }

    private void send(String channelId, Map<String, Object> payload) throws IOException {
        WebSocketSession session = sessions.get(channelId);
        if (session == null || !session.isOpen()) {
            return;
        }
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }

    private String extractDeviceId(String channelId) {
        if (channelId == null) return null;
        int marker = channelId.indexOf(":device:");
        if (marker < 0) return null;
        String value = channelId.substring(marker + ":device:".length()).trim();
        return value.isBlank() ? null : value;
    }

    private record PairBinding(String leftChannelId, String rightChannelId) {
    }
}
