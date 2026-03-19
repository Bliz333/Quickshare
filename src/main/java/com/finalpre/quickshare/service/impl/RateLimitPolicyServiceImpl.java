package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.RateLimitProperties;
import com.finalpre.quickshare.common.RateLimitScene;
import com.finalpre.quickshare.service.RateLimitPolicyService;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RateLimitPolicyServiceImpl implements RateLimitPolicyService {

    @Autowired
    private RateLimitProperties rateLimitProperties;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public RateLimitRule getGuestUploadRule() {
        return resolveRule(RateLimitScene.GUEST_UPLOAD, rateLimitProperties.getGuestUpload());
    }

    @Override
    public RateLimitRule getPublicShareInfoRule() {
        return resolveRule(RateLimitScene.PUBLIC_SHARE_INFO, rateLimitProperties.getPublicShareInfo());
    }

    @Override
    public RateLimitRule getPublicDownloadRule() {
        return resolveRule(RateLimitScene.PUBLIC_DOWNLOAD, rateLimitProperties.getPublicDownload());
    }

    @Override
    public RateLimitRule getPublicShareExtractCodeErrorRule() {
        return resolveRule(RateLimitScene.PUBLIC_SHARE_EXTRACT_CODE_ERROR, rateLimitProperties.getPublicShareExtractCodeError());
    }

    private RateLimitRule resolveRule(RateLimitScene scene, RateLimitProperties.Rule defaultRule) {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getRateLimitRule(scene);
            if (override != null && override.isPresent()) {
                return override.get();
            }
        }
        return toRule(defaultRule);
    }

    private RateLimitRule toRule(RateLimitProperties.Rule source) {
        if (source == null) {
            return new RateLimitRule(true, 10, 600);
        }
        return new RateLimitRule(source.isEnabled(), source.getMaxRequests(), source.getWindowSeconds());
    }
}
