package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.SmtpPolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SmtpPolicyServiceImpl implements SmtpPolicyService {

    @Value("${spring.mail.host:}")
    private String defaultHost;

    @Value("${spring.mail.port:587}")
    private int defaultPort;

    @Value("${spring.mail.username:}")
    private String defaultUsername;

    @Value("${spring.mail.password:}")
    private String defaultPassword;

    @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}")
    private boolean defaultStarttls;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public SmtpPolicy getPolicy() {
        var override = systemSettingOverrideService.getSmtpPolicy();
        if (override != null && override.isPresent()) {
            return override.get();
        }

        return new SmtpPolicy(
                defaultHost,
                defaultPort,
                defaultUsername,
                defaultPassword,
                defaultStarttls,
                defaultUsername
        );
    }
}
