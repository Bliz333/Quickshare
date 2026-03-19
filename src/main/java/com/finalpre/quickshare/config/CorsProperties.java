package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {

    private String allowedOrigins = "http://localhost:3000,http://localhost:8080";
    private boolean allowCredentials = false;
    private long maxAgeSeconds = 3600;
    private List<String> allowedMethods = new ArrayList<>(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    private List<String> allowedHeaders = new ArrayList<>(List.of("*"));
}
