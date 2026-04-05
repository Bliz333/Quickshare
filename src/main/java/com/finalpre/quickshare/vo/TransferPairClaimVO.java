package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TransferPairClaimVO {
    private String code;
    private String pairSessionId;
    private String selfChannelId;
    private String selfDeviceId;
    private String peerChannelId;
    private String peerDeviceId;
    private String peerLabel;
    private LocalDateTime expireTime;
}
