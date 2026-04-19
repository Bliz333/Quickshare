package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TransferRelayVO {
    private Long id;
    private Long taskId;
    private String senderDeviceId;
    private String receiverDeviceId;
    private String taskKey;
    private String direction;
    private String transferMode;
    private String peerDeviceId;
    private String peerLabel;
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
    private TransferTaskVO task;
}
