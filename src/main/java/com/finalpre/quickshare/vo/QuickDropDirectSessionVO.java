package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class QuickDropDirectSessionVO {
    private String pairSessionId;
    private String selfChannelId;
    private String selfDeviceId;
    private String peerChannelId;
    private String peerDeviceId;
    private String peerLabel;
}
