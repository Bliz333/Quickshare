package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminStoragePolicyUpdateRequest {
    private String type;
    private String s3Endpoint;
    private String s3AccessKey;
    /** null = keep existing secret key */
    private String s3SecretKey;
    private String s3Bucket;
    private String s3Region;
    private Boolean s3PathStyleAccess;
}
