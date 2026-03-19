package com.finalpre.quickshare.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminFilePreviewPolicyUpdateRequest {
    private Boolean enabled;
    private Boolean imageEnabled;
    private Boolean videoEnabled;
    private Boolean audioEnabled;
    private Boolean pdfEnabled;
    private Boolean textEnabled;
    private Boolean officeEnabled;
    private List<String> allowedExtensions;
}
