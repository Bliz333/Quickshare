package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.office-preview")
public class OfficePreviewProperties {

    private boolean enabled = true;
    private String command = "soffice";
    private int timeoutSeconds = 120;
    private String cacheDir = "";
}
