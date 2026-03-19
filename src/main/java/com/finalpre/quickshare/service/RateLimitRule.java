package com.finalpre.quickshare.service;

public record RateLimitRule(boolean enabled, long maxRequests, long windowSeconds) {
}
