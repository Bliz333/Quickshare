package com.finalpre.quickshare.service;

public interface RateLimitPolicyService {

    RateLimitRule getGuestUploadRule();

    RateLimitRule getPublicShareInfoRule();

    RateLimitRule getPublicDownloadRule();

    RateLimitRule getPublicShareExtractCodeErrorRule();
}
