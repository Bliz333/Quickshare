package com.finalpre.quickshare.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProdSecurityConfigurationValidatorTest {

    private final ProdSecurityConfigurationValidator validator = new ProdSecurityConfigurationValidator();

    @Test
    void postProcessEnvironmentShouldRejectMissingProdSecrets() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.profiles.active", "prod")
                .withProperty("spring.datasource.url", "jdbc:mysql://db.example.com:3306/quickshare")
                .withProperty("spring.datasource.password", "change_me");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT_SECRET must be configured in prod")
                .hasMessageContaining("SETTING_ENCRYPT_KEY must be configured in prod")
                .hasMessageContaining("DB_PASSWORD must not use the default placeholder value in prod");
    }

    @Test
    void postProcessEnvironmentShouldAcceptStrongProdSecrets() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.profiles.active", "prod")
                .withProperty("jwt.secret", "0123456789abcdef0123456789abcdef")
                .withProperty("setting.encrypt-key", "0123456789abcdef")
                .withProperty("spring.datasource.url", "jdbc:mysql://db.example.com:3306/quickshare")
                .withProperty("spring.datasource.password", "not-the-default")
                .withProperty("spring.data.redis.host", "redis.example.com")
                .withProperty("spring.data.redis.password", "redis-secret");

        assertThatCode(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .doesNotThrowAnyException();
    }
}
