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
public class TransferWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    public TransferWebSocketHandshakeInterceptor(JwtUtil jwtUtil) {
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
        String token = resolveValidAccessToken(raw);
        String deviceId = raw.getParameter("deviceId");
        String guestId = raw.getParameter("guestId");
        String deviceName = raw.getParameter("deviceName");
        String deviceType = raw.getParameter("deviceType");

        Long userId = null;
        if (token != null) {
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
        attributes.put("clientIp", resolveClientIp(raw));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
    }

    private String resolveValidAccessToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String headerToken = authHeader.substring(7);
            if (jwtUtil.validateAccessToken(headerToken)) {
                return headerToken;
            }
        }

        String cookieToken = AuthCookieSupport.resolveAccessToken(request);
        if (jwtUtil.validateAccessToken(cookieToken)) {
            return cookieToken;
        }

        String paramToken = request.getParameter("token");
        if (jwtUtil.validateAccessToken(paramToken)) {
            return paramToken;
        }

        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return real.trim();
        }
        String remote = request.getRemoteAddr();
        return remote == null || remote.isBlank() ? "unknown" : remote;
    }
}
