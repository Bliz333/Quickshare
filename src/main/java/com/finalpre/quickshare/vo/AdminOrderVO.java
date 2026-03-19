package com.finalpre.quickshare.vo;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdminOrderVO {
    private Long id;
    private String orderNo;
    private Long userId;
    private String username;
    private Long planId;
    private String planName;
    private String planType;
    private BigDecimal amount;
    private String status;
    private String payType;
    private String tradeNo;
    private Long providerId;
    private String providerName;
    private LocalDateTime notifyTime;
    private LocalDateTime createTime;
}
