package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.CorsProperties;
import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorsPolicyServiceImplTest {

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private CorsPolicyServiceImpl corsPolicyService;

    @BeforeEach
    void setUp() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOrigins("http://allowed.example,http://second.example");
        properties.setAllowCredentials(false);
        properties.setMaxAgeSeconds(3600L);
        ReflectionTestUtils.setField(corsPolicyService, "corsProperties", properties);
    }

    @Test
    void getPolicyShouldUseStoredOverride() {
        when(systemSettingOverrideService.getCorsPolicy())
                .thenReturn(Optional.of(new CorsPolicy(List.of("*"), List.of("GET"), List.of("*"), true, 120L)));

        CorsPolicy policy = corsPolicyService.getPolicy();

        assertThat(policy.allowedOrigins()).containsExactly("*");
        assertThat(policy.allowCredentials()).isFalse();
        assertThat(policy.maxAgeSeconds()).isEqualTo(120L);
    }

    @Test
    void getPolicyShouldFallbackToPropertiesWhenOverrideMissing() {
        when(systemSettingOverrideService.getCorsPolicy()).thenReturn(Optional.empty());

        CorsPolicy policy = corsPolicyService.getPolicy();

        assertThat(policy.allowedOrigins()).containsExactly("http://allowed.example", "http://second.example");
        assertThat(policy.allowedMethods()).containsExactly("GET", "POST", "PUT", "DELETE", "OPTIONS");
        assertThat(policy.allowCredentials()).isFalse();
    }
}
