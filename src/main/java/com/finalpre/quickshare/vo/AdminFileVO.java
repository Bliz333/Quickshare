package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AdminFileVO {
    private Long id;
    private Long userId;
    private String username;
    private String originalName;
    private String fileType;
    private Long fileSize;
    private Integer isFolder;
    private Long parentId;
    private LocalDateTime uploadTime;
}
