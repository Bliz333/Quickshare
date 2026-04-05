package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TransferPairCodeVO {
    private String code;
    private String pairSessionId;
    private String creatorLabel;
    private String creatorChannelId;
    private LocalDateTime expireTime;
}
