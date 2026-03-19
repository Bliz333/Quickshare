package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class PublicRegistrationSettingsVO {

    private Boolean emailVerificationEnabled;

    private Boolean recaptchaEnabled;

    private String recaptchaSiteKey;
}
