package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminEpayPolicyVO {
    private boolean enabled;
    private String apiUrl;
    private String pid;
    private boolean hasKey;
    private String payTypes;
}
