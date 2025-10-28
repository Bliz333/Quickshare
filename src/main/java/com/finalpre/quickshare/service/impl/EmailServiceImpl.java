package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailServiceImpl implements EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String from;

    @Override
    public void sendVerificationCode(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("QuickShare 邮箱验证码");
        message.setText("您的验证码是: " + code + "\n\n验证码5分钟内有效,请勿泄露给他人。\n\n如非本人操作,请忽略此邮件。");

        mailSender.send(message);
    }
}