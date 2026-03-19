package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminRegistrationSettingsVO {

    private Boolean emailVerificationEnabled;

    private Boolean recaptchaEnabled;

    private String recaptchaSiteKey;

    private String recaptchaSecretKey;

    private String recaptchaVerifyUrl;
}
