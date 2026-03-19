package com.finalpre.quickshare.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminCorsPolicyUpdateRequest {
    private List<String> allowedOrigins;
    private List<String> allowedMethods;
    private List<String> allowedHeaders;
    private Boolean allowCredentials;
    private Long maxAgeSeconds;
}
