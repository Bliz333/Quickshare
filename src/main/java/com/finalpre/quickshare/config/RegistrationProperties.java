package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.registration")
public class RegistrationProperties {

    private boolean emailVerificationEnabled = true;
}
