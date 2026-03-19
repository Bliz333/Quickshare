package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminRateLimitPolicyUpdateRequest {
    private Boolean enabled;
    private Long maxRequests;
    private Long windowSeconds;
}
