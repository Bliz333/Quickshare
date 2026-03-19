package com.finalpre.quickshare.service;

public record EpayPolicy(
        boolean enabled,
        String apiUrl,
        String pid,
        String key,
        /** Comma-separated: alipay,wxpay,qqpay */
        String payTypes
) {
    public boolean isConfigured() {
        return apiUrl != null && !apiUrl.isBlank()
                && pid != null && !pid.isBlank()
                && key != null && !key.isBlank();
    }
}
