package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class ShareRequestDTO {
    private Long fileId;
    private String extractCode;  // 提取码,可选
    private Integer expireHours;  // 过期时间(小时),null表示永久
    private Integer maxDownload;  // 最大下载次数,-1表示不限制
}