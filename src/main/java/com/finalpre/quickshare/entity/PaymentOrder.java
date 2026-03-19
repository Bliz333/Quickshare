package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("payment_order")
public class PaymentOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private Long userId;
    private Long planId;
    private String planName;
    private String planType;
    private Long planValue;
    private BigDecimal amount;
    /** pending / paid / expired / refunded */
    private String status;
    private String payType;
    private String tradeNo;
    private LocalDateTime notifyTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
