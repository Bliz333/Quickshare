package com.finalpre.quickshare.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class TransferWebSocketConfig implements WebSocketConfigurer {

    private final TransferWebSocketHandler handler;
    private final TransferWebSocketHandshakeInterceptor interceptor;

    public TransferWebSocketConfig(TransferWebSocketHandler handler,
                                    TransferWebSocketHandshakeInterceptor interceptor) {
        this.handler = handler;
        this.interceptor = interceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/transfer", "/ws/quickdrop")
                .addInterceptors(interceptor)
                .setAllowedOriginPatterns("*");
    }
}
