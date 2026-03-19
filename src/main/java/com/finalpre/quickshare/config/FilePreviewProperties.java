package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.file-preview")
public class FilePreviewProperties {

    private boolean enabled = true;
    private boolean imageEnabled = true;
    private boolean videoEnabled = true;
    private boolean audioEnabled = true;
    private boolean pdfEnabled = true;
    private boolean textEnabled = true;
    private boolean officeEnabled = true;
    private String allowedExtensions = "";
}
