package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("system_setting")
public class SystemSetting {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String configKey;
    private String configValue;
    private String description;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
