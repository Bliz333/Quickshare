package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.AdminConsoleProperties;
import com.finalpre.quickshare.service.AdminConsoleAccessPolicy;
import com.finalpre.quickshare.service.AdminConsoleAccessService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AdminConsoleAccessServiceImpl implements AdminConsoleAccessService {

    private static final String DEFAULT_ENTRY_SLUG = "quickshare-admin";

    @Autowired
    private AdminConsoleProperties adminConsoleProperties;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public AdminConsoleAccessPolicy getPolicy() {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getAdminConsoleAccessPolicy();
            if (override != null && override.isPresent()) {
                return normalize(override.get());
            }
        }

        return normalize(new AdminConsoleAccessPolicy(adminConsoleProperties.getSlug()));
    }

    @Override
    public String getEntryPath() {
        return "/console/" + getPolicy().entrySlug();
    }

    @Override
    public boolean matchesSlug(String slug) {
        return getPolicy().entrySlug().equals(normalizeSlug(slug));
    }

    private AdminConsoleAccessPolicy normalize(AdminConsoleAccessPolicy source) {
        return new AdminConsoleAccessPolicy(normalizeSlug(source == null ? null : source.entrySlug()));
    }

    private String normalizeSlug(String rawSlug) {
        if (rawSlug == null || rawSlug.isBlank()) {
            return DEFAULT_ENTRY_SLUG;
        }

        String normalized = rawSlug.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "-");
        normalized = normalized.replaceAll("-{2,}", "-");
        normalized = normalized.replaceAll("^-+", "").replaceAll("-+$", "");
        return normalized.isBlank() ? DEFAULT_ENTRY_SLUG : normalized;
    }
}
