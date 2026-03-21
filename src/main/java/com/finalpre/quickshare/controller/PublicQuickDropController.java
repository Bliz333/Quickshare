package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.QuickDropPublicShareCreateRequest;
import com.finalpre.quickshare.dto.QuickDropPairTaskSyncRequest;
import com.finalpre.quickshare.entity.QuickDropPublicShare;
import com.finalpre.quickshare.service.QuickDropPairingService;
import com.finalpre.quickshare.service.QuickDropService;
import com.finalpre.quickshare.vo.QuickDropPairTaskVO;
import com.finalpre.quickshare.vo.QuickDropPublicShareVO;
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
@RequestMapping("/api/public/quickdrop")
public class PublicQuickDropController {

    @Autowired
    private QuickDropService quickDropService;

    @Autowired
    private QuickDropPairingService quickDropPairingService;

    @PostMapping("/shares")
    public Result<QuickDropPublicShareVO> createShare(Authentication authentication,
                                                      @RequestBody QuickDropPublicShareCreateRequest request) {
        Long uploaderUserId = authentication != null && authentication.getPrincipal() instanceof Long userId ? userId : null;
        return Result.success(quickDropService.createPublicShare(uploaderUserId, request));
    }

    @GetMapping("/shares/{shareToken}")
    public Result<QuickDropPublicShareVO> getShare(@PathVariable String shareToken) {
        return Result.success(quickDropService.getPublicShare(shareToken));
    }

    @PutMapping(value = "/shares/{shareToken}/chunks/{chunkIndex}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public Result<QuickDropPublicShareVO> uploadShareChunk(@PathVariable String shareToken,
                                                           @PathVariable Integer chunkIndex,
                                                           @RequestBody byte[] body) {
        return Result.success(quickDropService.uploadPublicShareChunk(shareToken, chunkIndex, body));
    }

    @PostMapping("/pair-tasks/direct-attempts")
    public Result<QuickDropPairTaskVO> syncPairTask(@RequestBody QuickDropPairTaskSyncRequest request) {
        return Result.success(quickDropPairingService.syncPairTask(request));
    }

    @GetMapping("/pair-tasks")
    public Result<java.util.List<QuickDropPairTaskVO>> listPairTasks(@RequestParam String pairSessionId,
                                                                     @RequestParam String selfChannelId) {
        return Result.success(quickDropPairingService.listPairTasks(pairSessionId, selfChannelId));
    }

    @DeleteMapping("/pair-tasks/{taskId}/direct-attempts/{clientTransferId}")
    public Result<Void> deletePairTaskAttempt(@PathVariable Long taskId,
                                              @PathVariable String clientTransferId,
                                              @RequestParam String pairSessionId,
                                              @RequestParam String selfChannelId) {
        quickDropPairingService.deletePairTaskAttempt(taskId, pairSessionId, selfChannelId, clientTransferId);
        return Result.success();
    }

    @GetMapping("/shares/{shareToken}/download")
    public ResponseEntity<PathResource> downloadShare(@PathVariable String shareToken) throws IOException {
        QuickDropPublicShare share = quickDropService.openPublicShareDownload(shareToken);
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
