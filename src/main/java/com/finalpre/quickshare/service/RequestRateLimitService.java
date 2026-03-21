package com.finalpre.quickshare.service;

public interface RequestRateLimitService {

    void checkGuestUploadAllowed(String clientIp);

    void checkBasicUserUploadAllowed(Long userId, String clientIp);

    void checkPublicShareInfoAllowed(String clientIp);

    void checkPublicDownloadAllowed(String clientIp);

    void checkPublicShareExtractCodeFailureAllowed(String clientIp, String shareCode);

    void recordPublicShareExtractCodeFailure(String clientIp, String shareCode);

    void resetPublicShareExtractCodeFailures(String clientIp, String shareCode);
}
