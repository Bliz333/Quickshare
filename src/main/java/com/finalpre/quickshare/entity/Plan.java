package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("plan")
public class Plan {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    /** storage / downloads / vip */
    private String type;
    /** Bytes for storage, count for downloads, days for VIP */
    private Long value;
    private BigDecimal price;
    private Integer sortOrder;
    /** 1=active, 0=disabled */
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
