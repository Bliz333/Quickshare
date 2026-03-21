package com.finalpre.quickshare.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class QuickDropWebSocketConfig implements WebSocketConfigurer {

    private final QuickDropWebSocketHandler handler;
    private final QuickDropWebSocketHandshakeInterceptor interceptor;

    public QuickDropWebSocketConfig(QuickDropWebSocketHandler handler,
                                    QuickDropWebSocketHandshakeInterceptor interceptor) {
        this.handler = handler;
        this.interceptor = interceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/quickdrop")
                .addInterceptors(interceptor)
                .setAllowedOriginPatterns("*");
    }
}
