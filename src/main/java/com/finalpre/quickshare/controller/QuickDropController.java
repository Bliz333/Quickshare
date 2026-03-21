package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.QuickDropCreateTransferRequest;
import com.finalpre.quickshare.dto.QuickDropDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.QuickDropSaveRequest;
import com.finalpre.quickshare.dto.QuickDropSyncRequest;
import com.finalpre.quickshare.entity.QuickDropTransfer;
import com.finalpre.quickshare.service.QuickDropService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.QuickDropSyncVO;
import com.finalpre.quickshare.vo.QuickDropTaskVO;
import com.finalpre.quickshare.vo.QuickDropTransferVO;
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
@RequestMapping("/api/quickdrop")
public class QuickDropController {

    @Autowired
    private QuickDropService quickDropService;

    @PostMapping("/sync")
    public Result<QuickDropSyncVO> syncDevice(Authentication authentication,
                                              @RequestBody QuickDropSyncRequest request) {
        return Result.success(quickDropService.syncDevice(requireUserId(authentication), request));
    }

    @PostMapping("/transfers")
    public Result<QuickDropTransferVO> createTransfer(Authentication authentication,
                                                      @RequestBody QuickDropCreateTransferRequest request) {
        return Result.success(quickDropService.createTransfer(requireUserId(authentication), request));
    }

    @GetMapping("/transfers/{transferId}")
    public Result<QuickDropTransferVO> getTransfer(Authentication authentication,
                                                   @PathVariable Long transferId,
                                                   @RequestParam String deviceId) {
        return Result.success(quickDropService.getTransfer(requireUserId(authentication), transferId, deviceId));
    }

    @PutMapping(value = "/transfers/{transferId}/chunks/{chunkIndex}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public Result<QuickDropTransferVO> uploadChunk(Authentication authentication,
                                                   @PathVariable Long transferId,
                                                   @PathVariable Integer chunkIndex,
                                                   @RequestParam String deviceId,
                                                   @RequestBody byte[] body) {
        return Result.success(quickDropService.uploadChunk(requireUserId(authentication), transferId, deviceId, chunkIndex, body));
    }

    @PostMapping("/tasks/direct-attempts")
    public Result<QuickDropTaskVO> syncDirectAttempt(Authentication authentication,
                                                     @RequestBody QuickDropDirectAttemptSyncRequest request) {
        return Result.success(quickDropService.syncDirectAttempt(requireUserId(authentication), request));
    }

    @GetMapping("/transfers/{transferId}/download")
    public ResponseEntity<PathResource> downloadTransfer(Authentication authentication,
                                                         @PathVariable Long transferId,
                                                         @RequestParam String deviceId) throws IOException {
        QuickDropTransfer transfer = quickDropService.openDownload(requireUserId(authentication), transferId, deviceId);
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
                                           @RequestBody(required = false) QuickDropSaveRequest request) {
        String deviceId = request == null ? null : request.getDeviceId();
        Long folderId = request == null ? null : request.getFolderId();
        return Result.success(quickDropService.saveTransferToNetdisk(requireUserId(authentication), transferId, deviceId, folderId));
    }

    @PostMapping("/public-shares/{shareToken}/save")
    public Result<FileInfoVO> savePublicShare(Authentication authentication,
                                              @PathVariable String shareToken,
                                              @RequestBody(required = false) QuickDropSaveRequest request) {
        Long folderId = request == null ? null : request.getFolderId();
        return Result.success(quickDropService.savePublicShareToNetdisk(requireUserId(authentication), shareToken, folderId));
    }

    @DeleteMapping("/transfers/{transferId}")
    public Result<Void> deleteTransfer(Authentication authentication,
                                       @PathVariable Long transferId,
                                       @RequestParam String deviceId) {
        quickDropService.deleteTransfer(requireUserId(authentication), transferId, deviceId);
        return Result.success();
    }

    @DeleteMapping("/tasks/{taskId}")
    public Result<Void> deleteTask(Authentication authentication,
                                   @PathVariable Long taskId,
                                   @RequestParam String deviceId) {
        quickDropService.deleteTask(requireUserId(authentication), taskId, deviceId);
        return Result.success();
    }

    @DeleteMapping("/tasks/{taskId}/direct-attempts/{clientTransferId}")
    public Result<Void> deleteDirectAttempt(Authentication authentication,
                                            @PathVariable Long taskId,
                                            @PathVariable String clientTransferId,
                                            @RequestParam String deviceId) {
        quickDropService.deleteDirectAttempt(requireUserId(authentication), taskId, deviceId, clientTransferId);
        return Result.success();
    }

    private Long requireUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AccessDeniedException("请先登录");
        }
        return userId;
    }
}
