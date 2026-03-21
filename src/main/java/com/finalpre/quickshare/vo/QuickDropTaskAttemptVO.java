package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class QuickDropTaskAttemptVO {
    private String transferMode;
    private String transferId;
    private String stage;
    private Integer completedChunks;
    private Integer totalChunks;
    private LocalDateTime updateTime;
}
