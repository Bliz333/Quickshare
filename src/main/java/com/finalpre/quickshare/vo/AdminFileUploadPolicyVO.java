package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class AdminFileUploadPolicyVO {
    private Boolean guestUploadEnabled;
    private Long maxFileSizeBytes;
    private Long hardMaxFileSizeBytes;
    private List<String> allowedExtensions;
}
