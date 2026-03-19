package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "storage.s3")
public class S3StorageProperties {
    /** S3-compatible endpoint URL (e.g. https://s3.amazonaws.com, https://play.min.io, https://<id>.r2.cloudflarestorage.com) */
    private String endpoint = "";
    /** Access key */
    private String accessKey = "";
    /** Secret key */
    private String secretKey = "";
    /** Bucket name */
    private String bucket = "";
    /** Region (default: auto) */
    private String region = "auto";
    /** Use path-style access (required for MinIO, optional for R2) */
    private boolean pathStyleAccess = true;
}
