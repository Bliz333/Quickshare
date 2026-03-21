package com.finalpre.quickshare.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class NotificationVO {
    private Long id;
    private String scope;
    private String subject;
    private String body;
    private LocalDateTime createTime;
}
