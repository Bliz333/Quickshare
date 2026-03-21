package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class PublicPaymentOptionsVO {
    private Long providerId;
    private String providerName;
    private List<String> payTypes;
}
