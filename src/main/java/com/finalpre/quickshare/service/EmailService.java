package com.finalpre.quickshare.service;

public interface EmailService {
    void sendVerificationCode(String email, String code, String locale);
}
