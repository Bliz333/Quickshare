package com.finalpre.quickshare.service;

public interface FileUploadPolicyService {

    FileUploadPolicy getPolicy();

    long getHardMaxFileSizeBytes();
}
