package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.RecaptchaProperties;
import com.finalpre.quickshare.config.RegistrationProperties;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RegistrationSettingsServiceImpl implements RegistrationSettingsService {

    private static final String DEFAULT_RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
    private static final String DEFAULT_TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    @Autowired
    private RegistrationProperties registrationProperties;

    @Autowired
    private RecaptchaProperties recaptchaProperties;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public RegistrationSettingsPolicy getPolicy() {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getRegistrationSettingsPolicy();
            if (override != null && override.isPresent()) {
                return normalize(override.get());
            }
        }

        return normalize(new RegistrationSettingsPolicy(
                registrationProperties.isEmailVerificationEnabled(),
                recaptchaProperties.isEnabled(),
                "recaptcha",
                recaptchaProperties.getSiteKey(),
                recaptchaProperties.getSecretKey(),
                recaptchaProperties.getVerifyUrl()
        ));
    }

    private RegistrationSettingsPolicy normalize(RegistrationSettingsPolicy source) {
        if (source == null) {
            return new RegistrationSettingsPolicy(true, false, "recaptcha", "", "", DEFAULT_RECAPTCHA_VERIFY_URL);
        }

        String provider = normalizeValue(source.captchaProvider());
        if (provider.isBlank()) provider = "recaptcha";

        String siteKey = normalizeValue(source.recaptchaSiteKey());
        String secretKey = normalizeValue(source.recaptchaSecretKey());
        String verifyUrl = normalizeValue(source.recaptchaVerifyUrl());
        boolean recaptchaEnabled = source.recaptchaEnabled()
                && !siteKey.isBlank()
                && !secretKey.isBlank();

        if (verifyUrl.isBlank()) {
            verifyUrl = "turnstile".equals(provider) ? DEFAULT_TURNSTILE_VERIFY_URL : DEFAULT_RECAPTCHA_VERIFY_URL;
        }

        return new RegistrationSettingsPolicy(
                source.emailVerificationEnabled(),
                recaptchaEnabled,
                provider,
                siteKey,
                secretKey,
                verifyUrl
        );
    }

    private String normalizeValue(String rawValue) {
        return rawValue == null ? "" : rawValue.trim();
    }
}
