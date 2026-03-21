package com.finalpre.quickshare.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.entity.PaymentProvider;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PaymentProviderMapper;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.vo.PublicPaymentOptionsVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/public")
public class PlanController {

    @Autowired
    private PlanMapper planMapper;

    @Autowired
    private PaymentProviderMapper paymentProviderMapper;

    @GetMapping("/plans")
    public Result<List<Plan>> getActivePlans() {
        List<Plan> plans = planMapper.selectList(
                new QueryWrapper<Plan>()
                        .eq("status", 1)
                        .orderByAsc("sort_order")
                        .orderByAsc("price"));
        return Result.success(plans);
    }

    @GetMapping("/payment-options")
    public Result<PublicPaymentOptionsVO> getPaymentOptions() {
        PaymentProvider provider = paymentProviderMapper.selectOne(
                new QueryWrapper<PaymentProvider>()
                        .eq("enabled", 1)
                        .orderByAsc("sort_order")
                        .last("LIMIT 1"));
        if (provider == null) {
            return Result.success(null);
        }

        PublicPaymentOptionsVO vo = new PublicPaymentOptionsVO();
        vo.setProviderId(provider.getId());
        vo.setProviderName(provider.getName());
        vo.setPayTypes(resolvePayTypes(provider.getPayTypes()));
        return Result.success(vo);
    }

    private List<String> resolvePayTypes(String payTypes) {
        if (payTypes == null || payTypes.isBlank()) {
            return List.of("alipay");
        }

        List<String> resolved = Arrays.stream(payTypes.split(","))
                .map(value -> value == null ? "" : value.trim().toLowerCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
        return resolved.isEmpty() ? List.of("alipay") : resolved;
    }
}
