package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class QuickDropTaskAttemptVO {
    private String transferMode;
    private String transferId;
    private String stage;
    private String attemptStatus;
    private String startReason;
    private String endReason;
    private String failureReason;
    private Integer completedChunks;
    private Integer totalChunks;
    private LocalDateTime startTime;
    private LocalDateTime updateTime;
    private LocalDateTime completedAt;
    private LocalDateTime failedAt;
    private LocalDateTime fallbackAt;
    private LocalDateTime savedToNetdiskAt;
    private LocalDateTime downloadedAt;
}
