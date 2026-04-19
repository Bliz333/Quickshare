package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminRegistrationSettingsUpdateRequest {

    private Boolean emailVerificationEnabled;

    private Boolean recaptchaEnabled;

    /** "recaptcha" or "turnstile" */
    private String captchaProvider;

    private String recaptchaSiteKey;

    private String recaptchaSecretKey;

    private String recaptchaVerifyUrl;

    private String googleClientId;

    private String appleClientId;
}
