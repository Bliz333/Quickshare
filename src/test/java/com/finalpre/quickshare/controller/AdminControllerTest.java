package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.GlobalExceptionHandler;
import com.finalpre.quickshare.config.CorsProperties;
import com.finalpre.quickshare.config.JwtAuthEntryPoint;
import com.finalpre.quickshare.config.JwtAuthenticationFilter;
import com.finalpre.quickshare.config.SecurityConfig;
import com.finalpre.quickshare.config.WebConfig;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.vo.AdminConsoleAccessVO;
import com.finalpre.quickshare.vo.AdminRegistrationSettingsVO;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.AdminPolicyService;
import com.finalpre.quickshare.service.AdminService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.service.impl.CorsPolicyServiceImpl;
import com.finalpre.quickshare.vo.AdminCorsPolicyVO;
import com.finalpre.quickshare.vo.AdminFilePreviewPolicyVO;
import com.finalpre.quickshare.vo.AdminFileUploadPolicyVO;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.AdminOverviewVO;
import com.finalpre.quickshare.vo.AdminRateLimitPolicyVO;
import com.finalpre.quickshare.vo.UserVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = AdminController.class, properties = {
        "app.cors.allowed-origins=http://allowed.example",
        "app.cors.allow-credentials=false",
        "app.cors.max-age-seconds=3600"
})
@Import({
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        JwtAuthEntryPoint.class,
        GlobalExceptionHandler.class,
        WebConfig.class,
        CorsProperties.class,
        CorsPolicyServiceImpl.class
})
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminService adminService;

    @MockBean
    private AdminPolicyService adminPolicyService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private SystemSettingOverrideService systemSettingOverrideService;

    @Test
    void overviewShouldRejectMissingToken() throws Exception {
        mockMvc.perform(get("/api/admin/overview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        verifyNoInteractions(adminService);
    }

    @Test
    void overviewShouldRejectUserRole() throws Exception {
        mockValidToken("token", 7L, "USER");

        mockMvc.perform(get("/api/admin/overview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(adminService);
    }

    @Test
    void overviewShouldAllowAdminRole() throws Exception {
        AdminOverviewVO overview = new AdminOverviewVO();
        overview.setUserCount(5L);
        overview.setFileCount(9L);
        overview.setShareCount(3L);

        mockValidToken("token", 1L, "ADMIN");
        when(adminService.getOverview()).thenReturn(overview);

        mockMvc.perform(get("/api/admin/overview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.userCount").value(5))
                .andExpect(jsonPath("$.data.fileCount").value(9))
                .andExpect(jsonPath("$.data.shareCount").value(3));
    }

    @Test
    void getUsersShouldReturnDataForAdmin() throws Exception {
        UserVO user = new UserVO();
        user.setId(2L);
        user.setUsername("alice");
        user.setRole("USER");

        mockValidToken("token", 1L, "ADMIN");
        when(adminService.getUsers()).thenReturn(List.of(user));

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].username").value("alice"))
                .andExpect(jsonPath("$.data[0].role").value("USER"));
    }

    @Test
    void createUserShouldDelegateForAdmin() throws Exception {
        UserVO created = new UserVO();
        created.setId(8L);
        created.setUsername("alice");
        created.setRole("USER");

        mockValidToken("token", 1L, "ADMIN");
        when(adminService.createUser(any(AdminCreateUserRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "alice",
                                  "password": "secret123",
                                  "email": "alice@example.com",
                                  "nickname": "Alice",
                                  "role": "USER"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("alice"))
                .andExpect(jsonPath("$.data.role").value("USER"));

        verify(adminService).createUser(any(AdminCreateUserRequest.class));
    }

    @Test
    void updateUserRoleShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/users/5/role")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminService).updateUserRole(5L, "ADMIN");
    }

    @Test
    void deleteUserShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(delete("/api/admin/users/5")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminService).deleteUser(5L, 1L);
    }

    @Test
    void disableShareShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/shares/6/disable")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminService).disableShare(6L);
    }

    @Test
    void getRateLimitPoliciesShouldReturnDataForAdmin() throws Exception {
        AdminRateLimitPolicyVO policy = new AdminRateLimitPolicyVO();
        policy.setScene("guest-upload");
        policy.setEnabled(true);
        policy.setMaxRequests(10L);
        policy.setWindowSeconds(600L);

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getRateLimitPolicies()).thenReturn(List.of(policy));

        mockMvc.perform(get("/api/admin/settings/rate-limits")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].scene").value("guest-upload"))
                .andExpect(jsonPath("$.data[0].maxRequests").value(10));
    }

    @Test
    void updateRateLimitPolicyShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/rate-limits/guest-upload")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true,\"maxRequests\":12,\"windowSeconds\":300}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateRateLimitPolicy(eq("guest-upload"), any());
    }

    @Test
    void getAdminConsoleAccessShouldReturnDataForAdmin() throws Exception {
        AdminConsoleAccessVO consoleAccess = new AdminConsoleAccessVO();
        consoleAccess.setEntrySlug("secret-console");
        consoleAccess.setEntryPath("/console/secret-console");

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getAdminConsoleAccess()).thenReturn(consoleAccess);

        mockMvc.perform(get("/api/admin/settings/admin-console")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entrySlug").value("secret-console"))
                .andExpect(jsonPath("$.data.entryPath").value("/console/secret-console"));
    }

    @Test
    void updateAdminConsoleAccessShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/admin-console")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"entrySlug\":\"secret-console\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateAdminConsoleAccess(any());
    }

    @Test
    void getRegistrationSettingsShouldReturnDataForAdmin() throws Exception {
        AdminRegistrationSettingsVO registrationSettings = new AdminRegistrationSettingsVO();
        registrationSettings.setEmailVerificationEnabled(false);
        registrationSettings.setRecaptchaEnabled(false);
        registrationSettings.setRecaptchaSiteKey("");
        registrationSettings.setRecaptchaSecretKey("");
        registrationSettings.setRecaptchaVerifyUrl("https://www.google.com/recaptcha/api/siteverify");

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getRegistrationSettings()).thenReturn(registrationSettings);

        mockMvc.perform(get("/api/admin/settings/registration")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.emailVerificationEnabled").value(false))
                .andExpect(jsonPath("$.data.recaptchaEnabled").value(false));
    }

    @Test
    void updateRegistrationSettingsShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/registration")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "emailVerificationEnabled": false,
                                  "recaptchaEnabled": false,
                                  "recaptchaSiteKey": "",
                                  "recaptchaSecretKey": "",
                                  "recaptchaVerifyUrl": "https://www.google.com/recaptcha/api/siteverify"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateRegistrationSettings(any());
    }

    @Test
    void getCorsPolicyShouldReturnDataForAdmin() throws Exception {
        AdminCorsPolicyVO policy = new AdminCorsPolicyVO();
        policy.setAllowedOrigins(List.of("http://allowed.example"));
        policy.setAllowedMethods(List.of("GET", "POST"));
        policy.setAllowedHeaders(List.of("*"));
        policy.setAllowCredentials(false);
        policy.setMaxAgeSeconds(3600L);

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getCorsPolicy()).thenReturn(policy);

        mockMvc.perform(get("/api/admin/settings/cors")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allowedOrigins[0]").value("http://allowed.example"))
                .andExpect(jsonPath("$.data.maxAgeSeconds").value(3600));
    }

    @Test
    void updateCorsPolicyShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/cors")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"allowedOrigins\":[\"http://allowed.example\"],\"allowedMethods\":[\"GET\"],\"allowedHeaders\":[\"*\"],\"allowCredentials\":false,\"maxAgeSeconds\":3600}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateCorsPolicy(any());
    }

    @Test
    void getFileUploadPolicyShouldReturnDataForAdmin() throws Exception {
        AdminFileUploadPolicyVO policy = new AdminFileUploadPolicyVO();
        policy.setGuestUploadEnabled(false);
        policy.setMaxFileSizeBytes(5_242_880L);
        policy.setHardMaxFileSizeBytes(10_485_760L);
        policy.setAllowedExtensions(List.of("pdf", "docx"));

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getFileUploadPolicy()).thenReturn(policy);

        mockMvc.perform(get("/api/admin/settings/file-upload")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.guestUploadEnabled").value(false))
                .andExpect(jsonPath("$.data.maxFileSizeBytes").value(5_242_880L))
                .andExpect(jsonPath("$.data.hardMaxFileSizeBytes").value(10_485_760L))
                .andExpect(jsonPath("$.data.allowedExtensions[0]").value("pdf"));
    }

    @Test
    void updateFileUploadPolicyShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/file-upload")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestUploadEnabled\":false,\"maxFileSizeBytes\":5242880,\"allowedExtensions\":[\"pdf\",\"docx\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateFileUploadPolicy(any());
    }

    @Test
    void getFilePreviewPolicyShouldReturnDataForAdmin() throws Exception {
        AdminFilePreviewPolicyVO policy = new AdminFilePreviewPolicyVO();
        policy.setEnabled(true);
        policy.setImageEnabled(true);
        policy.setVideoEnabled(true);
        policy.setAudioEnabled(true);
        policy.setPdfEnabled(true);
        policy.setTextEnabled(true);
        policy.setOfficeEnabled(true);
        policy.setAllowedExtensions(List.of("pdf", "docx", "pptx"));

        mockValidToken("token", 1L, "ADMIN");
        when(adminPolicyService.getFilePreviewPolicy()).thenReturn(policy);

        mockMvc.perform(get("/api/admin/settings/file-preview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.officeEnabled").value(true))
                .andExpect(jsonPath("$.data.allowedExtensions[1]").value("docx"));
    }

    @Test
    void updateFilePreviewPolicyShouldDelegateForAdmin() throws Exception {
        mockValidToken("token", 1L, "ADMIN");

        mockMvc.perform(put("/api/admin/settings/file-preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "enabled": true,
                                  "imageEnabled": true,
                                  "videoEnabled": true,
                                  "audioEnabled": true,
                                  "pdfEnabled": true,
                                  "textEnabled": true,
                                  "officeEnabled": true,
                                  "allowedExtensions": ["pdf", "docx", "pptx"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(adminPolicyService).updateFilePreviewPolicy(any());
    }

    private void mockValidToken(String token, Long userId, String role) {
        User user = new User();
        user.setId(userId);
        user.setRole(role);

        when(jwtUtil.validateAccessToken(token)).thenReturn(true);
        when(jwtUtil.getUserIdFromToken(token)).thenReturn(userId);
        when(userMapper.selectById(userId)).thenReturn(user);
    }
}
