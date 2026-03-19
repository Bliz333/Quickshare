package com.finalpre.quickshare.service;

import com.finalpre.quickshare.common.RateLimitScene;

import java.util.Optional;

public interface SystemSettingOverrideService {

    Optional<RateLimitRule> getRateLimitRule(RateLimitScene scene);

    void saveRateLimitRule(RateLimitScene scene, RateLimitRule rule);

    Optional<AdminConsoleAccessPolicy> getAdminConsoleAccessPolicy();

    void saveAdminConsoleAccessPolicy(AdminConsoleAccessPolicy policy);

    Optional<RegistrationSettingsPolicy> getRegistrationSettingsPolicy();

    void saveRegistrationSettingsPolicy(RegistrationSettingsPolicy policy);

    Optional<FileUploadPolicy> getFileUploadPolicy();

    void saveFileUploadPolicy(FileUploadPolicy policy);

    Optional<FilePreviewPolicy> getFilePreviewPolicy();

    void saveFilePreviewPolicy(FilePreviewPolicy policy);

    Optional<CorsPolicy> getCorsPolicy();

    void saveCorsPolicy(CorsPolicy policy);

    Optional<SmtpPolicy> getSmtpPolicy();

    void saveSmtpPolicy(SmtpPolicy policy);

    Optional<EmailTemplate> getEmailTemplate(String templateType);

    void saveEmailTemplate(String templateType, EmailTemplate template);

    Optional<StoragePolicy> getStoragePolicy();

    void saveStoragePolicy(StoragePolicy policy);
}
