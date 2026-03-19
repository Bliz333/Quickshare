package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("payment_provider")
public class PaymentProvider {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String apiUrl;
    private String pid;
    private String merchantKey;
    private String payTypes;
    private Integer enabled;
    private Integer sortOrder;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
