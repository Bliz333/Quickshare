package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.RateLimitScene;
import com.finalpre.quickshare.dto.AdminConsoleAccessUpdateRequest;
import com.finalpre.quickshare.dto.AdminCorsPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFilePreviewPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFileUploadPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminRegistrationSettingsUpdateRequest;
import com.finalpre.quickshare.dto.AdminRateLimitPolicyUpdateRequest;
import com.finalpre.quickshare.service.AdminConsoleAccessPolicy;
import com.finalpre.quickshare.service.AdminConsoleAccessService;
import com.finalpre.quickshare.service.AdminPolicyService;
import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.CorsPolicyService;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.service.RateLimitPolicyService;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.vo.AdminConsoleAccessVO;
import com.finalpre.quickshare.vo.AdminCorsPolicyVO;
import com.finalpre.quickshare.vo.AdminFilePreviewPolicyVO;
import com.finalpre.quickshare.vo.AdminFileUploadPolicyVO;
import com.finalpre.quickshare.vo.AdminRegistrationSettingsVO;
import com.finalpre.quickshare.vo.AdminRateLimitPolicyVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminPolicyServiceImpl implements AdminPolicyService {

    @Autowired
    private RateLimitPolicyService rateLimitPolicyService;

    @Autowired
    private CorsPolicyService corsPolicyService;

    @Autowired
    private FileUploadPolicyService fileUploadPolicyService;

    @Autowired
    private FilePreviewPolicyService filePreviewPolicyService;

    @Autowired
    private AdminConsoleAccessService adminConsoleAccessService;

    @Autowired
    private RegistrationSettingsService registrationSettingsService;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public List<AdminRateLimitPolicyVO> getRateLimitPolicies() {
        return List.of(
                toRateLimitVO(RateLimitScene.GUEST_UPLOAD, rateLimitPolicyService.getGuestUploadRule()),
                toRateLimitVO(RateLimitScene.PUBLIC_SHARE_INFO, rateLimitPolicyService.getPublicShareInfoRule()),
                toRateLimitVO(RateLimitScene.PUBLIC_DOWNLOAD, rateLimitPolicyService.getPublicDownloadRule()),
                toRateLimitVO(RateLimitScene.PUBLIC_SHARE_EXTRACT_CODE_ERROR, rateLimitPolicyService.getPublicShareExtractCodeErrorRule())
        );
    }

    @Override
    public void updateRateLimitPolicy(String sceneKey, AdminRateLimitPolicyUpdateRequest request) {
        if (request == null || request.getEnabled() == null || request.getMaxRequests() == null || request.getWindowSeconds() == null) {
            throw new IllegalArgumentException("频控策略参数不完整");
        }
        if (request.getMaxRequests() <= 0 || request.getWindowSeconds() <= 0) {
            throw new IllegalArgumentException("频控阈值必须大于 0");
        }

        RateLimitScene scene = RateLimitScene.fromKey(sceneKey);
        systemSettingOverrideService.saveRateLimitRule(
                scene,
                new RateLimitRule(request.getEnabled(), request.getMaxRequests(), request.getWindowSeconds())
        );
    }

    @Override
    public AdminConsoleAccessVO getAdminConsoleAccess() {
        return toAdminConsoleAccessVO(adminConsoleAccessService.getPolicy());
    }

    @Override
    public void updateAdminConsoleAccess(AdminConsoleAccessUpdateRequest request) {
        if (request == null || request.getEntrySlug() == null || request.getEntrySlug().isBlank()) {
            throw new IllegalArgumentException("后台入口路径不能为空");
        }

        String normalizedSlug = request.getEntrySlug().trim().toLowerCase();
        if (!normalizedSlug.matches("^[a-z0-9][a-z0-9_-]{3,63}$")) {
            throw new IllegalArgumentException("后台入口路径仅支持 4-64 位小写字母、数字、下划线和中划线");
        }

        systemSettingOverrideService.saveAdminConsoleAccessPolicy(new AdminConsoleAccessPolicy(normalizedSlug));
    }

    @Override
    public AdminRegistrationSettingsVO getRegistrationSettings() {
        return toAdminRegistrationSettingsVO(registrationSettingsService.getPolicy());
    }

    @Override
    public void updateRegistrationSettings(AdminRegistrationSettingsUpdateRequest request) {
        if (request == null
                || request.getEmailVerificationEnabled() == null
                || request.getRecaptchaEnabled() == null) {
            throw new IllegalArgumentException("注册设置参数不完整");
        }

        String siteKey = normalizeOptionalValue(request.getRecaptchaSiteKey());
        String secretKey = normalizeOptionalValue(request.getRecaptchaSecretKey());
        String verifyUrl = normalizeOptionalValue(request.getRecaptchaVerifyUrl());
        if (verifyUrl == null) {
            verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        }

        if (Boolean.TRUE.equals(request.getRecaptchaEnabled())
                && (siteKey == null || secretKey == null || verifyUrl.isBlank())) {
            throw new IllegalArgumentException("启用人机验证时必须填写 site key、secret key 和校验地址");
        }

        systemSettingOverrideService.saveRegistrationSettingsPolicy(new RegistrationSettingsPolicy(
                request.getEmailVerificationEnabled(),
                request.getRecaptchaEnabled(),
                siteKey == null ? "" : siteKey,
                secretKey == null ? "" : secretKey,
                verifyUrl
        ));
    }

    @Override
    public AdminFileUploadPolicyVO getFileUploadPolicy() {
        FileUploadPolicy policy = fileUploadPolicyService.getPolicy();
        AdminFileUploadPolicyVO vo = new AdminFileUploadPolicyVO();
        vo.setGuestUploadEnabled(policy.guestUploadEnabled());
        vo.setMaxFileSizeBytes(policy.maxFileSizeBytes());
        vo.setAllowedExtensions(policy.allowedExtensions());
        vo.setHardMaxFileSizeBytes(fileUploadPolicyService.getHardMaxFileSizeBytes());
        return vo;
    }

    @Override
    public void updateFileUploadPolicy(AdminFileUploadPolicyUpdateRequest request) {
        if (request == null || request.getGuestUploadEnabled() == null || request.getMaxFileSizeBytes() == null) {
            throw new IllegalArgumentException("上传策略参数不完整");
        }

        long maxFileSizeBytes = request.getMaxFileSizeBytes();
        if (maxFileSizeBytes == 0 || maxFileSizeBytes < -1) {
            throw new IllegalArgumentException("上传大小限制必须为正数或 -1");
        }

        long hardMaxFileSizeBytes = fileUploadPolicyService.getHardMaxFileSizeBytes();
        if (hardMaxFileSizeBytes > 0 && maxFileSizeBytes > hardMaxFileSizeBytes) {
            throw new IllegalArgumentException("上传大小限制不能超过当前服务硬上限");
        }

        List<String> allowedExtensions = normalizeList(request.getAllowedExtensions(), false, List.of()).stream()
                .map(value -> value.startsWith(".") ? value.substring(1) : value)
                .map(String::toLowerCase)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();

        systemSettingOverrideService.saveFileUploadPolicy(new FileUploadPolicy(
                request.getGuestUploadEnabled(),
                maxFileSizeBytes,
                allowedExtensions
        ));
    }

    @Override
    public AdminFilePreviewPolicyVO getFilePreviewPolicy() {
        FilePreviewPolicy policy = filePreviewPolicyService.getPolicy();
        AdminFilePreviewPolicyVO vo = new AdminFilePreviewPolicyVO();
        vo.setEnabled(policy.enabled());
        vo.setImageEnabled(policy.imageEnabled());
        vo.setVideoEnabled(policy.videoEnabled());
        vo.setAudioEnabled(policy.audioEnabled());
        vo.setPdfEnabled(policy.pdfEnabled());
        vo.setTextEnabled(policy.textEnabled());
        vo.setOfficeEnabled(policy.officeEnabled());
        vo.setAllowedExtensions(policy.allowedExtensions());
        return vo;
    }

    @Override
    public void updateFilePreviewPolicy(AdminFilePreviewPolicyUpdateRequest request) {
        if (request == null
                || request.getEnabled() == null
                || request.getImageEnabled() == null
                || request.getVideoEnabled() == null
                || request.getAudioEnabled() == null
                || request.getPdfEnabled() == null
                || request.getTextEnabled() == null
                || request.getOfficeEnabled() == null) {
            throw new IllegalArgumentException("预览策略参数不完整");
        }

        List<String> allowedExtensions = normalizeList(request.getAllowedExtensions(), false, List.of()).stream()
                .map(value -> value.startsWith(".") ? value.substring(1) : value)
                .map(String::toLowerCase)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();

        systemSettingOverrideService.saveFilePreviewPolicy(new FilePreviewPolicy(
                request.getEnabled(),
                request.getImageEnabled(),
                request.getVideoEnabled(),
                request.getAudioEnabled(),
                request.getPdfEnabled(),
                request.getTextEnabled(),
                request.getOfficeEnabled(),
                allowedExtensions
        ));
    }

    @Override
    public AdminCorsPolicyVO getCorsPolicy() {
        return toCorsVO(corsPolicyService.getPolicy());
    }

    @Override
    public void updateCorsPolicy(AdminCorsPolicyUpdateRequest request) {
        if (request == null || request.getAllowedOrigins() == null || request.getAllowedOrigins().isEmpty()) {
            throw new IllegalArgumentException("允许来源不能为空");
        }

        List<String> allowedOrigins = normalizeList(request.getAllowedOrigins(), false, List.of());
        if (allowedOrigins.isEmpty()) {
            throw new IllegalArgumentException("允许来源不能为空");
        }

        boolean allowCredentials = Boolean.TRUE.equals(request.getAllowCredentials());
        if (allowedOrigins.contains("*") && allowCredentials) {
            throw new IllegalArgumentException("通配来源不支持携带凭证");
        }

        long maxAgeSeconds = request.getMaxAgeSeconds() == null ? 3600L : request.getMaxAgeSeconds();
        if (maxAgeSeconds <= 0) {
            throw new IllegalArgumentException("CORS 缓存时间必须大于 0");
        }

        CorsPolicy policy = new CorsPolicy(
                allowedOrigins,
                normalizeList(request.getAllowedMethods(), true, List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")),
                normalizeList(request.getAllowedHeaders(), false, List.of("*")),
                allowCredentials,
                maxAgeSeconds
        );
        systemSettingOverrideService.saveCorsPolicy(policy);
    }

    private AdminRateLimitPolicyVO toRateLimitVO(RateLimitScene scene, RateLimitRule rule) {
        AdminRateLimitPolicyVO vo = new AdminRateLimitPolicyVO();
        vo.setScene(scene.getSceneKey());
        vo.setEnabled(rule.enabled());
        vo.setMaxRequests(rule.maxRequests());
        vo.setWindowSeconds(rule.windowSeconds());
        return vo;
    }

    private AdminCorsPolicyVO toCorsVO(CorsPolicy policy) {
        AdminCorsPolicyVO vo = new AdminCorsPolicyVO();
        vo.setAllowedOrigins(policy.allowedOrigins());
        vo.setAllowedMethods(policy.allowedMethods());
        vo.setAllowedHeaders(policy.allowedHeaders());
        vo.setAllowCredentials(policy.allowCredentials());
        vo.setMaxAgeSeconds(policy.maxAgeSeconds());
        return vo;
    }

    private AdminConsoleAccessVO toAdminConsoleAccessVO(AdminConsoleAccessPolicy policy) {
        AdminConsoleAccessVO vo = new AdminConsoleAccessVO();
        vo.setEntrySlug(policy.entrySlug());
        vo.setEntryPath("/console/" + policy.entrySlug());
        return vo;
    }

    private AdminRegistrationSettingsVO toAdminRegistrationSettingsVO(RegistrationSettingsPolicy policy) {
        AdminRegistrationSettingsVO vo = new AdminRegistrationSettingsVO();
        vo.setEmailVerificationEnabled(policy.emailVerificationEnabled());
        vo.setRecaptchaEnabled(policy.recaptchaEnabled());
        vo.setRecaptchaSiteKey(policy.recaptchaSiteKey());
        vo.setRecaptchaSecretKey(policy.recaptchaSecretKey());
        vo.setRecaptchaVerifyUrl(policy.recaptchaVerifyUrl());
        return vo;
    }

    private String normalizeOptionalValue(String rawValue) {
        if (rawValue == null) {
            return null;
        }
        String value = rawValue.trim();
        return value.isEmpty() ? null : value;
    }

    private List<String> normalizeList(List<String> values, boolean upperCase, List<String> defaults) {
        if (values == null || values.isEmpty()) {
            return defaults;
        }

        List<String> normalized = values.stream()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> upperCase ? value.toUpperCase() : value)
                .distinct()
                .toList();
        return normalized.isEmpty() ? defaults : normalized;
    }
}
