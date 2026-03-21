package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("notification_record")
public class NotificationRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String scope;
    private Long recipientUserId;
    private Long senderUserId;
    private String subject;
    private String body;
    private LocalDateTime createTime;
}
