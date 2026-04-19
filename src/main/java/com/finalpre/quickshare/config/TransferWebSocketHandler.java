package com.finalpre.quickshare.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.service.TransferSignalingService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
public class TransferWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TransferSignalingService transferSignalingService;

    public TransferWebSocketHandler(TransferSignalingService transferSignalingService) {
        this.transferSignalingService = transferSignalingService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String channelId = (String) session.getAttributes().get("channelId");
        String clientIp = (String) session.getAttributes().getOrDefault("clientIp", "unknown");
        String label = session.getAttributes().get("deviceName") instanceof String name && !name.isBlank()
                ? name
                : ((String) session.getAttributes().getOrDefault("deviceType", "Browser"));
        transferSignalingService.registerSession(channelId, label, clientIp, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), new TypeReference<>() {
        });
        String type = payload.get("type") == null ? "" : String.valueOf(payload.get("type"));
        String channelId = (String) session.getAttributes().get("channelId");

        switch (type) {
            case "ping" ->
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("type", "pong"))));

            case "signal" -> {
                String pairSessionId = payload.get("pairSessionId") == null ? null : String.valueOf(payload.get("pairSessionId"));
                String signalType = payload.get("signalType") == null ? "signal" : String.valueOf(payload.get("signalType"));
                Object signalPayload = payload.get("payload");
                transferSignalingService.forwardSignal(pairSessionId, channelId, signalType, signalPayload);
            }

            // Client requests the current room device list
            case "room-devices" -> {
                String roomId = transferSignalingService.getChannelRoomId(channelId);
                List<Map<String, Object>> devices = transferSignalingService.getRoomDevices(roomId);
                List<Map<String, Object>> personalised = devices.stream().map(d -> {
                    java.util.LinkedHashMap<String, Object> copy = new java.util.LinkedHashMap<>(d);
                    copy.put("isMe", channelId.equals(d.get("channelId")));
                    return (Map<String, Object>) copy;
                }).toList();
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                        "type", "room-update",
                        "roomId", roomId,
                        "roomScope", roomId.startsWith("room:public:") ? "public" : "local",
                        "roomCode", roomId.startsWith("room:public:") ? roomId.substring("room:public:".length()) : "",
                        "devices", personalised
                ))));
            }

            // Client wants to initiate transfer with a room peer (auto-pair without code)
            case "request-transfer" -> {
                String targetChannelId = payload.get("targetChannelId") == null
                        ? null : String.valueOf(payload.get("targetChannelId"));
                if (targetChannelId != null && !targetChannelId.isBlank()) {
                    try {
                        transferSignalingService.requestRoomTransfer(channelId, targetChannelId);
                    } catch (IllegalStateException e) {
                        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                                "type", "error",
                                "message", e.getMessage()
                        ))));
                    }
                }
            }

            case "create-public-room" -> {
                try {
                    String roomCode = transferSignalingService.createPublicRoom(channelId);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "public-room-created",
                            "roomCode", roomCode
                    ))));
                } catch (IllegalStateException e) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "error",
                            "message", e.getMessage()
                    ))));
                }
            }

            case "join-public-room" -> {
                String roomCode = payload.get("roomCode") == null ? "" : String.valueOf(payload.get("roomCode"));
                try {
                    String normalizedRoomCode = transferSignalingService.joinPublicRoom(channelId, roomCode);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "public-room-joined",
                            "roomCode", normalizedRoomCode
                    ))));
                } catch (IllegalArgumentException | IllegalStateException e) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "error",
                            "message", e.getMessage()
                    ))));
                }
            }

            case "leave-public-room" -> {
                try {
                    transferSignalingService.leavePublicRoom(channelId);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "public-room-left"
                    ))));
                } catch (IllegalStateException e) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                            "type", "error",
                            "message", e.getMessage()
                    ))));
                }
            }

            default -> {
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        transferSignalingService.unregisterSession((String) session.getAttributes().get("channelId"));
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        transferSignalingService.unregisterSession((String) session.getAttributes().get("channelId"));
        if (session.isOpen()) {
            try {
                session.close(CloseStatus.SERVER_ERROR);
            } catch (IOException ignored) {
            }
        }
    }
}
