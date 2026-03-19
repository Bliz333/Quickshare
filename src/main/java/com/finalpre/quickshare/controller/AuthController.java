package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.LoginDTO;
import com.finalpre.quickshare.dto.RegisterDTO;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.service.UserService;
import com.finalpre.quickshare.service.VerificationCodeService;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.vo.UserVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private VerificationCodeService verificationCodeService;

    @Autowired
    private RegistrationSettingsService registrationSettingsService;

    /**
     * 发送邮箱验证码
     */
    @PostMapping("/send-code")
    public Result<String> sendVerificationCode(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String recaptchaToken = request.get("recaptchaToken");
        String locale = request.get("locale");

        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("邮箱不能为空");
        }

        String message = verificationCodeService.generateAndSendCode(email, recaptchaToken, locale);
        return Result.success(message);
    }

    /**
     * 注册
     */
    @PostMapping("/register")
    public Result<UserVO> register(@RequestBody RegisterDTO dto) {
        RegistrationSettingsPolicy registrationSettings = registrationSettingsService.getPolicy();
        if (registrationSettings.emailVerificationEnabled()) {
            if (dto.getEmail() == null || dto.getEmail().isBlank()) {
                throw new IllegalArgumentException("请填写邮箱");
            }
            if (dto.getVerificationCode() == null || dto.getVerificationCode().isEmpty()) {
                throw new IllegalArgumentException("请输入验证码");
            }

            if (!verificationCodeService.verifyCode(dto.getEmail(), dto.getVerificationCode())) {
                throw new IllegalArgumentException("验证码错误或已过期");
            }
        }

        UserVO vo = userService.register(dto);
        return Result.success(vo);
    }

    /**
     * 登录
     */
    @PostMapping("/login")
    public Result<UserVO> login(@RequestBody LoginDTO dto) {
        UserVO vo = userService.login(dto);
        return Result.success(vo);
    }

}
