package com.finalpre.quickshare.service;

public record RegistrationSettingsPolicy(
        boolean emailVerificationEnabled,
        boolean recaptchaEnabled,
        String recaptchaSiteKey,
        String recaptchaSecretKey,
        String recaptchaVerifyUrl
) {
}
