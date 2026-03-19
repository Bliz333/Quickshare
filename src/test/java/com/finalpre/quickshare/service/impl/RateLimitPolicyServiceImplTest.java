package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.RateLimitScene;
import com.finalpre.quickshare.config.RateLimitProperties;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RateLimitPolicyServiceImplTest {

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private RateLimitPolicyServiceImpl rateLimitPolicyService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(rateLimitPolicyService, "rateLimitProperties", new RateLimitProperties());
    }

    @Test
    void getGuestUploadRuleShouldUseStoredOverrideWhenPresent() {
        when(systemSettingOverrideService.getRateLimitRule(RateLimitScene.GUEST_UPLOAD))
                .thenReturn(Optional.of(new RateLimitRule(false, 2L, 30L)));

        RateLimitRule rule = rateLimitPolicyService.getGuestUploadRule();

        assertThat(rule).isEqualTo(new RateLimitRule(false, 2L, 30L));
    }

    @Test
    void getPublicDownloadRuleShouldFallbackToPropertiesWhenOverrideMissing() {
        when(systemSettingOverrideService.getRateLimitRule(RateLimitScene.PUBLIC_DOWNLOAD))
                .thenReturn(Optional.empty());

        RateLimitRule rule = rateLimitPolicyService.getPublicDownloadRule();

        assertThat(rule).isEqualTo(new RateLimitRule(true, 30L, 600L));
    }
}
