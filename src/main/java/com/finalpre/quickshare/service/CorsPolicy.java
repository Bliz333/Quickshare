package com.finalpre.quickshare.service;

import java.util.List;

public record CorsPolicy(
        List<String> allowedOrigins,
        List<String> allowedMethods,
        List<String> allowedHeaders,
        boolean allowCredentials,
        long maxAgeSeconds
) {
}
