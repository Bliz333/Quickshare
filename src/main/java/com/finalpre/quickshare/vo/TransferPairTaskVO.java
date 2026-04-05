package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TransferPairTaskVO {
    private Long id;
    private String pairSessionId;
    private String taskKey;
    private String direction;
    private String transferMode;
    private String currentTransferMode;
    private String stage;
    private String attemptStatus;
    private String startReason;
    private String endReason;
    private String failureReason;
    private String selfChannelId;
    private String peerChannelId;
    private String selfLabel;
    private String peerLabel;
    private String fileName;
    private Long fileSize;
    private String contentType;
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
    private List<TransferTaskAttemptVO> attempts;
}
