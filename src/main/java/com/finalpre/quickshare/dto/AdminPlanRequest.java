package com.finalpre.quickshare.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class AdminPlanRequest {
    private String name;
    private String description;
    /** storage / downloads / vip */
    private String type;
    private Long value;
    private BigDecimal price;
    private Integer sortOrder;
    private Integer status;
}
