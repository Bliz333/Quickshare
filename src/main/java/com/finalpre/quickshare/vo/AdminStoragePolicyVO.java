package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminStoragePolicyVO {
    private String type;
    private String s3Endpoint;
    private String s3AccessKey;
    private boolean s3HasSecretKey;
    private String s3Bucket;
    private String s3Region;
    private boolean s3PathStyleAccess;
    private String connectionStatus;
    private String localUploadDir;
    private boolean localUploadDirExists;
    private Long localDiskTotalBytes;
    private Long localDiskUsableBytes;
    private Double localDiskUsablePercent;
    private String localDiskRiskLevel;
}
