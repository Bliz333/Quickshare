package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.service.UserService;
import com.finalpre.quickshare.vo.UserVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProfileController {

    @Autowired
    private UserService userService;

    @GetMapping("/profile")
    public Result<UserVO> getProfile(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new AuthenticationCredentialsNotFoundException("未授权或登录已失效");
        }
        return Result.success(userService.getProfile(userId));
    }
}
