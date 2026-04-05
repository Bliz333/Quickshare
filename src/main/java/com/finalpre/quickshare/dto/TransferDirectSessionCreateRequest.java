package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class TransferDirectSessionCreateRequest {
    private String deviceId;
    private String targetDeviceId;
}
