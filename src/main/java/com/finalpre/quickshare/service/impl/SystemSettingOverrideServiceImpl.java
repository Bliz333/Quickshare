package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.common.RateLimitScene;
import com.finalpre.quickshare.entity.SystemSetting;
import com.finalpre.quickshare.service.AdminConsoleAccessPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.mapper.SystemSettingMapper;
import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.EmailTemplate;
import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.SettingEncryptor;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SystemSettingOverrideServiceImpl implements SystemSettingOverrideService {

    private static final String RATE_LIMIT_KEY_PREFIX = "rate-limit.";
    private static final String ADMIN_CONSOLE_ACCESS_KEY = "admin-console.access";
    private static final String REGISTRATION_SETTINGS_KEY = "registration.settings";
    private static final String FILE_UPLOAD_POLICY_KEY = "file-upload.policy";
    private static final String FILE_PREVIEW_POLICY_KEY = "file-preview.policy";
    private static final String CORS_POLICY_KEY = "cors.policy";
    private static final String SMTP_POLICY_KEY = "smtp.policy";
    private static final String EMAIL_TEMPLATE_KEY_PREFIX = "email-template.";
    private static final String STORAGE_POLICY_KEY = "storage.policy";

    /** Keys whose config_value contains secrets and must be encrypted at rest. */
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            SMTP_POLICY_KEY,
            REGISTRATION_SETTINGS_KEY,
            STORAGE_POLICY_KEY
    );

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @Autowired
    private SystemSettingMapper systemSettingMapper;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SettingEncryptor settingEncryptor;

    @PostConstruct
    public void loadOverrides() {
        try {
            List<SystemSetting> settings = systemSettingMapper.selectList(null);
            for (SystemSetting setting : settings) {
                if (setting.getConfigKey() != null && setting.getConfigValue() != null) {
                    String value = setting.getConfigValue();
                    // Decrypt sensitive keys on load
                    if (isSensitive(setting.getConfigKey()) && settingEncryptor.isEncrypted(value)) {
                        String decrypted = settingEncryptor.decrypt(value);
                        if (decrypted != null) {
                            value = decrypted;
                        } else {
                            log.warn("Failed to decrypt setting {}, skipping", setting.getConfigKey());
                            continue;
                        }
                    }
                    cache.put(setting.getConfigKey(), value);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to preload system settings, fallback to file properties. reason={}", ex.getMessage());
            log.debug("System settings preload stack", ex);
        }
    }

    @Override
    public Optional<RateLimitRule> getRateLimitRule(RateLimitScene scene) {
        if (scene == null) {
            return Optional.empty();
        }
        return readValue(buildRateLimitKey(scene), RateLimitRule.class);
    }

    @Override
    public void saveRateLimitRule(RateLimitScene scene, RateLimitRule rule) {
        if (scene == null || rule == null) {
            throw new IllegalArgumentException("频控策略不能为空");
        }

        upsert(
                buildRateLimitKey(scene),
                rule,
                "admin managed rate limit policy for " + scene.getSceneKey()
        );
    }

    @Override
    public Optional<AdminConsoleAccessPolicy> getAdminConsoleAccessPolicy() {
        return readValue(ADMIN_CONSOLE_ACCESS_KEY, AdminConsoleAccessPolicy.class);
    }

    @Override
    public void saveAdminConsoleAccessPolicy(AdminConsoleAccessPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("后台入口配置不能为空");
        }

        upsert(ADMIN_CONSOLE_ACCESS_KEY, policy, "admin managed admin console access policy");
    }

    @Override
    public Optional<RegistrationSettingsPolicy> getRegistrationSettingsPolicy() {
        return readValue(REGISTRATION_SETTINGS_KEY, RegistrationSettingsPolicy.class);
    }

    @Override
    public void saveRegistrationSettingsPolicy(RegistrationSettingsPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("注册设置不能为空");
        }

        upsert(REGISTRATION_SETTINGS_KEY, policy, "admin managed registration settings");
    }

    @Override
    public Optional<FileUploadPolicy> getFileUploadPolicy() {
        return readValue(FILE_UPLOAD_POLICY_KEY, FileUploadPolicy.class);
    }

    @Override
    public void saveFileUploadPolicy(FileUploadPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("上传策略不能为空");
        }

        upsert(FILE_UPLOAD_POLICY_KEY, policy, "admin managed file upload policy");
    }

    @Override
    public Optional<FilePreviewPolicy> getFilePreviewPolicy() {
        return readValue(FILE_PREVIEW_POLICY_KEY, FilePreviewPolicy.class);
    }

    @Override
    public void saveFilePreviewPolicy(FilePreviewPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("预览策略不能为空");
        }

        upsert(FILE_PREVIEW_POLICY_KEY, policy, "admin managed file preview policy");
    }

    @Override
    public Optional<CorsPolicy> getCorsPolicy() {
        return readValue(CORS_POLICY_KEY, CorsPolicy.class);
    }

    @Override
    public void saveCorsPolicy(CorsPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("CORS 策略不能为空");
        }

        upsert(CORS_POLICY_KEY, policy, "admin managed cors policy");
    }

    @Override
    public Optional<SmtpPolicy> getSmtpPolicy() {
        return readValue(SMTP_POLICY_KEY, SmtpPolicy.class);
    }

    @Override
    public void saveSmtpPolicy(SmtpPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("SMTP 配置不能为空");
        }

        upsert(SMTP_POLICY_KEY, policy, "admin managed smtp policy");
    }

    @Override
    public Optional<EmailTemplate> getEmailTemplate(String templateType) {
        if (templateType == null || templateType.isBlank()) return Optional.empty();
        return readValue(EMAIL_TEMPLATE_KEY_PREFIX + templateType, EmailTemplate.class);
    }

    @Override
    public void saveEmailTemplate(String templateType, EmailTemplate template) {
        if (templateType == null || templateType.isBlank() || template == null) {
            throw new IllegalArgumentException("邮件模板参数不能为空");
        }
        upsert(EMAIL_TEMPLATE_KEY_PREFIX + templateType, template,
                "admin managed email template: " + templateType);
    }

    @Override
    public Optional<StoragePolicy> getStoragePolicy() {
        return readValue(STORAGE_POLICY_KEY, StoragePolicy.class);
    }

    @Override
    public void saveStoragePolicy(StoragePolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("存储策略不能为空");
        }
        upsert(STORAGE_POLICY_KEY, policy, "admin managed storage policy");
    }

    private String buildRateLimitKey(RateLimitScene scene) {
        return RATE_LIMIT_KEY_PREFIX + scene.getSceneKey();
    }

    private <T> Optional<T> readValue(String key, Class<T> clazz) {
        String raw = cache.get(key);
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }

        try {
            return Optional.of(objectMapper.readValue(raw, clazz));
        } catch (Exception ex) {
            log.warn("Failed to parse cached system setting. key={}, reason={}", key, ex.getMessage());
            log.debug("System setting parse stack", ex);
            return Optional.empty();
        }
    }

    private void upsert(String key, Object value, String description) {
        try {
            String rawValue = objectMapper.writeValueAsString(value);

            // Encrypt sensitive values before DB storage
            String dbValue = isSensitive(key) ? settingEncryptor.encrypt(rawValue) : rawValue;

            SystemSetting existing = systemSettingMapper.selectOne(new QueryWrapper<SystemSetting>()
                    .eq("config_key", key)
                    .last("LIMIT 1"));

            if (existing == null) {
                SystemSetting setting = new SystemSetting();
                setting.setConfigKey(key);
                setting.setConfigValue(dbValue);
                setting.setDescription(description);
                systemSettingMapper.insert(setting);
            } else {
                existing.setConfigValue(dbValue);
                existing.setDescription(description);
                systemSettingMapper.updateById(existing);
            }

            // Cache holds plaintext for runtime use
            cache.put(key, rawValue);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("策略序列化失败", ex);
        }
    }

    private boolean isSensitive(String key) {
        return key != null && SENSITIVE_KEYS.contains(key);
    }
}
