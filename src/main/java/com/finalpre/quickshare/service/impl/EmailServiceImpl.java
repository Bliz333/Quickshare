package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.EmailService;
import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.SmtpPolicyService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import java.util.Properties;

@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    @Autowired
    private SmtpPolicyService smtpPolicyService;

    @Override
    public void sendVerificationCode(String email, String code) {
        SmtpPolicy policy = smtpPolicyService.getPolicy();
        if (policy.host() == null || policy.host().isBlank()) {
            throw new IllegalStateException("邮件服务未配置，请在管理后台设置 SMTP");
        }

        JavaMailSender sender = buildSender(policy);
        String from = (policy.senderAddress() != null && !policy.senderAddress().isBlank())
                ? policy.senderAddress()
                : policy.username();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("QuickShare 邮箱验证码");
        message.setText("您的验证码是: " + code + "\n\n验证码5分钟内有效,请勿泄露给他人。\n\n如非本人操作,请忽略此邮件。");

        sender.send(message);
    }

    public void sendTestEmail(String to) {
        SmtpPolicy policy = smtpPolicyService.getPolicy();
        if (policy.host() == null || policy.host().isBlank()) {
            throw new IllegalStateException("邮件服务未配置，请在管理后台设置 SMTP");
        }

        JavaMailSender sender = buildSender(policy);
        String from = (policy.senderAddress() != null && !policy.senderAddress().isBlank())
                ? policy.senderAddress()
                : policy.username();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject("QuickShare SMTP 测试邮件");
        message.setText("这是一封测试邮件，如果您收到此邮件，说明 SMTP 配置正确。");

        sender.send(message);
        log.info("Test email sent successfully to {}", to);
    }

    private JavaMailSender buildSender(SmtpPolicy policy) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(policy.host());
        sender.setPort(policy.port());
        sender.setUsername(policy.username());
        sender.setPassword(policy.password());

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        if (policy.starttlsEnabled()) {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }
        props.put("mail.smtp.timeout", "60000");
        props.put("mail.smtp.connectiontimeout", "60000");

        return sender;
    }
}
