package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.RandomUtil;
import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.service.EmailService;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.service.VerificationCodeService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class VerificationCodeServiceImpl implements VerificationCodeService {

    @Autowired
    private EmailService emailService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RegistrationSettingsService registrationSettingsService;

    private static final String CODE_PREFIX = "email:code:";
    private static final int CODE_EXPIRE_MINUTES = 5;   // 验证码有效期5分钟

    @Override
    public String generateAndSendCode(String email, String recaptchaToken, String locale) {
        log.info("[验证码发送] 请求邮箱：{}", email);

        RegistrationSettingsPolicy registrationSettings = registrationSettingsService.getPolicy();
        if (!registrationSettings.emailVerificationEnabled()) {
            throw new FeatureDisabledException("当前未启用邮箱验证码");
        }

        if (registrationSettings.recaptchaEnabled()) {
            if (recaptchaToken == null || recaptchaToken.isBlank()) {
                throw new IllegalArgumentException("缺少人机验证，请重试");
            }
            if (!verifyRecaptcha(recaptchaToken, registrationSettings)) {
                log.warn("[验证码发送] reCAPTCHA 验证失败：{}", email);
                throw new IllegalArgumentException("人机验证失败，请重试");
            }
        } else {
            log.info("[验证码发送] 已关闭 reCAPTCHA 校验");
        }

        // 2️⃣ 检查发送频率（60 秒内禁止重复发送）
        String key = CODE_PREFIX + email;
        if (redisTemplate.hasKey(key)) {
            Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
            if (ttl != null && ttl > 240) { // 剩余>240s 表示刚发过
                throw new IllegalArgumentException("验证码已发送，请稍后再试");
            }
        }

        // 3️⃣ 生成随机6位数字验证码
        String code = RandomUtil.randomNumbers(6);
        log.info("[验证码发送] 生成验证码 {} -> {}", email, code);

        try {
            // 4️⃣ 发送邮件
            emailService.sendVerificationCode(email, code, locale);
            log.info("[验证码发送] 邮件发送请求已提交: {}", email);

            // 5️⃣ 发送成功后再存入 Redis（防止失败也被限流）
            redisTemplate.opsForValue().set(key, code, CODE_EXPIRE_MINUTES, TimeUnit.MINUTES);
            log.info("[验证码发送] 验证码已写入 Redis，过期时间 {} 分钟", CODE_EXPIRE_MINUTES);

            return "验证码已发送到您的邮箱，请查收。";
        } catch (Exception e) {
            // 邮件发送失败时删除 Redis 缓存
            redisTemplate.delete(key);
            log.error("[验证码发送] 邮件发送失败：{}", email, e);
            throw new RuntimeException("邮件发送失败，请稍后重试");
        }
    }

    @Override
    public boolean verifyCode(String email, String code) {
        String key = CODE_PREFIX + email;
        String savedCode = redisTemplate.opsForValue().get(key);

        if (savedCode == null) {
            log.warn("[验证码校验] 邮箱={} 未找到验证码", email);
            return false;
        }

        boolean match = savedCode.equals(code);
        if (match) {
            redisTemplate.delete(key);
            log.info("[验证码校验] 验证成功：{}", email);
        } else {
            log.warn("[验证码校验] 验证码错误：{}", email);
        }

        return match;
    }

    /**
     * 正确的 reCAPTCHA 校验逻辑 (表单方式)
     */
    private boolean verifyRecaptcha(String token, RegistrationSettingsPolicy registrationSettings) {
        try {
            if (registrationSettings == null || registrationSettings.recaptchaSecretKey() == null || registrationSettings.recaptchaSecretKey().isBlank()) {
                log.warn("[reCAPTCHA] 未配置 secret key");
                return false;
            }
            RestTemplate restTemplate = new RestTemplate();
            String url = registrationSettings.recaptchaVerifyUrl();

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("secret", registrationSettings.recaptchaSecretKey());
            params.add("response", token);

            Map<String, Object> response = restTemplate.postForObject(url, params, Map.class);

            boolean success = response != null && Boolean.TRUE.equals(response.get("success"));
            if (!success) {
                Object errorCodes = response != null ? response.get("error-codes") : "null";
                log.warn("[reCAPTCHA] 验证失败: {}", errorCodes);
            }
            return success;
        } catch (Exception e) {
            log.error("[reCAPTCHA] 验证异常", e);
            return false;
        }
    }
}
