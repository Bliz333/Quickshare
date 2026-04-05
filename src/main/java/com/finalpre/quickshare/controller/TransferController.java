package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.TransferCreateRequest;
import com.finalpre.quickshare.dto.TransferDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.TransferSaveRequest;
import com.finalpre.quickshare.dto.TransferSyncRequest;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.vo.FileInfoVO;
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
import java.nio.file.Path;

@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    @Autowired
    private TransferService transferService;

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
}
