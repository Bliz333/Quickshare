package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private PaymentOrderMapper paymentOrderMapper;

    /**
     * Create payment order and return epay redirect URL.
     */
    @PostMapping("/create")
    public Result<Map<String, String>> createOrder(
            @RequestBody Map<String, Object> request,
            Authentication authentication,
            HttpServletRequest httpRequest) {
        Long userId = requireUserId(authentication);
        Long planId = Long.parseLong(request.get("planId").toString());
        Long providerId = request.containsKey("providerId") ? Long.parseLong(request.get("providerId").toString()) : null;
        String payType = (String) request.getOrDefault("payType", "alipay");

        // Build return URL from request origin
        String returnUrl = request.containsKey("returnUrl")
                ? request.get("returnUrl").toString()
                : buildBaseUrl(httpRequest) + "/";

        String redirectUrl = paymentService.createOrder(userId, planId, providerId, payType, returnUrl);

        Map<String, String> result = new HashMap<>();
        result.put("redirectUrl", redirectUrl);
        return Result.success(result);
    }

    /**
     * Epay async notification callback (no auth required).
     */
    @RequestMapping(value = "/notify", method = {RequestMethod.GET, RequestMethod.POST})
    @ResponseBody
    public String handleNotify(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        request.getParameterMap().forEach((k, v) -> {
            if (v != null && v.length > 0) params.put(k, v[0]);
        });

        log.info("Epay notify received. params={}", params);
        try {
            boolean success = paymentService.handleNotify(params);
            return success ? "success" : "fail";
        } catch (Exception e) {
            log.error("Failed to process payment notify. params={}", params, e);
            return "fail";
        }
    }

    /**
     * Query order status.
     */
    /**
     * User's own order history.
     */
    @GetMapping("/orders")
    public Result<List<PaymentOrder>> getMyOrders(Authentication authentication) {
        Long userId = requireUserId(authentication);
        List<PaymentOrder> orders = paymentOrderMapper.selectList(
                new QueryWrapper<PaymentOrder>()
                        .eq("user_id", userId)
                        .orderByDesc("create_time"));
        return Result.success(orders);
    }

    @GetMapping("/order/{orderNo}")
    public Result<PaymentOrder> getOrder(@PathVariable String orderNo, Authentication authentication) {
        Long userId = requireUserId(authentication);
        PaymentOrder order = paymentService.getOrder(orderNo);
        if (order == null || !order.getUserId().equals(userId)) {
            return Result.success(null);
        }
        return Result.success(order);
    }

    private Long requireUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long)) {
            throw new org.springframework.security.access.AccessDeniedException("请先登录");
        }
        return (Long) authentication.getPrincipal();
    }

    private String buildBaseUrl(HttpServletRequest request) {
        String scheme = request.getHeader("X-Forwarded-Proto");
        if (scheme == null) scheme = request.getScheme();
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null) host = request.getHeader("Host");
        if (host == null) host = request.getServerName() + ":" + request.getServerPort();
        return scheme + "://" + host;
    }
}
