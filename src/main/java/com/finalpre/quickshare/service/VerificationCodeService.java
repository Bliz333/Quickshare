package com.finalpre.quickshare.service;

public interface VerificationCodeService {
    String generateAndSendCode(String email, String recaptchaToken);
    boolean verifyCode(String email, String code);
}