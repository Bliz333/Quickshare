package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.RateLimitScene;
import com.finalpre.quickshare.dto.AdminConsoleAccessUpdateRequest;
import com.finalpre.quickshare.dto.AdminCorsPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFilePreviewPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFileUploadPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminRegistrationSettingsUpdateRequest;
import com.finalpre.quickshare.dto.AdminRateLimitPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminSmtpPolicyUpdateRequest;
import com.finalpre.quickshare.service.AdminConsoleAccessPolicy;
import com.finalpre.quickshare.service.AdminConsoleAccessService;
import com.finalpre.quickshare.service.CorsPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.LocalStorageRuntimeInfo;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.service.CorsPolicyService;
import com.finalpre.quickshare.service.RateLimitPolicyService;
import com.finalpre.quickshare.service.RateLimitRule;
import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.SmtpPolicyService;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.StoragePolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.vo.AdminFilePreviewPolicyVO;
import com.finalpre.quickshare.vo.AdminFileUploadPolicyVO;
import com.finalpre.quickshare.vo.AdminRegistrationSettingsVO;
import com.finalpre.quickshare.vo.AdminRateLimitPolicyVO;
import com.finalpre.quickshare.vo.AdminSmtpPolicyVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminPolicyServiceImplTest {

    @Mock
    private RateLimitPolicyService rateLimitPolicyService;

    @Mock
    private CorsPolicyService corsPolicyService;

    @Mock
    private FileUploadPolicyService fileUploadPolicyService;

    @Mock
    private FilePreviewPolicyService filePreviewPolicyService;

    @Mock
    private AdminConsoleAccessService adminConsoleAccessService;

    @Mock
    private RegistrationSettingsService registrationSettingsService;

    @Mock
    private SmtpPolicyService smtpPolicyService;

    @Mock
    private StoragePolicyService storagePolicyService;

    @Mock
    private DelegatingStorageService delegatingStorageService;

    @Mock
    private LocalStorageRuntimeInspector localStorageRuntimeInspector;

    @Mock
    private EmailServiceImpl emailServiceImpl;

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private AdminPolicyServiceImpl adminPolicyService;

    @Test
    void getRateLimitPoliciesShouldExposeAllScenes() {
        when(rateLimitPolicyService.getGuestUploadRule()).thenReturn(new RateLimitRule(true, 10L, 600L));
        when(rateLimitPolicyService.getPublicShareInfoRule()).thenReturn(new RateLimitRule(true, 60L, 600L));
        when(rateLimitPolicyService.getPublicDownloadRule()).thenReturn(new RateLimitRule(true, 30L, 600L));
        when(rateLimitPolicyService.getPublicShareExtractCodeErrorRule()).thenReturn(new RateLimitRule(true, 5L, 600L));

        List<AdminRateLimitPolicyVO> policies = adminPolicyService.getRateLimitPolicies();

        assertThat(policies).hasSize(4);
        assertThat(policies.get(0).getScene()).isEqualTo("guest-upload");
        assertThat(policies.get(3).getScene()).isEqualTo("public-share-extract-code-error");
    }

    @Test
    void updateRateLimitPolicyShouldPersistOverride() {
        AdminRateLimitPolicyUpdateRequest request = new AdminRateLimitPolicyUpdateRequest();
        request.setEnabled(false);
        request.setMaxRequests(12L);
        request.setWindowSeconds(300L);

        adminPolicyService.updateRateLimitPolicy("guest-upload", request);

        ArgumentCaptor<RateLimitRule> captor = ArgumentCaptor.forClass(RateLimitRule.class);
        verify(systemSettingOverrideService).saveRateLimitRule(org.mockito.ArgumentMatchers.eq(RateLimitScene.GUEST_UPLOAD), captor.capture());
        assertThat(captor.getValue()).isEqualTo(new RateLimitRule(false, 12L, 300L));
    }

    @Test
    void getAdminConsoleAccessShouldExposeResolvedPath() {
        when(adminConsoleAccessService.getPolicy()).thenReturn(new AdminConsoleAccessPolicy("secret-console"));

        var result = adminPolicyService.getAdminConsoleAccess();

        assertThat(result.getEntrySlug()).isEqualTo("secret-console");
        assertThat(result.getEntryPath()).isEqualTo("/console/secret-console");
    }

    @Test
    void updateAdminConsoleAccessShouldPersistNormalizedSlug() {
        AdminConsoleAccessUpdateRequest request = new AdminConsoleAccessUpdateRequest();
        request.setEntrySlug("secret-console_01");

        adminPolicyService.updateAdminConsoleAccess(request);

        ArgumentCaptor<AdminConsoleAccessPolicy> captor = ArgumentCaptor.forClass(AdminConsoleAccessPolicy.class);
        verify(systemSettingOverrideService).saveAdminConsoleAccessPolicy(captor.capture());
        assertThat(captor.getValue().entrySlug()).isEqualTo("secret-console_01");
    }

    @Test
    void getRegistrationSettingsShouldExposeResolvedPolicy() {
        when(registrationSettingsService.getPolicy()).thenReturn(new RegistrationSettingsPolicy(
                false, false, "recaptcha", "", "", "https://www.google.com/recaptcha/api/siteverify"
        ));

        AdminRegistrationSettingsVO result = adminPolicyService.getRegistrationSettings();

        assertThat(result.getEmailVerificationEnabled()).isFalse();
        assertThat(result.getRecaptchaEnabled()).isFalse();
    }

    @Test
    void updateRegistrationSettingsShouldPersistPolicy() {
        AdminRegistrationSettingsUpdateRequest request = new AdminRegistrationSettingsUpdateRequest();
        request.setEmailVerificationEnabled(false);
        request.setRecaptchaEnabled(false);
        request.setRecaptchaSiteKey("");
        request.setRecaptchaSecretKey("");
        request.setRecaptchaVerifyUrl("https://www.google.com/recaptcha/api/siteverify");

        adminPolicyService.updateRegistrationSettings(request);

        ArgumentCaptor<RegistrationSettingsPolicy> captor = ArgumentCaptor.forClass(RegistrationSettingsPolicy.class);
        verify(systemSettingOverrideService).saveRegistrationSettingsPolicy(captor.capture());
        assertThat(captor.getValue().emailVerificationEnabled()).isFalse();
        assertThat(captor.getValue().recaptchaEnabled()).isFalse();
    }

    @Test
    void getFileUploadPolicyShouldExposeCurrentPolicyAndHardLimit() {
        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(false, 5_242_880L, List.of("pdf", "docx")));
        when(fileUploadPolicyService.getHardMaxFileSizeBytes()).thenReturn(10_485_760L);

        AdminFileUploadPolicyVO policy = adminPolicyService.getFileUploadPolicy();

        assertThat(policy.getGuestUploadEnabled()).isFalse();
        assertThat(policy.getMaxFileSizeBytes()).isEqualTo(5_242_880L);
        assertThat(policy.getAllowedExtensions()).containsExactly("pdf", "docx");
        assertThat(policy.getHardMaxFileSizeBytes()).isEqualTo(10_485_760L);
    }

    @Test
    void updateFileUploadPolicyShouldNormalizeAndPersistOverride() {
        AdminFileUploadPolicyUpdateRequest request = new AdminFileUploadPolicyUpdateRequest();
        request.setGuestUploadEnabled(false);
        request.setMaxFileSizeBytes(3_145_728L);
        request.setAllowedExtensions(List.of(".PDF", " docx ", "pdf"));

        when(fileUploadPolicyService.getHardMaxFileSizeBytes()).thenReturn(10_485_760L);

        adminPolicyService.updateFileUploadPolicy(request);

        ArgumentCaptor<FileUploadPolicy> captor = ArgumentCaptor.forClass(FileUploadPolicy.class);
        verify(systemSettingOverrideService).saveFileUploadPolicy(captor.capture());
        assertThat(captor.getValue().guestUploadEnabled()).isFalse();
        assertThat(captor.getValue().maxFileSizeBytes()).isEqualTo(3_145_728L);
        assertThat(captor.getValue().allowedExtensions()).containsExactly("pdf", "docx");
    }

    @Test
    void updateFileUploadPolicyShouldRejectValueOverHardLimit() {
        AdminFileUploadPolicyUpdateRequest request = new AdminFileUploadPolicyUpdateRequest();
        request.setGuestUploadEnabled(true);
        request.setMaxFileSizeBytes(20_971_520L);
        request.setAllowedExtensions(List.of("pdf"));

        when(fileUploadPolicyService.getHardMaxFileSizeBytes()).thenReturn(10_485_760L);

        assertThatThrownBy(() -> adminPolicyService.updateFileUploadPolicy(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("上传大小限制不能超过当前服务硬上限");
    }

    @Test
    void getFilePreviewPolicyShouldExposeCurrentPolicy() {
        when(filePreviewPolicyService.getPolicy()).thenReturn(new FilePreviewPolicy(
                true, true, true, false, true, true, true, List.of("pdf", "docx")
        ));

        AdminFilePreviewPolicyVO policy = adminPolicyService.getFilePreviewPolicy();

        assertThat(policy.getEnabled()).isTrue();
        assertThat(policy.getAudioEnabled()).isFalse();
        assertThat(policy.getOfficeEnabled()).isTrue();
        assertThat(policy.getAllowedExtensions()).containsExactly("pdf", "docx");
    }

    @Test
    void updateFilePreviewPolicyShouldNormalizeAndPersistOverride() {
        AdminFilePreviewPolicyUpdateRequest request = new AdminFilePreviewPolicyUpdateRequest();
        request.setEnabled(true);
        request.setImageEnabled(true);
        request.setVideoEnabled(true);
        request.setAudioEnabled(true);
        request.setPdfEnabled(true);
        request.setTextEnabled(true);
        request.setOfficeEnabled(true);
        request.setAllowedExtensions(List.of(".PDF", " docx ", "pptx", "pdf"));

        adminPolicyService.updateFilePreviewPolicy(request);

        ArgumentCaptor<FilePreviewPolicy> captor = ArgumentCaptor.forClass(FilePreviewPolicy.class);
        verify(systemSettingOverrideService).saveFilePreviewPolicy(captor.capture());
        assertThat(captor.getValue().enabled()).isTrue();
        assertThat(captor.getValue().officeEnabled()).isTrue();
        assertThat(captor.getValue().allowedExtensions()).containsExactly("pdf", "docx", "pptx");
    }

    @Test
    void updateCorsPolicyShouldRejectWildcardWithCredentials() {
        AdminCorsPolicyUpdateRequest request = new AdminCorsPolicyUpdateRequest();
        request.setAllowedOrigins(List.of("*"));
        request.setAllowedMethods(List.of("GET"));
        request.setAllowedHeaders(List.of("*"));
        request.setAllowCredentials(true);
        request.setMaxAgeSeconds(3600L);

        assertThatThrownBy(() -> adminPolicyService.updateCorsPolicy(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("通配来源不支持携带凭证");
    }

    @Test
    void getSmtpPolicyShouldMaskPassword() {
        when(smtpPolicyService.getPolicy()).thenReturn(new SmtpPolicy(
                "smtp.gmail.com", 587, "user@gmail.com", "secret123", true, "user@gmail.com"
        ));

        AdminSmtpPolicyVO vo = adminPolicyService.getSmtpPolicy();

        assertThat(vo.getHost()).isEqualTo("smtp.gmail.com");
        assertThat(vo.getPort()).isEqualTo(587);
        assertThat(vo.getUsername()).isEqualTo("user@gmail.com");
        assertThat(vo.isHasPassword()).isTrue();
        assertThat(vo.isStarttlsEnabled()).isTrue();
        assertThat(vo.getSenderAddress()).isEqualTo("user@gmail.com");
    }

    @Test
    void getSmtpPolicyShouldShowNoPasswordWhenEmpty() {
        when(smtpPolicyService.getPolicy()).thenReturn(new SmtpPolicy(
                "smtp.gmail.com", 587, "user@gmail.com", "", true, "user@gmail.com"
        ));

        AdminSmtpPolicyVO vo = adminPolicyService.getSmtpPolicy();
        assertThat(vo.isHasPassword()).isFalse();
    }

    @Test
    void updateSmtpPolicyShouldPersistOverride() {
        AdminSmtpPolicyUpdateRequest request = new AdminSmtpPolicyUpdateRequest();
        request.setHost("smtp.example.com");
        request.setPort(465);
        request.setUsername("admin@example.com");
        request.setPassword("newpass");
        request.setStarttlsEnabled(true);
        request.setSenderAddress("noreply@example.com");

        adminPolicyService.updateSmtpPolicy(request);

        ArgumentCaptor<SmtpPolicy> captor = ArgumentCaptor.forClass(SmtpPolicy.class);
        verify(systemSettingOverrideService).saveSmtpPolicy(captor.capture());
        assertThat(captor.getValue().host()).isEqualTo("smtp.example.com");
        assertThat(captor.getValue().port()).isEqualTo(465);
        assertThat(captor.getValue().password()).isEqualTo("newpass");
        assertThat(captor.getValue().senderAddress()).isEqualTo("noreply@example.com");
    }

    @Test
    void updateSmtpPolicyShouldKeepExistingPasswordWhenNull() {
        when(smtpPolicyService.getPolicy()).thenReturn(new SmtpPolicy(
                "smtp.gmail.com", 587, "user@gmail.com", "oldpass", true, "user@gmail.com"
        ));

        AdminSmtpPolicyUpdateRequest request = new AdminSmtpPolicyUpdateRequest();
        request.setHost("smtp.gmail.com");
        request.setPort(587);
        request.setUsername("user@gmail.com");
        request.setPassword(null); // no new password
        request.setStarttlsEnabled(true);

        adminPolicyService.updateSmtpPolicy(request);

        ArgumentCaptor<SmtpPolicy> captor = ArgumentCaptor.forClass(SmtpPolicy.class);
        verify(systemSettingOverrideService).saveSmtpPolicy(captor.capture());
        assertThat(captor.getValue().password()).isEqualTo("oldpass");
    }

    @Test
    void updateSmtpPolicyShouldRejectEmptyHost() {
        AdminSmtpPolicyUpdateRequest request = new AdminSmtpPolicyUpdateRequest();
        request.setHost("");
        request.setPort(587);

        assertThatThrownBy(() -> adminPolicyService.updateSmtpPolicy(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("SMTP 主机地址不能为空");
    }

    @Test
    void updateSmtpPolicyShouldRejectInvalidPort() {
        AdminSmtpPolicyUpdateRequest request = new AdminSmtpPolicyUpdateRequest();
        request.setHost("smtp.example.com");
        request.setPort(0);

        assertThatThrownBy(() -> adminPolicyService.updateSmtpPolicy(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("SMTP 端口号必须在 1-65535 之间");
    }

    @Test
    void updateCorsPolicyShouldNormalizeAndPersistPolicy() {
        AdminCorsPolicyUpdateRequest request = new AdminCorsPolicyUpdateRequest();
        request.setAllowedOrigins(List.of(" http://allowed.example ", "http://allowed.example"));
        request.setAllowedMethods(List.of("get", "post", "GET"));
        request.setAllowedHeaders(List.of("Authorization", " Authorization "));
        request.setAllowCredentials(false);
        request.setMaxAgeSeconds(7200L);

        adminPolicyService.updateCorsPolicy(request);

        ArgumentCaptor<CorsPolicy> captor = ArgumentCaptor.forClass(CorsPolicy.class);
        verify(systemSettingOverrideService).saveCorsPolicy(captor.capture());
        assertThat(captor.getValue().allowedOrigins()).containsExactly("http://allowed.example");
        assertThat(captor.getValue().allowedMethods()).containsExactly("GET", "POST");
        assertThat(captor.getValue().allowedHeaders()).containsExactly("Authorization");
        assertThat(captor.getValue().maxAgeSeconds()).isEqualTo(7200L);
    }

    @Test
    void getStoragePolicyShouldExposeLocalDiskMetrics() {
        when(storagePolicyService.getPolicy()).thenReturn(new StoragePolicy("local", "", "", "", "", "", false));
        when(localStorageRuntimeInspector.resolve()).thenReturn(new LocalStorageRuntimeInfo(
                "/srv/quickshare/uploads",
                false,
                1_000L,
                860L,
                86.0,
                "healthy"
        ));

        var result = adminPolicyService.getStoragePolicy();

        assertThat(result.getType()).isEqualTo("local");
        assertThat(result.getConnectionStatus()).isEqualTo("local");
        assertThat(result.getLocalUploadDir()).isEqualTo("/srv/quickshare/uploads");
        assertThat(result.isLocalUploadDirExists()).isFalse();
        assertThat(result.getLocalDiskTotalBytes()).isEqualTo(1_000L);
        assertThat(result.getLocalDiskUsableBytes()).isEqualTo(860L);
        assertThat(result.getLocalDiskUsablePercent()).isEqualTo(86.0);
        assertThat(result.getLocalDiskRiskLevel()).isEqualTo("healthy");
    }

    @Test
    void getStoragePolicyShouldExposeS3ConnectionState() {
        StoragePolicy policy = new StoragePolicy(
                "s3",
                "https://s3.example.com",
                "access",
                "secret",
                "quickshare",
                "auto",
                true
        );
        when(storagePolicyService.getPolicy()).thenReturn(policy);
        when(delegatingStorageService.testS3Connection(policy)).thenReturn(null);

        var result = adminPolicyService.getStoragePolicy();

        assertThat(result.getType()).isEqualTo("s3");
        assertThat(result.getConnectionStatus()).isEqualTo("connected");
        assertThat(result.getS3Endpoint()).isEqualTo("https://s3.example.com");
        assertThat(result.getS3Bucket()).isEqualTo("quickshare");
    }
}
