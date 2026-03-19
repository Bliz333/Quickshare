package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;

    private String password;

    private String email;

    private String nickname;

    private String role;

    private LocalDateTime createTime;

    /** Storage limit in bytes (default 1GB) */
    private Long storageLimit;
    /** Storage used in bytes */
    private Long storageUsed;
    /** Download limit per month (-1=unlimited) */
    private Integer downloadLimit;
    /** Downloads used this month */
    private Integer downloadUsed;
    /** VIP expiration time */
    private LocalDateTime vipExpireTime;

    @TableLogic
    private Integer deleted;
}
