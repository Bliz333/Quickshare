package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TransferPublicShareVO {
    private Long id;
    private String shareToken;
    private String senderLabel;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer chunkSize;
    private Integer totalChunks;
    private Integer uploadedChunks;
    private List<Integer> uploadedChunkIndexes;
    private String status;
    private boolean ready;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime expireTime;
    private LocalDateTime downloadedAt;
    private String pickupUrl;
}
