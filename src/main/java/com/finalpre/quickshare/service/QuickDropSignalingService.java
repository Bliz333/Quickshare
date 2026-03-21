package com.finalpre.quickshare.service;

import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;

public interface QuickDropSignalingService {

    void registerSession(String channelId, String label, WebSocketSession session) throws IOException;

    void unregisterSession(String channelId);

    void bindPairSession(String pairSessionId, String leftChannelId, String rightChannelId) throws IOException;

    void forwardSignal(String pairSessionId, String fromChannelId, String signalType, Object payload) throws IOException;

    boolean isConnected(String channelId);

    String resolvePeerChannel(String pairSessionId, String channelId);

    Map<String, Object> buildWelcomeMessage(String channelId, String label);
}
