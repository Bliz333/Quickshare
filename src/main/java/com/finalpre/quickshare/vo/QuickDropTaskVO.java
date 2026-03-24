package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class QuickDropTaskVO {
    private Long id;
    private String taskKey;
    private String direction;
    private String transferMode;
    private String currentTransferMode;
    private String stage;
    private String attemptStatus;
    private String startReason;
    private String endReason;
    private String failureReason;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private String senderDeviceId;
    private String receiverDeviceId;
    private String peerDeviceId;
    private String peerLabel;
    private Integer completedChunks;
    private Integer totalChunks;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime expireTime;
    private LocalDateTime startTime;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;
    private LocalDateTime fallbackAt;
    private LocalDateTime savedToNetdiskAt;
    private List<QuickDropTaskAttemptVO> attempts;
}
