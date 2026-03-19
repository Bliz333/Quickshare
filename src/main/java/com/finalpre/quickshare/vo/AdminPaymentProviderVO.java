package com.finalpre.quickshare.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AdminPaymentProviderVO {
    private Long id;
    private String name;
    private String apiUrl;
    private String pid;
    private boolean hasKey;
    private String payTypes;
    private Integer enabled;
    private Integer sortOrder;
    private LocalDateTime createTime;
}
