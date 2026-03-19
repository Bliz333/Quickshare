package com.finalpre.quickshare.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminFileUploadPolicyUpdateRequest {
    private Boolean guestUploadEnabled;
    private Long maxFileSizeBytes;
    private List<String> allowedExtensions;
}
