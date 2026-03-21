package com.finalpre.quickshare.config;

import com.finalpre.quickshare.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class QuickDropWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    public QuickDropWebSocketHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return false;
        }

        HttpServletRequest raw = servletRequest.getServletRequest();
        String token = raw.getParameter("token");
        String deviceId = raw.getParameter("deviceId");
        String guestId = raw.getParameter("guestId");
        String deviceName = raw.getParameter("deviceName");
        String deviceType = raw.getParameter("deviceType");

        Long userId = null;
        if (token != null && !token.isBlank() && jwtUtil.validateAccessToken(token)) {
            userId = jwtUtil.getUserIdFromToken(token);
        }

        if (userId == null && (guestId == null || guestId.isBlank())) {
            return false;
        }

        String channelId = userId != null
                ? "user:" + userId + ":device:" + (deviceId == null ? "" : deviceId.trim())
                : "guest:" + guestId.trim();

        attributes.put("channelId", channelId);
        attributes.put("userId", userId);
        attributes.put("deviceId", deviceId);
        attributes.put("guestId", guestId);
        attributes.put("deviceName", deviceName);
        attributes.put("deviceType", deviceType);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
    }
}
