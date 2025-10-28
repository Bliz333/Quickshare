package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class RegisterDTO {
    private String username;
    private String password;
    private String email;
    private String nickname;
    private String verificationCode;  // 新增
}