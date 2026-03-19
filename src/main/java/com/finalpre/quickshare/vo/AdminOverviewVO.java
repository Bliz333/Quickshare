package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminOverviewVO {
    private Long userCount;
    private Long fileCount;
    private Long folderCount;
    private Long shareCount;
    private Long activeShareCount;
    private Long totalStorageBytes;
}
