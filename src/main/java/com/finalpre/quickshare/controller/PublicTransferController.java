package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.TransferPublicShareCreateRequest;
import com.finalpre.quickshare.dto.TransferPairTaskSyncRequest;
import com.finalpre.quickshare.entity.TransferPublicShare;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.vo.TransferPairTaskVO;
import com.finalpre.quickshare.vo.TransferPublicShareVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.PathResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/public/transfer")
public class PublicTransferController {

    @Autowired
    private TransferService transferService;

    @Autowired
    private TransferPairingService transferPairingService;

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
}
