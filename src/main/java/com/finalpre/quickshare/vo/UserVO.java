package com.finalpre.quickshare.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UserVO {
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private LocalDateTime createTime;
    private String token;  // JWT token
    private String role;
    private Long storageLimit;
    private Long storageUsed;
    private Integer downloadLimit;
    private Integer downloadUsed;
    private LocalDateTime vipExpireTime;
}
