package com.finalpre.quickshare.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ShareLinkVO {
    private String shareCode;
    private String shareUrl;
    private String extractCode;
    private LocalDateTime expireTime;
    private Integer maxDownload;
    private String fileName;
    private String fileType;
}