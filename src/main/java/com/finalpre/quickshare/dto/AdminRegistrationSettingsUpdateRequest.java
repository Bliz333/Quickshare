package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminRegistrationSettingsUpdateRequest {

    private Boolean emailVerificationEnabled;

    private Boolean recaptchaEnabled;

    private String recaptchaSiteKey;

    private String recaptchaSecretKey;

    private String recaptchaVerifyUrl;
}
