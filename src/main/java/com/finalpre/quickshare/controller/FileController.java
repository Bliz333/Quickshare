package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.dto.FolderRequest;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.RequestRateLimitService;
import com.finalpre.quickshare.service.StorageService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.FilePreviewPolicyVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class FileController {

    private static final Long GUEST_USER_ID = 0L;

    @Autowired
    private FileService fileService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RequestRateLimitService requestRateLimitService;

    @Autowired
    private FileUploadPolicyService fileUploadPolicyService;

    @Autowired
    private FilePreviewPolicyService filePreviewPolicyService;

    @Autowired
    private OfficePreviewService officePreviewService;

    @Autowired
    private StorageService storageService;

    /**
     * 上传文件
     */
    @PostMapping("/upload")
    public Result<FileInfoVO> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folderId", required = false) Long folderId,
            HttpServletRequest request,
            Authentication authentication) {
        Long authenticatedUserId = extractAuthenticatedUserId(authentication);
        boolean guestUpload = authenticatedUserId == null;
        if (guestUpload && !fileUploadPolicyService.getPolicy().guestUploadEnabled()) {
            throw new FeatureDisabledException("匿名上传已关闭");
        }
        if (guestUpload && folderId != null && folderId != 0L) {
            throw new IllegalArgumentException("匿名上传不支持指定文件夹");
        }
        if (guestUpload) {
            requestRateLimitService.checkGuestUploadAllowed(resolveClientIp(request));
        }

        Long effectiveUserId = guestUpload ? GUEST_USER_ID : authenticatedUserId;
        FileInfoVO vo = fileService.uploadFile(file, effectiveUserId, guestUpload ? null : folderId);
        if (guestUpload && vo.getId() != null) {
            vo.setGuestUploadToken(jwtUtil.generateGuestUploadToken(vo.getId()));
        }
        return Result.success(vo);
    }

    /**
     * 获取当前用户当前目录的文件列表
     */
    @GetMapping("/files")
    public Result<List<FileInfoVO>> getUserFiles(
            @RequestParam(required = false) Long folderId,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        Long targetFolderId = folderId == null ? 0L : folderId;
        List<FileInfoVO> fileList = fileService.getFilesByFolder(targetFolderId, userId);
        return Result.success(fileList);
    }

    /**
     * 删除文件
     */
    @DeleteMapping("/files/{fileId}")
    public Result<Void> deleteFile(
            @PathVariable Long fileId,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        fileService.deleteFile(fileId, userId);
        return Result.success(null);
    }

    /**
     * 删除文件夹
     */
    @DeleteMapping("/folders/{folderId}")
    public Result<Void> deleteFolder(
            @PathVariable Long folderId,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        fileService.deleteFolder(folderId, userId);
        return Result.success(null);
    }

    /**
     * 重命名文件
     */
    @PutMapping("/files/{fileId}/rename")
    public Result<Void> renameFile(
            @PathVariable Long fileId,
            @RequestBody java.util.Map<String, String> request,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        String newName = request.get("newName");
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("文件名不能为空");
        }

        fileService.renameFile(fileId, newName, userId);
        return Result.success(null);
    }

    /**
     * 预览文件（支持 header 或 URL 参数传 token）
     */
    @GetMapping("/files/{fileId}/preview")
    public void previewFile(@PathVariable Long fileId,
                            @RequestParam(value = "max_size", required = false) Integer maxSize,
                            Authentication authentication,
                            HttpServletResponse response) throws IOException {
        Long userId = requireUserId(authentication);
        streamOwnedFile(fileId, userId, response, true, maxSize);
    }

    /**
     * 下载当前用户文件（支持 header 或 URL 参数传 token）
     */
    @GetMapping("/files/{fileId}/download")
    public void downloadOwnedFile(@PathVariable Long fileId,
                                  Authentication authentication,
                                  HttpServletResponse response) throws IOException {
        Long userId = requireUserId(authentication);
        streamOwnedFile(fileId, userId, response, false, null);
    }

    @GetMapping("/settings/file-preview")
    public Result<FilePreviewPolicyVO> getFilePreviewPolicy(Authentication authentication) {
        requireUserId(authentication);

        FilePreviewPolicy policy = filePreviewPolicyService.getPolicy();
        FilePreviewPolicyVO vo = new FilePreviewPolicyVO();
        vo.setEnabled(policy.enabled());
        vo.setImageEnabled(policy.imageEnabled());
        vo.setVideoEnabled(policy.videoEnabled());
        vo.setAudioEnabled(policy.audioEnabled());
        vo.setPdfEnabled(policy.pdfEnabled());
        vo.setTextEnabled(policy.textEnabled());
        vo.setOfficeEnabled(policy.officeEnabled());
        vo.setAllowedExtensions(policy.allowedExtensions());
        return Result.success(vo);
    }

    /**
     * 创建分享链接
     */
    @PostMapping("/share")
    public Result<ShareLinkVO> createShare(
            @RequestBody ShareRequestDTO request,
            Authentication authentication) {
        Long userId = resolveShareUserId(authentication, request);
        ShareLinkVO vo = fileService.createShareLink(request, userId);
        return Result.success(vo);
    }

    /**
     * 获取分享信息（不需要认证）
     */
    @GetMapping("/share/{shareCode}")
    public Result<ShareLinkVO> getShareInfo(
            @PathVariable String shareCode,
            @RequestParam(required = false) String extractCode,
            HttpServletRequest request) {
        String clientIp = resolveClientIp(request);
        requestRateLimitService.checkPublicShareInfoAllowed(clientIp);
        if (extractCode == null || extractCode.isBlank()) {
            throw new IllegalArgumentException("提取码错误");
        }

        requestRateLimitService.checkPublicShareExtractCodeFailureAllowed(clientIp, shareCode);

        try {
            ShareLinkVO vo = fileService.getShareInfo(shareCode, extractCode);
            requestRateLimitService.resetPublicShareExtractCodeFailures(clientIp, shareCode);
            return Result.success(vo);
        } catch (IllegalArgumentException ex) {
            if ("提取码错误".equals(ex.getMessage())) {
                requestRateLimitService.recordPublicShareExtractCodeFailure(clientIp, shareCode);
            }
            throw ex;
        }
    }

    /**
     * 下载文件（不需要认证）
     */
    @GetMapping("/download/{shareCode}")
    public void downloadFile(
            @PathVariable String shareCode,
            @RequestParam String extractCode,
            HttpServletRequest request,
            HttpServletResponse response) {
        requestRateLimitService.checkPublicDownloadAllowed(resolveClientIp(request));
        fileService.downloadFile(shareCode, extractCode, response);
    }

    /**
     * 预览分享文件（不需要认证，支持 Office 转 PDF）
     */
    @GetMapping("/preview/{shareCode}")
    public void previewShareFile(
            @PathVariable String shareCode,
            @RequestParam String extractCode,
            HttpServletRequest request,
            HttpServletResponse response) {
        requestRateLimitService.checkPublicDownloadAllowed(resolveClientIp(request));
        fileService.previewShareFile(shareCode, extractCode, response);
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public Result<String> health() {
        return Result.success("QuickShare is running!");
    }

    /**
     * 创建文件夹
     */
    @PostMapping("/folders")
    public Result<FileInfoVO> createFolder(
            @RequestBody FolderRequest request,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        FileInfoVO folder = fileService.createFolder(request.getName(), request.getParentId(), userId);
        return Result.success(folder);
    }

    /**
     * 获取文件夹内的文件列表
     * 解决 api/folders 405 错误
     */
    @GetMapping("/folders")
    public Result<List<FileInfoVO>> getFolderContent(
            @RequestParam(required = false, defaultValue = "0") Long parentId,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        List<FileInfoVO> fileList = fileService.getFilesByFolder(parentId, userId)
                .stream()
                .filter(item -> Integer.valueOf(1).equals(item.getIsFolder()))
                .toList();

        return Result.success(fileList);
    }

    /**
     * 重命名文件夹
     */
    @PutMapping("/folders/{folderId}/rename")
    public Result<Void> renameFolder(
            @PathVariable Long folderId,
            @RequestBody java.util.Map<String, String> request,
            Authentication authentication) {
        Long userId = requireUserId(authentication);
        String newName = request.get("newName");
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("文件夹名不能为空");
        }

        fileService.renameFolder(folderId, newName.trim(), userId);
        return Result.success(null);
    }

    private Long requireUserId(Authentication authentication) {
        Long userId = extractAuthenticatedUserId(authentication);
        if (userId == null) {
            throw new AuthenticationCredentialsNotFoundException("未授权或登录已失效");
        }
        return userId;
    }

    private Long resolveShareUserId(Authentication authentication, ShareRequestDTO request) {
        Long userId = extractAuthenticatedUserId(authentication);
        if (userId != null) {
            return userId;
        }

        if (request == null || request.getFileId() == null) {
            throw new IllegalArgumentException("文件ID不能为空");
        }
        if (request.getGuestUploadToken() == null || request.getGuestUploadToken().isBlank()) {
            throw new IllegalArgumentException("缺少匿名分享凭证");
        }
        if (!jwtUtil.validateGuestUploadToken(request.getGuestUploadToken(), request.getFileId())) {
            throw new IllegalArgumentException("匿名分享凭证无效或已过期");
        }
        return GUEST_USER_ID;
    }

    private Long extractAuthenticatedUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            return null;
        }
        return userId;
    }

    private void streamOwnedFile(Long fileId,
                                 Long userId,
                                 HttpServletResponse response,
                                 boolean preview,
                                 Integer maxSize) throws IOException {
        FileInfoVO fileVO = fileService.getFileById(fileId, userId);
        String storageKey = fileVO.getFilePath();
        if (!storageService.exists(storageKey)) {
            throw new ResourceNotFoundException("文件不存在");
        }

        String contentType = fileVO.getFileType();
        if (contentType == null || contentType.isEmpty()) {
            contentType = "application/octet-stream";
        }
        if (preview && !filePreviewPolicyService.isPreviewAllowed(fileVO.getOriginalName(), contentType)) {
            throw new FeatureDisabledException("当前文件类型不允许预览");
        }

        String responseFileName = fileVO.getOriginalName();
        long contentLength = fileVO.getFileSize() == null ? storageService.getSize(storageKey) : fileVO.getFileSize();
        InputStream previewStream = null;

        if (preview && officePreviewService.supports(fileVO.getOriginalName(), contentType)) {
            // Office conversion needs local file
            fileVO.setFilePath(storageService.getLocalPath(storageKey).toString());
            PreviewResource previewResource = officePreviewService.preparePreview(fileVO);
            previewStream = new FileInputStream(previewResource.file().toFile());
            contentType = previewResource.contentType();
            responseFileName = previewResource.fileName();
            contentLength = previewResource.contentLength();
        }

        response.setContentType(contentType);
        response.setHeader("Cache-Control", "private, max-age=3600");
        response.setHeader("Content-Disposition", (preview ? "inline" : "attachment") + "; filename=\"" +
                new String(responseFileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1) + "\"");

        boolean isImage = contentType.startsWith("image/");
        if (preview && isImage && maxSize != null && maxSize > 0) {
            try {
                File localFile = storageService.getLocalPath(storageKey).toFile();
                Thumbnails.of(localFile)
                        .size(maxSize, maxSize)
                        .outputQuality(0.8f)
                        .toOutputStream(response.getOutputStream());
                return;
            } catch (Exception ignored) {
                // 压缩失败时回退到原文件流。
            }
        }

        response.setContentLengthLong(contentLength);

        try (InputStream is = previewStream != null ? previewStream : storageService.retrieve(storageKey);
             OutputStream os = response.getOutputStream()) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = is.read(buffer)) > 0) {
                os.write(buffer, 0, length);
            }
            os.flush();
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return "unknown";
        }
        return remoteAddr.trim();
    }
}
