package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "recaptcha")
public class RecaptchaProperties {

    private boolean enabled = true;

    private String siteKey = "";

    private String secretKey = "";

    private String verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
}
