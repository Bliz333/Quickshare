package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class AdminFilePreviewPolicyVO {
    private Boolean enabled;
    private Boolean imageEnabled;
    private Boolean videoEnabled;
    private Boolean audioEnabled;
    private Boolean pdfEnabled;
    private Boolean textEnabled;
    private Boolean officeEnabled;
    private List<String> allowedExtensions;
}
