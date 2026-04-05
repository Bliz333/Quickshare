package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class TransferSyncRequest {
    private String deviceId;
    private String deviceName;
    private String deviceType;
}
