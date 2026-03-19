package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminPaymentProviderRequest {
    private String name;
    private String apiUrl;
    private String pid;
    /** null = keep existing key on update */
    private String merchantKey;
    private String payTypes;
    private Integer enabled;
    private Integer sortOrder;
}
