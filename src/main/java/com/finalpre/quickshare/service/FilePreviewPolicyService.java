package com.finalpre.quickshare.service;

public interface FilePreviewPolicyService {

    FilePreviewPolicy getPolicy();

    boolean isPreviewAllowed(String fileName, String contentType);
}
