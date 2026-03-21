package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class QuickDropPairTaskVO {
    private Long id;
    private String pairSessionId;
    private String taskKey;
    private String direction;
    private String transferMode;
    private String currentTransferMode;
    private String stage;
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
    private LocalDateTime completedAt;
    private LocalDateTime savedToNetdiskAt;
    private List<QuickDropTaskAttemptVO> attempts;
}
