package com.finalpre.quickshare.service.impl;

import cn.hutool.crypto.digest.DigestUtil;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.PaymentProvider;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.mapper.PaymentProviderMapper;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.service.QuotaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private PaymentOrderMapper orderMapper;

    @Mock
    private PlanMapper planMapper;

    @Mock
    private PaymentProviderMapper providerMapper;

    @Mock
    private QuotaService quotaService;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    @Test
    void createOrderShouldRejectUnsupportedPayTypeForProvider() {
        PaymentProvider provider = buildProvider();
        provider.setPayTypes("alipay,wxpay");

        Plan plan = new Plan();
        plan.setId(8L);
        plan.setName("VIP Monthly");
        plan.setStatus(1);
        plan.setPrice(new BigDecimal("19.99"));
        plan.setType("vip");
        plan.setValue(30L);

        when(providerMapper.selectOne(any())).thenReturn(provider);
        when(planMapper.selectById(8L)).thenReturn(plan);

        assertThatThrownBy(() -> paymentService.createOrder(
                7L,
                8L,
                null,
                "qqpay",
                "https://quickshare.example/payment-result.html",
                "https://quickshare.example/api/payment/notify"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("当前支付商户不支持该支付方式");

        verify(orderMapper, never()).insert(any(PaymentOrder.class));
    }

    @Test
    void createOrderShouldKeepReturnUrlAndNotifyUrlSeparate() {
        PaymentProvider provider = buildProvider();
        provider.setPayTypes("alipay,wxpay");

        Plan plan = new Plan();
        plan.setId(8L);
        plan.setName("VIP Monthly");
        plan.setStatus(1);
        plan.setPrice(new BigDecimal("19.99"));
        plan.setType("vip");
        plan.setValue(30L);

        when(providerMapper.selectOne(any())).thenReturn(provider);
        when(planMapper.selectById(8L)).thenReturn(plan);

        String redirectUrl = paymentService.createOrder(
                7L,
                8L,
                null,
                "alipay",
                "quicksharemobile://payment-result",
                "https://quickshare.example/api/payment/notify");

        assertThat(redirectUrl)
                .contains("return_url=quicksharemobile%3A%2F%2Fpayment-result")
                .contains("notify_url=https%3A%2F%2Fquickshare.example%2Fapi%2Fpayment%2Fnotify");
    }

    @Test
    void handleNotifyShouldPromoteExpiredOrderToPaidAndGrantQuota() {
        PaymentOrder order = buildOrder("expired");
        PaymentProvider provider = buildProvider();

        Map<String, String> params = buildNotifyParams(order.getOrderNo(), provider, "TRADE-1", "9.99");

        when(orderMapper.selectOne(any())).thenReturn(order);
        when(providerMapper.selectById(3L)).thenReturn(provider);

        boolean result = paymentService.handleNotify(params);

        assertThat(result).isTrue();

        ArgumentCaptor<PaymentOrder> captor = ArgumentCaptor.forClass(PaymentOrder.class);
        verify(orderMapper).updateById(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("paid");
        assertThat(captor.getValue().getTradeNo()).isEqualTo("TRADE-1");
        verify(quotaService).grantQuota(order);
    }

    @Test
    void handleNotifyShouldIgnoreRefundedOrderWithoutGrantingQuota() {
        PaymentOrder order = buildOrder("refunded");
        PaymentProvider provider = buildProvider();

        Map<String, String> params = buildNotifyParams(order.getOrderNo(), provider, "TRADE-1", "9.99");

        when(orderMapper.selectOne(any())).thenReturn(order);
        when(providerMapper.selectById(3L)).thenReturn(provider);

        boolean result = paymentService.handleNotify(params);

        assertThat(result).isTrue();
        verify(orderMapper, never()).updateById(any(PaymentOrder.class));
        verify(quotaService, never()).grantQuota(any());
    }

    @Test
    void handleNotifyShouldRejectAmountMismatch() {
        PaymentOrder order = buildOrder("pending");
        PaymentProvider provider = buildProvider();

        Map<String, String> params = buildNotifyParams(order.getOrderNo(), provider, "TRADE-1", "19.99");

        when(orderMapper.selectOne(any())).thenReturn(order);
        when(providerMapper.selectById(3L)).thenReturn(provider);

        boolean result = paymentService.handleNotify(params);

        assertThat(result).isFalse();
        verify(orderMapper, never()).updateById(any(PaymentOrder.class));
        verify(quotaService, never()).grantQuota(any());
    }

    private PaymentOrder buildOrder(String status) {
        PaymentOrder order = new PaymentOrder();
        order.setId(2L);
        order.setOrderNo("QS123");
        order.setUserId(9L);
        order.setProviderId(3L);
        order.setAmount(new BigDecimal("9.99"));
        order.setStatus(status);
        order.setPlanType("storage");
        order.setPlanValue(1024L);
        order.setCreateTime(LocalDateTime.now());
        return order;
    }

    private PaymentProvider buildProvider() {
        PaymentProvider provider = new PaymentProvider();
        provider.setId(3L);
        provider.setPid("10001");
        provider.setMerchantKey("secret");
        provider.setName("Primary");
        provider.setApiUrl("https://pay.example.com");
        provider.setEnabled(1);
        return provider;
    }

    private Map<String, String> buildNotifyParams(String orderNo, PaymentProvider provider, String tradeNo, String money) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("out_trade_no", orderNo);
        params.put("pid", provider.getPid());
        params.put("trade_status", "TRADE_SUCCESS");
        params.put("trade_no", tradeNo);
        params.put("money", money);
        params.put("sign_type", "MD5");
        params.put("sign", generateSign(params, provider.getMerchantKey()));
        return params;
    }

    private String generateSign(Map<String, String> params, String merchantKey) {
        TreeMap<String, String> signParams = new TreeMap<>(params);
        signParams.remove("sign");
        signParams.remove("sign_type");

        StringBuilder sb = new StringBuilder();
        signParams.forEach((key, value) -> {
            if (value != null && !value.isEmpty()) {
                sb.append(key).append("=").append(value).append("&");
            }
        });
        if (sb.length() > 0) {
            sb.setLength(sb.length() - 1);
        }
        sb.append(merchantKey);
        return DigestUtil.md5Hex(sb.toString());
    }
}
