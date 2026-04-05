package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.dto.TransferCreateRequest;
import com.finalpre.quickshare.dto.TransferDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.TransferSaveRequest;
import com.finalpre.quickshare.dto.TransferSyncRequest;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.FilePreviewPolicyVO;
import com.finalpre.quickshare.vo.TransferSyncVO;
import com.finalpre.quickshare.vo.TransferTaskVO;
import com.finalpre.quickshare.vo.TransferRelayVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.PathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import net.coobird.thumbnailator.Thumbnails;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    @Autowired
    private TransferService transferService;

    @Autowired
    private FilePreviewPolicyService filePreviewPolicyService;

    @Autowired
    private OfficePreviewService officePreviewService;

    @PostMapping("/sync")
    public Result<TransferSyncVO> syncDevice(Authentication authentication,
                                              @RequestBody TransferSyncRequest request) {
        return Result.success(transferService.syncDevice(requireUserId(authentication), request));
    }

    @PostMapping("/transfers")
    public Result<TransferRelayVO> createTransfer(Authentication authentication,
                                                      @RequestBody TransferCreateRequest request) {
        return Result.success(transferService.createTransfer(requireUserId(authentication), request));
    }

    @GetMapping("/transfers/{transferId}")
    public Result<TransferRelayVO> getTransfer(Authentication authentication,
                                                   @PathVariable Long transferId,
                                                   @RequestParam String deviceId) {
        return Result.success(transferService.getTransfer(requireUserId(authentication), transferId, deviceId));
    }

    @PutMapping(value = "/transfers/{transferId}/chunks/{chunkIndex}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public Result<TransferRelayVO> uploadChunk(Authentication authentication,
                                                   @PathVariable Long transferId,
                                                   @PathVariable Integer chunkIndex,
                                                   @RequestParam String deviceId,
                                                   @RequestBody byte[] body) {
        return Result.success(transferService.uploadChunk(requireUserId(authentication), transferId, deviceId, chunkIndex, body));
    }

    @PostMapping("/tasks/direct-attempts")
    public Result<TransferTaskVO> syncDirectAttempt(Authentication authentication,
                                                     @RequestBody TransferDirectAttemptSyncRequest request) {
        return Result.success(transferService.syncDirectAttempt(requireUserId(authentication), request));
    }

    @GetMapping("/transfers/{transferId}/download")
    public ResponseEntity<PathResource> downloadTransfer(Authentication authentication,
                                                         @PathVariable Long transferId,
                                                         @RequestParam String deviceId) throws IOException {
        TransferRelay transfer = transferService.openDownload(requireUserId(authentication), transferId, deviceId);
        PathResource resource = new PathResource(Path.of(transfer.getAssembledPath()));

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (transfer.getContentType() != null && !transfer.getContentType().isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(transfer.getContentType());
            } catch (IllegalArgumentException ignored) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(transfer.getFileName())
                        .build()
                        .toString())
                .contentLength(resource.contentLength())
                .body(resource);
    }

    @GetMapping("/transfers/{transferId}/preview")
    public void previewTransfer(Authentication authentication,
                                @PathVariable Long transferId,
                                @RequestParam String deviceId,
                                @RequestParam(value = "max_size", required = false) Integer maxSize,
                                jakarta.servlet.http.HttpServletResponse response) throws IOException {
        TransferRelay transfer = transferService.openPreview(requireUserId(authentication), transferId, deviceId);
        streamTransferPreview(transfer, response, maxSize);
    }

    @PostMapping("/transfers/{transferId}/save")
    public Result<FileInfoVO> saveTransfer(Authentication authentication,
                                           @PathVariable Long transferId,
                                           @RequestBody(required = false) TransferSaveRequest request) {
        String deviceId = request == null ? null : request.getDeviceId();
        Long folderId = request == null ? null : request.getFolderId();
        return Result.success(transferService.saveTransferToNetdisk(requireUserId(authentication), transferId, deviceId, folderId));
    }

    @PostMapping("/public-shares/{shareToken}/save")
    public Result<FileInfoVO> savePublicShare(Authentication authentication,
                                              @PathVariable String shareToken,
                                              @RequestBody(required = false) TransferSaveRequest request) {
        Long folderId = request == null ? null : request.getFolderId();
        return Result.success(transferService.savePublicShareToNetdisk(requireUserId(authentication), shareToken, folderId));
    }

    @DeleteMapping("/transfers/{transferId}")
    public Result<Void> deleteTransfer(Authentication authentication,
                                       @PathVariable Long transferId,
                                       @RequestParam String deviceId) {
        transferService.deleteTransfer(requireUserId(authentication), transferId, deviceId);
        return Result.success();
    }

    @DeleteMapping("/tasks/{taskId}")
    public Result<Void> deleteTask(Authentication authentication,
                                   @PathVariable Long taskId,
                                   @RequestParam String deviceId) {
        transferService.deleteTask(requireUserId(authentication), taskId, deviceId);
        return Result.success();
    }

    @DeleteMapping("/tasks/{taskId}/direct-attempts/{clientTransferId}")
    public Result<Void> deleteDirectAttempt(Authentication authentication,
                                            @PathVariable Long taskId,
                                            @PathVariable String clientTransferId,
                                            @RequestParam String deviceId) {
        transferService.deleteDirectAttempt(requireUserId(authentication), taskId, deviceId, clientTransferId);
        return Result.success();
    }

    private Long requireUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AccessDeniedException("请先登录");
        }
        return userId;
    }

    private void streamTransferPreview(TransferRelay transfer,
                                       jakarta.servlet.http.HttpServletResponse response,
                                       Integer maxSize) throws IOException {
        String fileName = transfer.getFileName();
        String contentType = transfer.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        if (!filePreviewPolicyService.isPreviewAllowed(fileName, contentType)) {
            throw new FeatureDisabledException("当前文件类型不允许预览");
        }

        Path assembledPath = Path.of(transfer.getAssembledPath());
        long contentLength = transfer.getFileSize() == null ? java.nio.file.Files.size(assembledPath) : transfer.getFileSize();
        String responseFileName = fileName;
        InputStream previewStream = null;

        if (officePreviewService.supports(fileName, contentType)) {
            FileInfoVO fileInfo = new FileInfoVO();
            fileInfo.setOriginalName(fileName);
            fileInfo.setFileType(contentType);
            fileInfo.setFilePath(assembledPath.toString());
            fileInfo.setFileSize(contentLength);
            PreviewResource previewResource = officePreviewService.preparePreview(fileInfo);
            previewStream = new FileInputStream(previewResource.file().toFile());
            contentType = previewResource.contentType();
            responseFileName = previewResource.fileName();
            contentLength = previewResource.contentLength();
        }

        response.setContentType(contentType);
        response.setHeader("Cache-Control", "private, max-age=300");
        response.setHeader("Content-Disposition", "inline; filename=\"" +
                new String(responseFileName.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1) + "\"");

        boolean isImage = contentType.startsWith("image/");
        if (isImage && maxSize != null && maxSize > 0) {
            try {
                File localFile = assembledPath.toFile();
                Thumbnails.of(localFile)
                        .size(maxSize, maxSize)
                        .outputQuality(0.8f)
                        .toOutputStream(response.getOutputStream());
                return;
            } catch (Exception ignored) {
                // fall back to the original file stream
            }
        }

        response.setContentLengthLong(contentLength);
        try (InputStream is = previewStream != null ? previewStream : new FileInputStream(assembledPath.toFile());
             OutputStream os = response.getOutputStream()) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = is.read(buffer)) > 0) {
                os.write(buffer, 0, length);
            }
            os.flush();
        }
    }
}
