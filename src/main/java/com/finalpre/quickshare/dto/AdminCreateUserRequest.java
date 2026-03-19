package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminCreateUserRequest {

    private String username;

    private String password;

    private String email;

    private String nickname;

    private String role;
}
