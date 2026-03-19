package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminEpayPolicyUpdateRequest {
    private Boolean enabled;
    private String apiUrl;
    private String pid;
    /** null = keep existing key */
    private String key;
    private String payTypes;
}
