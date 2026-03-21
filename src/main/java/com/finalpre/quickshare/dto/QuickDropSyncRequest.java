package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropSyncRequest {
    private String deviceId;
    private String deviceName;
    private String deviceType;
}
