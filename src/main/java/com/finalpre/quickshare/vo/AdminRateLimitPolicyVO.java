package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminRateLimitPolicyVO {
    private String scene;
    private boolean enabled;
    private long maxRequests;
    private long windowSeconds;
}
