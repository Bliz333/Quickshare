package com.finalpre.quickshare.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.service.QuickDropSignalingService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;

@Component
public class QuickDropWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final QuickDropSignalingService quickDropSignalingService;

    public QuickDropWebSocketHandler(QuickDropSignalingService quickDropSignalingService) {
        this.quickDropSignalingService = quickDropSignalingService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String channelId = (String) session.getAttributes().get("channelId");
        String label = session.getAttributes().get("deviceName") instanceof String name && !name.isBlank()
                ? name
                : ((String) session.getAttributes().getOrDefault("deviceType", "QuickDrop"));
        quickDropSignalingService.registerSession(channelId, label, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(message.getPayload(), new TypeReference<>() {
        });
        String type = payload.get("type") == null ? "" : String.valueOf(payload.get("type"));
        String channelId = (String) session.getAttributes().get("channelId");

        switch (type) {
            case "ping" -> session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("type", "pong"))));
            case "signal" -> {
                String pairSessionId = payload.get("pairSessionId") == null ? null : String.valueOf(payload.get("pairSessionId"));
                String signalType = payload.get("signalType") == null ? "signal" : String.valueOf(payload.get("signalType"));
                Object signalPayload = payload.get("payload");
                quickDropSignalingService.forwardSignal(pairSessionId, channelId, signalType, signalPayload);
            }
            default -> {
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        quickDropSignalingService.unregisterSession((String) session.getAttributes().get("channelId"));
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        quickDropSignalingService.unregisterSession((String) session.getAttributes().get("channelId"));
        if (session.isOpen()) {
            try {
                session.close(CloseStatus.SERVER_ERROR);
            } catch (IOException ignored) {
            }
        }
    }
}
