package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropDirectSessionCreateRequest {
    private String deviceId;
    private String targetDeviceId;
}
