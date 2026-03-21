package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.GlobalExceptionHandler;
import com.finalpre.quickshare.common.RateLimitExceededException;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.config.CorsProperties;
import com.finalpre.quickshare.config.JwtAuthEntryPoint;
import com.finalpre.quickshare.config.JwtAuthenticationFilter;
import com.finalpre.quickshare.config.SecurityConfig;
import com.finalpre.quickshare.config.WebConfig;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.QuotaService;
import com.finalpre.quickshare.service.RequestRateLimitService;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.StorageService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.service.impl.CorsPolicyServiceImpl;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = FileController.class, properties = {
        "app.cors.allowed-origins=http://allowed.example",
        "app.cors.allow-credentials=false",
        "app.cors.max-age-seconds=3600",
        "app.upload.guest-max-size-bytes=2"
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
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FileService fileService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private RequestRateLimitService requestRateLimitService;

    @MockBean
    private FileUploadPolicyService fileUploadPolicyService;

    @MockBean
    private FilePreviewPolicyService filePreviewPolicyService;

    @MockBean
    private OfficePreviewService officePreviewService;

    @MockBean
    private StorageService storageService;

    @MockBean
    private QuotaService quotaService;

    @MockBean
    private SystemSettingOverrideService systemSettingOverrideService;

    @Test
    void healthShouldAllowConfiguredCorsOrigin() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://allowed.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://allowed.example"));
    }

    @Test
    void healthShouldRejectDisallowedCorsOrigin() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void getUserFilesShouldRejectMissingToken() throws Exception {
        mockMvc.perform(get("/api/files"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未授权或登录已失效"));

        verifyNoInteractions(fileService);
    }

    @Test
    void previewShouldRejectMissingToken() throws Exception {
        mockMvc.perform(get("/api/files/3/preview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未授权或登录已失效"));

        verifyNoInteractions(fileService);
    }

    @Test
    void getUserFilesShouldUseFolderIdQueryParam() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(1L);
        file.setParentId(12L);
        file.setFolderId(12L);
        file.setIsFolder(0);

        mockValidToken("token", 7L);
        when(fileService.getFilesByFolder(12L, 7L)).thenReturn(List.of(file));

        mockMvc.perform(get("/api/files")
                        .param("folderId", "12")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].folderId").value(12));

        verify(fileService).getFilesByFolder(12L, 7L);
    }

    @Test
    void getUserFilesShouldAcceptTokenQueryParam() throws Exception {
        mockValidToken("token", 7L);
        when(fileService.getFilesByFolder(0L, 7L)).thenReturn(List.of());

        mockMvc.perform(get("/api/files")
                        .param("token", "token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(fileService).getFilesByFolder(0L, 7L);
    }

    @Test
    void getUserFilesShouldRejectGuestUploadTokenQueryParam() throws Exception {
        when(jwtUtil.validateAccessToken("guest-token")).thenReturn(false);

        mockMvc.perform(get("/api/files")
                        .param("token", "guest-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未授权或登录已失效"));

        verifyNoInteractions(fileService);
    }

    @Test
    void previewShouldAcceptTokenQueryParam() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(3L);
        file.setOriginalName("demo.txt");
        file.setFilePath("demo-key.txt");
        file.setFileType("text/plain");
        file.setFileSize(13L);

        mockValidToken("token", 7L);
        when(filePreviewPolicyService.isPreviewAllowed("demo.txt", "text/plain")).thenReturn(true);
        when(fileService.getFileById(3L, 7L)).thenReturn(file);
        when(storageService.exists("demo-key.txt")).thenReturn(true);
        when(storageService.getSize("demo-key.txt")).thenReturn(13L);
        when(storageService.retrieve("demo-key.txt")).thenReturn(
                new java.io.ByteArrayInputStream("hello preview".getBytes()));

        mockMvc.perform(get("/api/files/3/preview")
                        .param("token", "token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/plain"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("demo.txt")))
                .andExpect(content().string("hello preview"));

        verify(fileService).getFileById(3L, 7L);
    }

    @Test
    void previewShouldReturnForbiddenWhenPreviewPolicyDisablesType() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(3L);
        file.setOriginalName("demo.docx");
        file.setFilePath("demo-key.docx");
        file.setFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        file.setFileSize(14L);

        mockValidToken("token", 7L);
        when(fileService.getFileById(3L, 7L)).thenReturn(file);
        when(storageService.exists("demo-key.docx")).thenReturn(true);
        when(filePreviewPolicyService.isPreviewAllowed("demo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .thenReturn(false);

        mockMvc.perform(get("/api/files/3/preview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("当前文件类型不允许预览"));
    }

    @Test
    void previewShouldConvertOfficeDocumentToPdf(@org.junit.jupiter.api.io.TempDir Path tempDir) throws Exception {
        Path pdfFile = tempDir.resolve("demo.pdf");
        Files.writeString(pdfFile, "%PDF-1.4 demo");
        Path localDocx = tempDir.resolve("demo.docx");
        Files.writeString(localDocx, "office source");

        FileInfoVO file = new FileInfoVO();
        file.setId(3L);
        file.setOriginalName("demo.docx");
        file.setFilePath("demo-key.docx");
        file.setFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        file.setFileSize(13L);

        mockValidToken("token", 7L);
        when(fileService.getFileById(3L, 7L)).thenReturn(file);
        when(storageService.exists("demo-key.docx")).thenReturn(true);
        when(storageService.getLocalPath("demo-key.docx")).thenReturn(localDocx);
        when(filePreviewPolicyService.isPreviewAllowed("demo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .thenReturn(true);
        when(officePreviewService.supports("demo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .thenReturn(true);
        when(officePreviewService.preparePreview(any()))
                .thenReturn(new PreviewResource(pdfFile, "application/pdf", "demo.pdf", Files.size(pdfFile)));

        mockMvc.perform(get("/api/files/3/preview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("demo.pdf")))
                .andExpect(content().string("%PDF-1.4 demo"));
    }

    @Test
    void downloadOwnedFileShouldAllowTokenQueryParam() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(3L);
        file.setOriginalName("demo.txt");
        file.setFilePath("demo-key.txt");
        file.setFileType("text/plain");
        file.setFileSize(14L);

        mockValidToken("token", 7L);
        when(fileService.getFileById(3L, 7L)).thenReturn(file);
        when(storageService.exists("demo-key.txt")).thenReturn(true);
        when(storageService.retrieve("demo-key.txt")).thenReturn(
                new java.io.ByteArrayInputStream("hello download".getBytes()));

        mockMvc.perform(get("/api/files/3/download")
                        .param("token", "token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(content().string("hello download"));

        verify(quotaService).checkDownloadQuota(7L);
        verify(quotaService).recordDownload(7L);
    }

    @Test
    void getPreviewPolicyShouldReturnDataForAuthenticatedUser() throws Exception {
        mockValidToken("token", 7L);
        when(filePreviewPolicyService.getPolicy()).thenReturn(new FilePreviewPolicy(
                true, true, true, true, true, true, true, List.of("pdf", "docx", "pptx")
        ));

        mockMvc.perform(get("/api/settings/file-preview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.enabled").value(true))
                .andExpect(jsonPath("$.data.officeEnabled").value(true))
                .andExpect(jsonPath("$.data.allowedExtensions[2]").value("pptx"));
    }

    @Test
    void renameFolderShouldDelegateToService() throws Exception {
        mockValidToken("token", 7L);

        mockMvc.perform(put("/api/folders/15/rename")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newName\":\"docs\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(fileService).renameFolder(15L, "docs", 7L);
    }

    @Test
    void uploadShouldPassFolderIdToService() throws Exception {
        FileInfoVO uploaded = new FileInfoVO();
        uploaded.setId(9L);
        uploaded.setParentId(12L);
        uploaded.setFolderId(12L);

        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));
        mockValidToken("token", 7L);
        when(quotaService.isDefaultFreeTier(7L)).thenReturn(false);
        when(fileService.uploadFile(any(), eq(7L), eq(12L))).thenReturn(uploaded);

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes())
                        .param("folderId", "12")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.parentId").value(12))
                .andExpect(jsonPath("$.data.folderId").value(12));

        verify(fileService).uploadFile(any(), eq(7L), eq(12L));
    }

    @Test
    void uploadShouldApplyRateLimitForDefaultFreeTierUser() throws Exception {
        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));
        mockValidToken("token", 7L);
        when(quotaService.isDefaultFreeTier(7L)).thenReturn(true);
        doThrow(new RateLimitExceededException("当前免费账号上传过于频繁，请稍后再试或升级套餐"))
                .when(requestRateLimitService).checkBasicUserUploadAllowed(7L, "203.0.113.9");

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes())
                        .header("Authorization", "Bearer token")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("当前免费账号上传过于频繁，请稍后再试或升级套餐"));

        verifyNoInteractions(fileService);
    }

    @Test
    void uploadShouldAllowGuestWithoutToken() throws Exception {
        FileInfoVO uploaded = new FileInfoVO();
        uploaded.setId(9L);

        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));
        when(fileService.uploadFile(any(), eq(0L), isNull())).thenReturn(uploaded);
        when(jwtUtil.generateGuestUploadToken(9L)).thenReturn("guest-token");

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "ok".getBytes()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(9))
                .andExpect(jsonPath("$.data.guestUploadToken").value("guest-token"));

        verify(fileService).uploadFile(any(), eq(0L), isNull());
        verify(jwtUtil).generateGuestUploadToken(9L);
    }

    @Test
    void uploadShouldRejectGuestFileOverConfiguredLimit() throws Exception {
        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("匿名上传文件不能超过 2GB"));

        verifyNoInteractions(fileService);
    }

    @Test
    void uploadShouldReturnTooManyRequestsWhenGuestRateLimited() throws Exception {
        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));
        doThrow(new RateLimitExceededException("匿名上传过于频繁，请稍后再试"))
                .when(requestRateLimitService).checkGuestUploadAllowed("203.0.113.9");

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes())
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("匿名上传过于频繁，请稍后再试"));

        verifyNoInteractions(fileService);
    }

    @Test
    void uploadShouldRejectGuestWhenGuestUploadDisabled() throws Exception {
        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(false, -1L, List.of()));

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("匿名上传已关闭"));

        verifyNoInteractions(fileService);
    }

    @Test
    void previewShouldReturnNotFoundWhenPhysicalFileMissing() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(3L);
        file.setOriginalName("missing.txt");
        file.setFilePath("missing-key.txt");
        file.setFileType("text/plain");
        file.setFileSize(12L);

        mockValidToken("token", 7L);
        when(fileService.getFileById(3L, 7L)).thenReturn(file);
        when(storageService.exists("missing-key.txt")).thenReturn(false);

        mockMvc.perform(get("/api/files/3/preview")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("文件不存在"));
    }

    @Test
    void createShareShouldAllowGuestWithGuestUploadToken() throws Exception {
        ShareLinkVO shared = new ShareLinkVO();
        shared.setShareCode("ABCD1234");

        when(jwtUtil.validateGuestUploadToken("guest-token", 9L)).thenReturn(true);
        when(fileService.createShareLink(any(ShareRequestDTO.class), eq(0L))).thenReturn(shared);

        mockMvc.perform(post("/api/share")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\":9,\"guestUploadToken\":\"guest-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.shareCode").value("ABCD1234"));

        verify(jwtUtil).validateGuestUploadToken("guest-token", 9L);
        verify(fileService).createShareLink(any(ShareRequestDTO.class), eq(0L));
    }

    @Test
    void createShareShouldRejectGuestRequestWithInvalidUploadToken() throws Exception {
        when(jwtUtil.validateGuestUploadToken("bad-token", 9L)).thenReturn(false);

        mockMvc.perform(post("/api/share")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\":9,\"guestUploadToken\":\"bad-token\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("匿名分享凭证无效或已过期"));

        verifyNoInteractions(fileService);
    }

    @Test
    void getShareInfoShouldReturnNotFoundWhenShareMissing() throws Exception {
        doThrow(new ResourceNotFoundException("分享链接不存在"))
                .when(fileService).getShareInfo("ABCD1234", "1234");

        mockMvc.perform(get("/api/share/ABCD1234")
                        .param("extractCode", "1234"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("分享链接不存在"));
    }

    @Test
    void getShareInfoShouldReturnTooManyRequestsWhenRateLimited() throws Exception {
        doThrow(new RateLimitExceededException("分享访问请求过于频繁，请稍后再试"))
                .when(requestRateLimitService).checkPublicShareInfoAllowed("203.0.113.9");

        mockMvc.perform(get("/api/share/ABCD1234")
                        .param("extractCode", "1234")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("分享访问请求过于频繁，请稍后再试"));

        verifyNoInteractions(fileService);
    }

    @Test
    void getShareInfoShouldReturnBadRequestWhenExtractCodeMissing() throws Exception {
        mockMvc.perform(get("/api/share/ABCD1234"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("提取码错误"));

        verifyNoInteractions(fileService);
    }

    @Test
    void getShareInfoShouldReturnTooManyRequestsWhenExtractCodeFailuresExceeded() throws Exception {
        doThrow(new RateLimitExceededException("提取码尝试次数过多，请稍后再试"))
                .when(requestRateLimitService).checkPublicShareExtractCodeFailureAllowed("203.0.113.9", "ABCD1234");

        mockMvc.perform(get("/api/share/ABCD1234")
                        .param("extractCode", "1234")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("提取码尝试次数过多，请稍后再试"));

        verifyNoInteractions(fileService);
    }

    @Test
    void getShareInfoShouldRecordExtractCodeFailureWhenInvalid() throws Exception {
        doThrow(new IllegalArgumentException("提取码错误"))
                .when(fileService).getShareInfo("ABCD1234", "9999");

        mockMvc.perform(get("/api/share/ABCD1234")
                        .param("extractCode", "9999")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("提取码错误"));

        verify(requestRateLimitService).recordPublicShareExtractCodeFailure("203.0.113.9", "ABCD1234");
    }

    @Test
    void getShareInfoShouldResetExtractCodeFailuresWhenSuccess() throws Exception {
        ShareLinkVO shareLinkVO = new ShareLinkVO();
        shareLinkVO.setShareCode("ABCD1234");
        shareLinkVO.setFileName("demo.txt");

        when(fileService.getShareInfo("ABCD1234", "1234")).thenReturn(shareLinkVO);

        mockMvc.perform(get("/api/share/ABCD1234")
                        .param("extractCode", "1234")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.shareCode").value("ABCD1234"));

        verify(requestRateLimitService).resetPublicShareExtractCodeFailures("203.0.113.9", "ABCD1234");
    }

    @Test
    void downloadShouldReturnBadRequestWhenExtractCodeInvalid() throws Exception {
        doThrow(new IllegalArgumentException("提取码错误"))
                .when(fileService).downloadFile(eq("ABCD1234"), eq("9999"), any());

        mockMvc.perform(get("/api/download/ABCD1234")
                        .param("extractCode", "9999"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("提取码错误"));
    }

    @Test
    void downloadShouldReturnTooManyRequestsWhenRateLimited() throws Exception {
        doThrow(new RateLimitExceededException("下载请求过于频繁，请稍后再试"))
                .when(requestRateLimitService).checkPublicDownloadAllowed("203.0.113.9");

        mockMvc.perform(get("/api/download/ABCD1234")
                        .param("extractCode", "1234")
                        .header("X-Forwarded-For", "203.0.113.9"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("下载请求过于频繁，请稍后再试"));

        verifyNoInteractions(fileService);
    }

    @Test
    void downloadShouldCheckAndRecordQuotaWhenAuthenticated() throws Exception {
        mockValidToken("token", 7L);

        mockMvc.perform(get("/api/download/ABCD1234")
                        .param("extractCode", "1234")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(quotaService).checkDownloadQuota(7L);
        verify(fileService).downloadFile(eq("ABCD1234"), eq("1234"), any());
        verify(quotaService).recordDownload(7L);
    }

    @Test
    void downloadShouldSkipQuotaWhenAnonymous() throws Exception {
        mockMvc.perform(get("/api/download/ABCD1234")
                        .param("extractCode", "1234"))
                .andExpect(status().isOk());

        verify(fileService).downloadFile(eq("ABCD1234"), eq("1234"), any());
        verifyNoInteractions(quotaService);
    }

    @Test
    void createShareShouldRejectGuestRequestWithoutUploadToken() throws Exception {
        mockMvc.perform(post("/api/share")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\":9}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("缺少匿名分享凭证"));

        verifyNoInteractions(fileService);
    }

    @Test
    void renameFileShouldReturnBadRequestWhenNameBlank() throws Exception {
        mockValidToken("token", 7L);

        mockMvc.perform(put("/api/files/3/rename")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newName\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("文件名不能为空"));
    }

    @Test
    void deleteFileShouldReturnForbiddenWhenServiceDeniesOwnership() throws Exception {
        mockValidToken("token", 7L);
        doThrow(new AccessDeniedException("无权删除此文件")).when(fileService).deleteFile(3L, 7L);

        mockMvc.perform(delete("/api/files/3")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权限执行该操作"));
    }

    @Test
    void renameFolderShouldReturnNotFoundWhenFolderMissing() throws Exception {
        mockValidToken("token", 7L);
        doThrow(new ResourceNotFoundException("文件夹不存在"))
                .when(fileService).renameFolder(15L, "docs", 7L);

        mockMvc.perform(put("/api/folders/15/rename")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newName\":\"docs\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("文件夹不存在"));
    }

    private void mockValidToken(String token, Long userId) {
        User user = new User();
        user.setId(userId);
        user.setRole("USER");

        when(jwtUtil.validateAccessToken(token)).thenReturn(true);
        when(jwtUtil.getUserIdFromToken(token)).thenReturn(userId);
        when(userMapper.selectById(userId)).thenReturn(user);
    }
}
