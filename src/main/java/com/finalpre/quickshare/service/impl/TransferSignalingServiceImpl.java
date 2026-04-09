package com.finalpre.quickshare.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.service.TransferSignalingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TransferSignalingServiceImpl implements TransferSignalingService {

    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_SIZE_LIMIT_BYTES = 512 * 1024;
    private static final String PUBLIC_ROOM_PREFIX = "room:public:";
    private static final char[] ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

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
    // channelId → default LAN roomId
    private final Map<String, String> defaultRooms = new ConcurrentHashMap<>();
    // public room code → roomId
    private final Map<String, String> publicRoomIdsByCode = new ConcurrentHashMap<>();
    // roomId → public room code
    private final Map<String, String> publicRoomCodesById = new ConcurrentHashMap<>();

    // -------------------------------------------------------------------------
    // Session lifecycle
    // -------------------------------------------------------------------------

    @Override
    public void registerSession(String channelId, String label, String clientIp, WebSocketSession session) throws IOException {
        sessions.put(channelId, decorateSession(session));
        labels.put(channelId, label);

        // Join IP-based room
        String roomId = getRoomId(clientIp);
        defaultRooms.put(channelId, roomId);
        joinRoom(channelId, roomId);

        // Send welcome first
        send(channelId, buildWelcomeMessage(channelId, label));

        // Then broadcast room-update to every member (including the new one)
        broadcastRoomUpdate(roomId);
    }

    @Override
    public void unregisterSession(String channelId) {
        sessions.remove(channelId);
        labels.remove(channelId);
        defaultRooms.remove(channelId);
        leaveRoom(channelId);
    }

    // -------------------------------------------------------------------------
    // Pair / signal
    // -------------------------------------------------------------------------

    @Override
    public void bindPairSession(String pairSessionId, String leftChannelId, String rightChannelId) throws IOException {
        pairs.put(pairSessionId, new PairBinding(leftChannelId, rightChannelId));
        send(leftChannelId, buildPairReadyPayload(pairSessionId, rightChannelId));
        send(rightChannelId, buildPairReadyPayload(pairSessionId, leftChannelId));
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
        try {
            InetAddress address = InetAddress.getByName(clientIp);
            if (address instanceof Inet6Address) {
                return "room:v6:" + toIpv6Prefix64Key(address.getAddress());
            }
            return "room:" + address.getHostAddress();
        } catch (UnknownHostException ignored) {
            return "room:" + clientIp;
        }
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
    public String getChannelRoomId(String channelId) {
        if (channelId == null || channelId.isBlank()) {
            return "";
        }
        return channelRooms.getOrDefault(channelId, defaultRooms.getOrDefault(channelId, ""));
    }

    @Override
    public String requestRoomTransfer(String initiatorChannelId, String targetChannelId) throws IOException {
        if (!isConnected(initiatorChannelId) || !isConnected(targetChannelId)) {
            throw new IllegalStateException("Both devices must be online to initiate transfer");
        }
        String initiatorRoomId = channelRooms.get(initiatorChannelId);
        String targetRoomId = channelRooms.get(targetChannelId);
        if (!Objects.equals(initiatorRoomId, targetRoomId)) {
            throw new IllegalStateException("Both devices must be in the same discovery room");
        }
        String pairSessionId = UUID.randomUUID().toString().replace("-", "");
        bindPairSession(pairSessionId, initiatorChannelId, targetChannelId);
        return pairSessionId;
    }

    @Override
    public String createPublicRoom(String channelId) throws IOException {
        requireConnectedChannel(channelId);
        String currentRoomId = channelRooms.get(channelId);
        if (isPublicRoom(currentRoomId)) {
            return publicRoomCodesById.getOrDefault(currentRoomId, "");
        }

        String code = nextPublicRoomCode();
        String roomId = PUBLIC_ROOM_PREFIX + code;
        publicRoomCodesById.put(roomId, code);
        switchRoom(channelId, roomId);
        return code;
    }

    @Override
    public String joinPublicRoom(String channelId, String roomCode) throws IOException {
        requireConnectedChannel(channelId);
        String normalizedCode = normalizeRoomCode(roomCode);
        String roomId = publicRoomIdsByCode.get(normalizedCode);
        if (roomId == null) {
            throw new IllegalArgumentException("Temporary room does not exist or has expired");
        }
        switchRoom(channelId, roomId);
        return normalizedCode;
    }

    @Override
    public void leavePublicRoom(String channelId) throws IOException {
        requireConnectedChannel(channelId);
        String defaultRoomId = defaultRooms.get(channelId);
        if (defaultRoomId == null || defaultRoomId.isBlank()) {
            throw new IllegalStateException("Default discovery room is missing");
        }
        switchRoom(channelId, defaultRoomId);
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
                send(channelId, buildRoomUpdatePayload(roomId, personalised));
            } catch (IOException e) {
                log.warn("room-update send failed for {}: {}", channelId, e.getMessage());
            }
        }
    }

    private Map<String, Object> buildRoomUpdatePayload(String roomId, List<Map<String, Object>> devices) {
        return Map.of(
                "type", "room-update",
                "roomId", roomId == null ? "" : roomId,
                "roomScope", isPublicRoom(roomId) ? "public" : "local",
                "roomCode", publicRoomCodesById.getOrDefault(roomId, ""),
                "devices", devices
        );
    }

    private void send(String channelId, Map<String, Object> payload) throws IOException {
        WebSocketSession session = sessions.get(channelId);
        if (session == null || !session.isOpen()) {
            return;
        }
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }

    private WebSocketSession decorateSession(WebSocketSession session) {
        if (session instanceof ConcurrentWebSocketSessionDecorator) {
            return session;
        }
        return new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT_BYTES);
    }

    private Map<String, Object> buildPairReadyPayload(String pairSessionId, String peerChannelId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "pair-ready");
        payload.put("pairSessionId", pairSessionId);
        payload.put("peerChannelId", peerChannelId == null ? "" : peerChannelId);
        payload.put("peerDeviceId", extractDeviceId(peerChannelId));
        payload.put("peerLabel", labels.getOrDefault(peerChannelId, peerChannelId == null ? "" : peerChannelId));
        return payload;
    }

    private String extractDeviceId(String channelId) {
        if (channelId == null) return "";
        int marker = channelId.indexOf(":device:");
        if (marker < 0) return "";
        String value = channelId.substring(marker + ":device:".length()).trim();
        return value.isBlank() ? "" : value;
    }

    private void requireConnectedChannel(String channelId) {
        if (channelId == null || channelId.isBlank() || !isConnected(channelId)) {
            throw new IllegalStateException("Signaling session is not connected");
        }
    }

    private void joinRoom(String channelId, String roomId) {
        channelRooms.put(channelId, roomId);
        rooms.computeIfAbsent(roomId, key -> ConcurrentHashMap.newKeySet()).add(channelId);
    }

    private void switchRoom(String channelId, String nextRoomId) throws IOException {
        String currentRoomId = channelRooms.get(channelId);
        if (Objects.equals(currentRoomId, nextRoomId)) {
            broadcastRoomUpdate(nextRoomId);
            return;
        }
        leaveRoom(channelId);
        joinRoom(channelId, nextRoomId);
        broadcastRoomUpdate(nextRoomId);
    }

    private void leaveRoom(String channelId) {
        String roomId = channelRooms.remove(channelId);
        if (roomId == null) {
            return;
        }

        Set<String> roomMembers = rooms.get(roomId);
        if (roomMembers != null) {
            roomMembers.remove(channelId);
            if (roomMembers.isEmpty()) {
                rooms.remove(roomId);
                cleanupPublicRoom(roomId);
            } else {
                try {
                    broadcastRoomUpdate(roomId);
                } catch (IOException e) {
                    log.warn("Failed to broadcast room-update after disconnect: {}", e.getMessage());
                }
            }
        }
    }

    private boolean isPublicRoom(String roomId) {
        return roomId != null && roomId.startsWith(PUBLIC_ROOM_PREFIX);
    }

    private void cleanupPublicRoom(String roomId) {
        if (!isPublicRoom(roomId)) {
            return;
        }
        String roomCode = publicRoomCodesById.remove(roomId);
        if (roomCode != null) {
            publicRoomIdsByCode.remove(roomCode, roomId);
        }
    }

    private String nextPublicRoomCode() {
        for (int attempt = 0; attempt < 32; attempt += 1) {
            String code = generateRoomCode();
            String roomId = PUBLIC_ROOM_PREFIX + code;
            if (publicRoomIdsByCode.putIfAbsent(code, roomId) == null) {
                return code;
            }
        }
        throw new IllegalStateException("Failed to allocate a temporary room code");
    }

    private String generateRoomCode() {
        StringBuilder builder = new StringBuilder(6);
        for (int index = 0; index < 6; index += 1) {
            builder.append(ROOM_CODE_ALPHABET[secureRandom.nextInt(ROOM_CODE_ALPHABET.length)]);
        }
        return builder.toString();
    }

    private String normalizeRoomCode(String roomCode) {
        String normalized = roomCode == null ? "" : roomCode.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Temporary room code is required");
        }
        return normalized;
    }

    private String toIpv6Prefix64Key(byte[] bytes) {
        StringBuilder builder = new StringBuilder(16);
        for (int index = 0; index < 8 && index < bytes.length; index += 1) {
            builder.append(String.format(Locale.ROOT, "%02x", bytes[index] & 0xff));
        }
        return builder.toString();
    }

    private record PairBinding(String leftChannelId, String rightChannelId) {
    }
}
