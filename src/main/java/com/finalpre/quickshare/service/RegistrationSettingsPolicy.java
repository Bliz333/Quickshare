package com.finalpre.quickshare.service;

public record RegistrationSettingsPolicy(
        boolean emailVerificationEnabled,
        boolean recaptchaEnabled,
        String captchaProvider,
        String recaptchaSiteKey,
        String recaptchaSecretKey,
        String recaptchaVerifyUrl,
        String googleClientId,
        String appleClientId
) {
}
