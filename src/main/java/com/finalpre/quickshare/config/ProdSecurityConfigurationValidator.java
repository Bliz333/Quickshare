package com.finalpre.quickshare.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

import java.util.ArrayList;
import java.util.List;

public class ProdSecurityConfigurationValidator implements EnvironmentPostProcessor, Ordered {

    private static final String DEFAULT_JWT_SECRET = "change-this-secret-at-least-256-bits";
    private static final String DEFAULT_DB_PASSWORD = "change_me";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.acceptsProfiles(Profiles.of("prod"))) {
            return;
        }

        List<String> errors = new ArrayList<>();
        String jwtSecret = environment.getProperty("jwt.secret", "");
        String settingEncryptKey = environment.getProperty("setting.encrypt-key",
                environment.getProperty("SETTING_ENCRYPT_KEY", ""));
        String dbPassword = environment.getProperty("spring.datasource.password", "");
        String dbUrl = environment.getProperty("spring.datasource.url", "");
        String redisHost = environment.getProperty("spring.data.redis.host", "localhost");
        String redisPassword = environment.getProperty("spring.data.redis.password", "");

        if (jwtSecret == null || jwtSecret.isBlank()) {
            errors.add("JWT_SECRET must be configured in prod");
        } else {
            String normalizedSecret = jwtSecret.trim();
            if (DEFAULT_JWT_SECRET.equals(normalizedSecret)) {
                errors.add("JWT_SECRET must not use the default placeholder value");
            }
            if (normalizedSecret.length() < 32) {
                errors.add("JWT_SECRET must be at least 32 characters in prod");
            }
        }

        if (settingEncryptKey == null || settingEncryptKey.isBlank()) {
            errors.add("SETTING_ENCRYPT_KEY must be configured in prod");
        } else if (settingEncryptKey.trim().length() < 16) {
            errors.add("SETTING_ENCRYPT_KEY must be at least 16 characters in prod");
        }

        if (!usesLocalOrComposeDatabase(dbUrl) && DEFAULT_DB_PASSWORD.equals(dbPassword)) {
            errors.add("DB_PASSWORD must not use the default placeholder value in prod");
        }

        String normalizedRedisHost = redisHost == null ? "" : redisHost.trim().toLowerCase();
        boolean localRedis = normalizedRedisHost.isEmpty()
                || "localhost".equals(normalizedRedisHost)
                || "127.0.0.1".equals(normalizedRedisHost)
                || "redis".equals(normalizedRedisHost);
        if (!localRedis && (redisPassword == null || redisPassword.isBlank())) {
            errors.add("REDIS_PASSWORD must be configured when using a non-local Redis host in prod");
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException(String.join("; ", errors));
        }
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    private boolean usesLocalOrComposeDatabase(String dbUrl) {
        String normalized = dbUrl == null ? "" : dbUrl.trim().toLowerCase();
        return normalized.contains("//localhost:")
                || normalized.contains("//127.0.0.1:")
                || normalized.contains("//mysql:");
    }
}
