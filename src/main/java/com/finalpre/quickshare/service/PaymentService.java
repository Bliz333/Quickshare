package com.finalpre.quickshare.service;

import com.finalpre.quickshare.entity.PaymentOrder;

import java.util.Map;

public interface PaymentService {

    /** Create order and return epay redirect URL. */
    String createOrder(Long userId, Long planId, String payType, String returnUrl);

    /** Process epay async notification. Returns true if payment confirmed. */
    boolean handleNotify(Map<String, String> params);

    /** Get order by orderNo. */
    PaymentOrder getOrder(String orderNo);
}
