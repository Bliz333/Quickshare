package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class AdminCorsPolicyVO {
    private List<String> allowedOrigins;
    private List<String> allowedMethods;
    private List<String> allowedHeaders;
    private boolean allowCredentials;
    private long maxAgeSeconds;
}
