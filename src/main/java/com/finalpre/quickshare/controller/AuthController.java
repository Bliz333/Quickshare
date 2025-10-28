package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.LoginDTO;
import com.finalpre.quickshare.dto.RegisterDTO;
import com.finalpre.quickshare.service.UserService;
import com.finalpre.quickshare.service.VerificationCodeService;
import com.finalpre.quickshare.vo.UserVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private VerificationCodeService verificationCodeService;

    /**
     * 发送邮箱验证码
     */
    @PostMapping("/send-code")
    public Result<String> sendVerificationCode(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            String recaptchaToken = request.get("recaptchaToken");

            if (email == null || email.isEmpty()) {
                return Result.error("邮箱不能为空");
            }

            String message = verificationCodeService.generateAndSendCode(email, recaptchaToken);
            return Result.success(message);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 注册
     */
    @PostMapping("/register")
    public Result<UserVO> register(@RequestBody RegisterDTO dto) {
        try {
            // 验证邮箱验证码
            if (dto.getEmail() != null && !dto.getEmail().isEmpty()) {
                if (dto.getVerificationCode() == null || dto.getVerificationCode().isEmpty()) {
                    return Result.error("请输入验证码");
                }

                if (!verificationCodeService.verifyCode(dto.getEmail(), dto.getVerificationCode())) {
                    return Result.error("验证码错误或已过期");
                }
            }

            UserVO vo = userService.register(dto);
            return Result.success(vo);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 登录
     */
    @PostMapping("/login")
    public Result<UserVO> login(@RequestBody LoginDTO dto) {
        try {
            UserVO vo = userService.login(dto);
            return Result.success(vo);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

}