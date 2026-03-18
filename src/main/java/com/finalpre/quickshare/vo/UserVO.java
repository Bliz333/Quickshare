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
}
