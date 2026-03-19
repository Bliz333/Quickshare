package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.CorsProperties;
import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.CorsPolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class CorsPolicyServiceImpl implements CorsPolicyService {

    @Autowired
    private CorsProperties corsProperties;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public CorsPolicy getPolicy() {
        CorsPolicy source = resolveSourcePolicy();
        List<String> allowedOrigins = parseAllowedOrigins(String.join(",", source.allowedOrigins()));
        boolean allowCredentials = source.allowCredentials();
        if (allowedOrigins.contains("*") && allowCredentials) {
            log.warn("CORS wildcard origin does not support credentials; force allowCredentials=false");
            allowCredentials = false;
        }

        return new CorsPolicy(
                allowedOrigins,
                normalizeList(source.allowedMethods(), List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")),
                normalizeList(source.allowedHeaders(), List.of("*")),
                allowCredentials,
                source.maxAgeSeconds() > 0 ? source.maxAgeSeconds() : 3600
        );
    }

    private CorsPolicy resolveSourcePolicy() {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getCorsPolicy();
            if (override != null && override.isPresent()) {
                return override.get();
            }
        }

        return new CorsPolicy(
                parseAllowedOrigins(corsProperties.getAllowedOrigins()),
                normalizeList(corsProperties.getAllowedMethods(), List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")),
                normalizeList(corsProperties.getAllowedHeaders(), List.of("*")),
                corsProperties.isAllowCredentials(),
                corsProperties.getMaxAgeSeconds()
        );
    }

    private List<String> parseAllowedOrigins(String rawOrigins) {
        if (rawOrigins == null || rawOrigins.isBlank()) {
            return List.of();
        }

        return rawOrigins.equals("*")
                ? List.of("*")
                : List.of(rawOrigins.split(",")).stream()
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .distinct()
                .toList();
    }

    private List<String> normalizeList(List<String> values, List<String> defaults) {
        if (values == null || values.isEmpty()) {
            return defaults;
        }

        List<String> normalized = values.stream()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
        return normalized.isEmpty() ? defaults : normalized;
    }
}
