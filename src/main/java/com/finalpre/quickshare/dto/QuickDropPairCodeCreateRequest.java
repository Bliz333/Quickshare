package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class QuickDropPairCodeCreateRequest {
    private String deviceId;
    private String guestId;
    private String deviceName;
    private String deviceType;
}
