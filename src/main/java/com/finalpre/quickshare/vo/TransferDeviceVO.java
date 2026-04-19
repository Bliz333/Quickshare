package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TransferDeviceVO {
    private String deviceId;
    private String deviceName;
    private String deviceType;
    private boolean current;
    private boolean online;
    private LocalDateTime lastSeenAt;
}
