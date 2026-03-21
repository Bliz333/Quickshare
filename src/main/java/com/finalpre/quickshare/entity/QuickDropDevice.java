package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("quickdrop_device")
public class QuickDropDevice {

    @TableId(value = "device_id", type = IdType.INPUT)
    private String deviceId;

    private Long userId;
    private String deviceName;
    private String deviceType;
    private LocalDateTime lastSeenAt;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
