package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropCreateTransferRequest {
    private Long taskId;
    private String deviceId;
    private String receiverDeviceId;
    private String taskKey;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer chunkSize;
}
