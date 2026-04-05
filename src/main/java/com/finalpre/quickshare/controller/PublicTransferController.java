package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.dto.TransferPublicShareCreateRequest;
import com.finalpre.quickshare.dto.TransferPairTaskSyncRequest;
import com.finalpre.quickshare.entity.TransferPublicShare;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.TransferPairTaskVO;
import com.finalpre.quickshare.vo.TransferPublicShareVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.PathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping({"/api/public/transfer", "/api/public/quickdrop"})
public class PublicTransferController {

    @Autowired
    private TransferService transferService;

    @Autowired
    private TransferPairingService transferPairingService;

    @Autowired
    private FilePreviewPolicyService filePreviewPolicyService;

    @Autowired
    private OfficePreviewService officePreviewService;

    @PostMapping("/shares")
    public Result<TransferPublicShareVO> createShare(Authentication authentication,
                                                      @RequestBody TransferPublicShareCreateRequest request) {
        Long uploaderUserId = authentication != null && authentication.getPrincipal() instanceof Long userId ? userId : null;
        return Result.success(transferService.createPublicShare(uploaderUserId, request));
    }

    @GetMapping("/shares/{shareToken}")
    public Result<TransferPublicShareVO> getShare(@PathVariable String shareToken) {
        return Result.success(transferService.getPublicShare(shareToken));
    }

    @PutMapping(value = "/shares/{shareToken}/chunks/{chunkIndex}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public Result<TransferPublicShareVO> uploadShareChunk(@PathVariable String shareToken,
                                                           @PathVariable Integer chunkIndex,
                                                           @RequestBody byte[] body) {
        return Result.success(transferService.uploadPublicShareChunk(shareToken, chunkIndex, body));
    }

    @PostMapping("/pair-tasks/direct-attempts")
    public Result<TransferPairTaskVO> syncPairTask(@RequestBody TransferPairTaskSyncRequest request) {
        return Result.success(transferPairingService.syncPairTask(request));
    }

    @GetMapping("/pair-tasks")
    public Result<java.util.List<TransferPairTaskVO>> listPairTasks(@RequestParam String pairSessionId,
                                                                     @RequestParam String selfChannelId) {
        return Result.success(transferPairingService.listPairTasks(pairSessionId, selfChannelId));
    }

    @DeleteMapping("/pair-tasks/{taskId}/direct-attempts/{clientTransferId}")
    public Result<Void> deletePairTaskAttempt(@PathVariable Long taskId,
                                              @PathVariable String clientTransferId,
                                              @RequestParam String pairSessionId,
                                              @RequestParam String selfChannelId) {
        transferPairingService.deletePairTaskAttempt(taskId, pairSessionId, selfChannelId, clientTransferId);
        return Result.success();
    }

    @GetMapping("/shares/{shareToken}/download")
    public ResponseEntity<PathResource> downloadShare(@PathVariable String shareToken) throws IOException {
        TransferPublicShare share = transferService.openPublicShareDownload(shareToken);
        PathResource resource = new PathResource(Path.of(share.getAssembledPath()));

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (share.getContentType() != null && !share.getContentType().isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(share.getContentType());
            } catch (IllegalArgumentException ignored) {
                mediaType = MediaType.APPLICATION_OCTET_STREAM;
            }
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(share.getFileName())
                        .build()
                        .toString())
                .contentLength(resource.contentLength())
                .body(resource);
    }

    @GetMapping("/shares/{shareToken}/preview")
    public void previewShare(@PathVariable String shareToken,
                             @RequestParam(value = "max_size", required = false) Integer maxSize,
                             jakarta.servlet.http.HttpServletResponse response) throws IOException {
        TransferPublicShare share = transferService.openPublicSharePreview(shareToken);
        streamPublicSharePreview(share, response, maxSize);
    }

    private void streamPublicSharePreview(TransferPublicShare share,
                                          jakarta.servlet.http.HttpServletResponse response,
                                          Integer maxSize) throws IOException {
        String fileName = share.getFileName();
        String contentType = share.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        if (!filePreviewPolicyService.isPreviewAllowed(fileName, contentType)) {
            throw new FeatureDisabledException("当前文件类型不允许预览");
        }

        Path assembledPath = Path.of(share.getAssembledPath());
        long contentLength = share.getFileSize() == null ? java.nio.file.Files.size(assembledPath) : share.getFileSize();
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
