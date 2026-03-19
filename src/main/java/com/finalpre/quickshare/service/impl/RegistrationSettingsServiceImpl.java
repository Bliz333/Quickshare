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
                recaptchaProperties.getSiteKey(),
                recaptchaProperties.getSecretKey(),
                recaptchaProperties.getVerifyUrl()
        ));
    }

    private RegistrationSettingsPolicy normalize(RegistrationSettingsPolicy source) {
        if (source == null) {
            return new RegistrationSettingsPolicy(true, false, "", "", "https://www.google.com/recaptcha/api/siteverify");
        }

        String siteKey = normalizeValue(source.recaptchaSiteKey());
        String secretKey = normalizeValue(source.recaptchaSecretKey());
        String verifyUrl = normalizeValue(source.recaptchaVerifyUrl());
        boolean recaptchaEnabled = source.recaptchaEnabled()
                && !siteKey.isBlank()
                && !secretKey.isBlank()
                && !verifyUrl.isBlank();

        return new RegistrationSettingsPolicy(
                source.emailVerificationEnabled(),
                recaptchaEnabled,
                siteKey,
                secretKey,
                verifyUrl.isBlank() ? "https://www.google.com/recaptcha/api/siteverify" : verifyUrl
        );
    }

    private String normalizeValue(String rawValue) {
        return rawValue == null ? "" : rawValue.trim();
    }
}
