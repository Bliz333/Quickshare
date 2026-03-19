package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminShareVO {
    private Long id;
    private Long fileId;
    private Long userId;
    private String username;
    private String fileName;
    private String shareCode;
    private String extractCode;
    private LocalDateTime expireTime;
    private Integer downloadCount;
    private Integer maxDownload;
    private LocalDateTime createTime;
    private Integer status;
}
