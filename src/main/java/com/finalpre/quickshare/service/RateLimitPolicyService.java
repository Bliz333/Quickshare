package com.finalpre.quickshare.service;

public interface RateLimitPolicyService {

    RateLimitRule getGuestUploadRule();

    RateLimitRule getBasicUserUploadRule();

    RateLimitRule getPublicShareInfoRule();

    RateLimitRule getPublicDownloadRule();

    RateLimitRule getPublicShareExtractCodeErrorRule();
}
