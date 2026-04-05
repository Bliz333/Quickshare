package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class TransferDirectAttemptSyncRequest {
    private Long taskId;
    private String taskKey;
    private String deviceId;
    private String senderDeviceId;
    private String receiverDeviceId;
    private String clientTransferId;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer totalChunks;
    private Integer completedChunks;
    private String status;
    private String startReason;
    private String endReason;
    private String failureReason;
    private Boolean savedToNetdisk;
    private Boolean downloaded;
}
