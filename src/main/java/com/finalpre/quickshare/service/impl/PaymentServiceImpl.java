package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.service.EpayPolicy;
import com.finalpre.quickshare.service.PaymentService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.TreeMap;

@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    @Autowired
    private PaymentOrderMapper orderMapper;

    @Autowired
    private PlanMapper planMapper;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public String createOrder(Long userId, Long planId, String payType, String returnUrl) {
        EpayPolicy epay = getEpayConfig();
        if (!epay.isConfigured()) {
            throw new IllegalStateException("支付未配置，请联系管理员");
        }

        Plan plan = planMapper.selectById(planId);
        if (plan == null || plan.getStatus() != 1) {
            throw new ResourceNotFoundException("套餐不存在或已下架");
        }

        // Create order
        String orderNo = "QS" + System.currentTimeMillis() + IdUtil.fastSimpleUUID().substring(0, 6);
        PaymentOrder order = new PaymentOrder();
        order.setOrderNo(orderNo);
        order.setUserId(userId);
        order.setPlanId(planId);
        order.setPlanName(plan.getName());
        order.setPlanType(plan.getType());
        order.setPlanValue(plan.getValue());
        order.setAmount(plan.getPrice());
        order.setStatus("pending");
        order.setPayType(payType);
        order.setCreateTime(LocalDateTime.now());
        orderMapper.insert(order);

        // Build epay redirect URL
        String notifyUrl = returnUrl.replaceAll("/[^/]*$", "/api/payment/notify");
        // Ensure notify_url is absolute
        if (!notifyUrl.startsWith("http")) {
            notifyUrl = returnUrl.substring(0, returnUrl.indexOf("/", 8)) + "/api/payment/notify";
        }

        TreeMap<String, String> params = new TreeMap<>();
        params.put("pid", epay.pid());
        params.put("type", payType);
        params.put("out_trade_no", orderNo);
        params.put("notify_url", notifyUrl);
        params.put("return_url", returnUrl);
        params.put("name", plan.getName());
        params.put("money", plan.getPrice().toPlainString());

        String sign = generateSign(params, epay.key());
        params.put("sign", sign);
        params.put("sign_type", "MD5");

        StringBuilder url = new StringBuilder(epay.apiUrl().replaceAll("/$", ""));
        url.append("/submit.php?");
        params.forEach((k, v) -> {
            try {
                url.append(k).append("=").append(URLEncoder.encode(v, "UTF-8")).append("&");
            } catch (UnsupportedEncodingException e) {
                url.append(k).append("=").append(v).append("&");
            }
        });

        String redirectUrl = url.substring(0, url.length() - 1);
        log.info("Payment order created. orderNo={}, planId={}, amount={}, redirectUrl={}",
                orderNo, planId, plan.getPrice(), redirectUrl);
        return redirectUrl;
    }

    @Override
    public boolean handleNotify(Map<String, String> params) {
        EpayPolicy epay = getEpayConfig();
        if (!epay.isConfigured()) {
            log.warn("Epay notify received but payment not configured");
            return false;
        }

        // Verify sign
        String receivedSign = params.get("sign");
        if (receivedSign == null) {
            log.warn("Epay notify missing sign");
            return false;
        }

        TreeMap<String, String> signParams = new TreeMap<>(params);
        signParams.remove("sign");
        signParams.remove("sign_type");
        // Remove empty values
        signParams.entrySet().removeIf(e -> e.getValue() == null || e.getValue().isEmpty());

        String expectedSign = generateSign(signParams, epay.key());
        if (!expectedSign.equalsIgnoreCase(receivedSign)) {
            log.warn("Epay notify sign mismatch. expected={}, received={}", expectedSign, receivedSign);
            return false;
        }

        String tradeStatus = params.get("trade_status");
        if (!"TRADE_SUCCESS".equals(tradeStatus)) {
            log.info("Epay notify non-success status: {}", tradeStatus);
            return true; // Valid notification but not success
        }

        String orderNo = params.get("out_trade_no");
        String tradeNo = params.get("trade_no");

        PaymentOrder order = orderMapper.selectOne(
                new QueryWrapper<PaymentOrder>().eq("order_no", orderNo));
        if (order == null) {
            log.warn("Epay notify for unknown order: {}", orderNo);
            return false;
        }

        if ("paid".equals(order.getStatus())) {
            log.info("Order already paid, ignoring duplicate notify. orderNo={}", orderNo);
            return true;
        }

        // Mark as paid
        order.setStatus("paid");
        order.setTradeNo(tradeNo);
        order.setNotifyTime(LocalDateTime.now());
        orderMapper.updateById(order);

        log.info("Payment confirmed. orderNo={}, tradeNo={}, amount={}", orderNo, tradeNo, order.getAmount());

        // TODO: Grant user quota (will be implemented in next step)

        return true;
    }

    @Override
    public PaymentOrder getOrder(String orderNo) {
        return orderMapper.selectOne(new QueryWrapper<PaymentOrder>().eq("order_no", orderNo));
    }

    /**
     * Epay MD5 sign: sort params by key, join as key=value&, append merchant key, md5.
     */
    private String generateSign(TreeMap<String, String> params, String merchantKey) {
        StringBuilder sb = new StringBuilder();
        params.forEach((k, v) -> {
            if (v != null && !v.isEmpty()) {
                sb.append(k).append("=").append(v).append("&");
            }
        });
        // Remove trailing &, append merchant key
        if (sb.length() > 0) sb.setLength(sb.length() - 1);
        sb.append(merchantKey);
        return DigestUtil.md5Hex(sb.toString());
    }

    private EpayPolicy getEpayConfig() {
        var override = systemSettingOverrideService.getEpayPolicy();
        if (override != null && override.isPresent()) {
            return override.get();
        }
        return new EpayPolicy(false, "", "", "", "alipay,wxpay");
    }
}
