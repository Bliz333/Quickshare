package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class TransferSaveRequest {
    private String deviceId;
    private Long folderId;
}
