package com.finalpre.quickshare.service;

public record StoragePolicy(
        String type,
        String s3Endpoint,
        String s3AccessKey,
        String s3SecretKey,
        String s3Bucket,
        String s3Region,
        boolean s3PathStyleAccess
) {
    public boolean isS3() {
        return "s3".equalsIgnoreCase(type);
    }

    public boolean isLocal() {
        return !isS3();
    }

    public boolean hasS3Config() {
        return s3Endpoint != null && !s3Endpoint.isBlank()
                && s3AccessKey != null && !s3AccessKey.isBlank()
                && s3SecretKey != null && !s3SecretKey.isBlank()
                && s3Bucket != null && !s3Bucket.isBlank();
    }
}
