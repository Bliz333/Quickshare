package com.finalpre.quickshare.config;

import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.CorsPolicyService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
public class WebConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsPolicyService corsPolicyService) {
        return request -> {
            CorsPolicy policy = corsPolicyService.getPolicy();
            CorsConfiguration configuration = new CorsConfiguration();
            configuration.setAllowedMethods(policy.allowedMethods());
            configuration.setAllowedHeaders(policy.allowedHeaders());
            configuration.setAllowCredentials(policy.allowCredentials());
            configuration.setMaxAge(policy.maxAgeSeconds());

            if (policy.allowedOrigins().contains("*")) {
                configuration.addAllowedOriginPattern("*");
                configuration.setAllowCredentials(false);
            } else {
                configuration.setAllowedOrigins(policy.allowedOrigins());
            }

            return configuration;
        };
    }
}
