package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropPublicShareCreateRequest {
    private String senderLabel;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer chunkSize;
}
