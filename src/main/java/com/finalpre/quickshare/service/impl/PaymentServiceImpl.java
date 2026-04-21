package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.PaymentProvider;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.mapper.PaymentProviderMapper;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.service.PaymentService;
import com.finalpre.quickshare.service.QuotaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_PAID = "paid";
    private static final String STATUS_EXPIRED = "expired";
    private static final String STATUS_REFUNDED = "refunded";

    @Autowired
    private PaymentOrderMapper orderMapper;

    @Autowired
    private PlanMapper planMapper;

    @Autowired
    private PaymentProviderMapper providerMapper;

    @Autowired
    private QuotaService quotaService;

    @Override
    public String createOrder(Long userId, Long planId, Long providerId, String payType, String returnUrl, String notifyUrl) {
        PaymentProvider provider = resolveProvider(providerId);

        Plan plan = planMapper.selectById(planId);
        if (plan == null || plan.getStatus() != 1) {
            throw new ResourceNotFoundException("套餐不存在或已下架");
        }

        String normalizedPayType = normalizePayType(payType);
        if (!supportsPayType(provider, normalizedPayType)) {
            throw new IllegalArgumentException("当前支付商户不支持该支付方式");
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
        order.setStatus(STATUS_PENDING);
        order.setProviderId(provider.getId());
        order.setPayType(normalizedPayType);
        order.setCreateTime(LocalDateTime.now());
        orderMapper.insert(order);

        // Build epay redirect URL
        TreeMap<String, String> params = new TreeMap<>();
        params.put("pid", provider.getPid());
        params.put("type", normalizedPayType);
        params.put("out_trade_no", orderNo);
        params.put("notify_url", notifyUrl);
        params.put("return_url", returnUrl);
        params.put("name", plan.getName());
        params.put("money", plan.getPrice().toPlainString());

        String sign = generateSign(params, provider.getMerchantKey());
        params.put("sign", sign);
        params.put("sign_type", "MD5");

        StringBuilder url = new StringBuilder(provider.getApiUrl());
        url.append("/submit.php?");
        params.forEach((k, v) -> {
            try {
                url.append(k).append("=").append(URLEncoder.encode(v, "UTF-8")).append("&");
            } catch (UnsupportedEncodingException e) {
                url.append(k).append("=").append(v).append("&");
            }
        });

        String redirectUrl = url.substring(0, url.length() - 1);
        log.info("Payment order created. orderNo={}, provider={}, planId={}, amount={}",
                orderNo, provider.getName(), planId, plan.getPrice());
        return redirectUrl;
    }

    @Override
    @Transactional
    public boolean handleNotify(Map<String, String> params) {
        String orderNo = params.get("out_trade_no");
        if (orderNo == null || orderNo.isBlank()) {
            log.warn("Epay notify missing out_trade_no");
            return false;
        }

        PaymentOrder order = orderMapper.selectOne(
                new QueryWrapper<PaymentOrder>().eq("order_no", orderNo));
        if (order == null) {
            log.warn("Epay notify for unknown order: {}", orderNo);
            return false;
        }

        // Find the provider used for this order
        PaymentProvider provider = providerMapper.selectById(order.getProviderId());
        if (provider == null) {
            log.warn("Epay notify: provider not found for order {}", orderNo);
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
        signParams.entrySet().removeIf(e -> e.getValue() == null || e.getValue().isEmpty());

        String expectedSign = generateSign(signParams, provider.getMerchantKey());
        if (!expectedSign.equalsIgnoreCase(receivedSign)) {
            log.warn("Epay notify sign mismatch for order {}. expected={}, received={}",
                    orderNo, expectedSign, receivedSign);
            return false;
        }

        // Verify PID matches
        String notifyPid = params.get("pid");
        if (notifyPid != null && !notifyPid.equals(provider.getPid())) {
            log.warn("Epay notify PID mismatch for order {}. expected={}, received={}",
                    orderNo, provider.getPid(), notifyPid);
            return false;
        }

        String tradeStatus = params.get("trade_status");
        if (!"TRADE_SUCCESS".equals(tradeStatus)) {
            log.info("Epay notify non-success status for order {}: {}", orderNo, tradeStatus);
            return true;
        }

        // Verify amount matches
        String notifyMoney = params.get("money");
        if (notifyMoney != null) {
            try {
                java.math.BigDecimal notifyAmount = new java.math.BigDecimal(notifyMoney);
                if (notifyAmount.compareTo(order.getAmount()) != 0) {
                    log.error("SECURITY: Epay notify amount mismatch for order {}! expected={}, received={}",
                            orderNo, order.getAmount(), notifyAmount);
                    return false;
                }
            } catch (NumberFormatException e) {
                log.warn("Epay notify invalid money format for order {}: {}", orderNo, notifyMoney);
                return false;
            }
        }

        String currentStatus = normalizeOrderStatus(order.getStatus());
        if (STATUS_PAID.equals(currentStatus)) {
            log.info("Order already paid, ignoring duplicate notify. orderNo={}", orderNo);
            return true;
        }
        if (STATUS_REFUNDED.equals(currentStatus)) {
            log.warn("Ignore payment success notify for refunded order. orderNo={}", orderNo);
            return true;
        }
        if (!STATUS_PENDING.equals(currentStatus) && !STATUS_EXPIRED.equals(currentStatus)) {
            log.warn("Ignore payment success notify for order {} with unsupported status {}", orderNo, currentStatus);
            return false;
        }

        // Mark as paid
        order.setStatus(STATUS_PAID);
        order.setTradeNo(params.get("trade_no"));
        order.setNotifyTime(LocalDateTime.now());
        orderMapper.updateById(order);

        log.info("Payment confirmed. orderNo={}, tradeNo={}, amount={}, provider={}",
                orderNo, params.get("trade_no"), order.getAmount(), provider.getName());

        quotaService.grantQuota(order);

        return true;
    }

    @Override
    public PaymentOrder getOrder(String orderNo) {
        return orderMapper.selectOne(new QueryWrapper<PaymentOrder>().eq("order_no", orderNo));
    }

    private String generateSign(TreeMap<String, String> params, String merchantKey) {
        StringBuilder sb = new StringBuilder();
        params.forEach((k, v) -> {
            if (v != null && !v.isEmpty()) {
                sb.append(k).append("=").append(v).append("&");
            }
        });
        if (sb.length() > 0) sb.setLength(sb.length() - 1);
        sb.append(merchantKey);
        return DigestUtil.md5Hex(sb.toString());
    }

    private PaymentProvider resolveProvider(Long providerId) {
        PaymentProvider provider;
        if (providerId != null) {
            provider = providerMapper.selectById(providerId);
            if (provider == null || provider.getEnabled() != 1) {
                throw new ResourceNotFoundException("支付商户不存在或已禁用");
            }
            return provider;
        }

        provider = providerMapper.selectOne(new QueryWrapper<PaymentProvider>()
                .eq("enabled", 1)
                .orderByAsc("sort_order")
                .last("LIMIT 1"));
        if (provider == null) {
            throw new IllegalStateException("暂无可用支付商户，请联系管理员");
        }
        return provider;
    }

    private String normalizePayType(String payType) {
        String normalized = payType == null ? "" : payType.trim().toLowerCase(Locale.ROOT);
        return normalized.isBlank() ? "alipay" : normalized;
    }

    private boolean supportsPayType(PaymentProvider provider, String payType) {
        if (provider == null || payType == null || payType.isBlank()) {
            return false;
        }

        String configuredPayTypes = provider.getPayTypes();
        if (configuredPayTypes == null || configuredPayTypes.isBlank()) {
            return "alipay".equals(payType);
        }

        return Arrays.stream(configuredPayTypes.split(","))
                .map(value -> value == null ? "" : value.trim().toLowerCase(Locale.ROOT))
                .anyMatch(payType::equals);
    }

    private String normalizeOrderStatus(String status) {
        return status == null ? STATUS_PENDING : status.trim().toLowerCase(Locale.ROOT);
    }
}
