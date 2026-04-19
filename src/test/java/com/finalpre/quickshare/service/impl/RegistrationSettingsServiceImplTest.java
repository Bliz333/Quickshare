package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.RecaptchaProperties;
import com.finalpre.quickshare.config.RegistrationProperties;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationSettingsServiceImplTest {

    @Mock
    private RegistrationProperties registrationProperties;

    @Mock
    private RecaptchaProperties recaptchaProperties;

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private RegistrationSettingsServiceImpl registrationSettingsService;

    @Test
    void shouldDisableRecaptchaWhenKeysAreMissing() {
        when(systemSettingOverrideService.getRegistrationSettingsPolicy()).thenReturn(Optional.empty());
        when(registrationProperties.isEmailVerificationEnabled()).thenReturn(true);
        when(recaptchaProperties.isEnabled()).thenReturn(true);
        when(recaptchaProperties.getSiteKey()).thenReturn("");
        when(recaptchaProperties.getSecretKey()).thenReturn("");
        when(recaptchaProperties.getVerifyUrl()).thenReturn("https://www.google.com/recaptcha/api/siteverify");

        RegistrationSettingsPolicy result = registrationSettingsService.getPolicy();

        assertThat(result.emailVerificationEnabled()).isTrue();
        assertThat(result.recaptchaEnabled()).isFalse();
    }

    @Test
    void shouldPreferStoredOverride() {
        when(systemSettingOverrideService.getRegistrationSettingsPolicy()).thenReturn(Optional.of(new RegistrationSettingsPolicy(
                false,
                true,
                "recaptcha",
                "site-key",
                "secret-key",
                "https://www.google.com/recaptcha/api/siteverify",
                "google-client-id",
                "apple-client-id"
        )));

        RegistrationSettingsPolicy result = registrationSettingsService.getPolicy();

        assertThat(result.emailVerificationEnabled()).isFalse();
        assertThat(result.recaptchaEnabled()).isTrue();
        assertThat(result.recaptchaSiteKey()).isEqualTo("site-key");
        assertThat(result.googleClientId()).isEqualTo("google-client-id");
        assertThat(result.appleClientId()).isEqualTo("apple-client-id");
    }
}
