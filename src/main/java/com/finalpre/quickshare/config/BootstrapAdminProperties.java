package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.bootstrap-admin")
public class BootstrapAdminProperties {

    private boolean enabled = false;
    private String username = "";
    private String password = "";
    private String email = "";
    private String nickname = "";
    private boolean resetPasswordOnStartup = false;
}
