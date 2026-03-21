package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropPairTaskSyncRequest {
    private String pairSessionId;
    private String selfChannelId;
    private String peerChannelId;
    private String selfLabel;
    private String peerLabel;
    private String clientTransferId;
    private String taskKey;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer totalChunks;
    private Integer completedChunks;
    private String status;
    private Boolean savedToNetdisk;
    private Boolean downloaded;
}
