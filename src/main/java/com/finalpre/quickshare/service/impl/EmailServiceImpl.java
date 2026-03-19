package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.EmailService;
import com.finalpre.quickshare.service.EmailTemplate;
import com.finalpre.quickshare.service.EmailTemplateService;
import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.SmtpPolicyService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Properties;

@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    @Autowired
    private SmtpPolicyService smtpPolicyService;

    @Autowired
    private EmailTemplateService emailTemplateService;

    @Override
    public void sendVerificationCode(String email, String code, String locale) {
        SmtpPolicy policy = requireSmtpPolicy();

        EmailTemplate.LocaleTemplate rendered = emailTemplateService.render(
                EmailTemplateServiceImpl.TEMPLATE_VERIFICATION_CODE,
                locale,
                Map.of("code", code, "expireMinutes", "5", "appName", "QuickShare")
        );

        sendEmail(policy, email, rendered.subject(), rendered.body());
    }

    public void sendTestEmail(String to) {
        SmtpPolicy policy = requireSmtpPolicy();
        sendEmail(policy, to, "QuickShare SMTP Test Email",
                "This is a test email. If you received this, your SMTP configuration is working correctly.\n\n"
                + "这是一封测试邮件，如果您收到此邮件，说明 SMTP 配置正确。");
        log.info("Test email sent successfully to {}", to);
    }

    public void sendRawEmail(String to, String subject, String body) {
        SmtpPolicy policy = requireSmtpPolicy();
        sendEmail(policy, to, subject, body);
    }

    private SmtpPolicy requireSmtpPolicy() {
        SmtpPolicy policy = smtpPolicyService.getPolicy();
        if (policy.host() == null || policy.host().isBlank()) {
            throw new IllegalStateException("邮件服务未配置，请在管理后台设置 SMTP");
        }
        return policy;
    }

    private void sendEmail(SmtpPolicy policy, String to, String subject, String body) {
        JavaMailSender sender = buildSender(policy);
        String from = (policy.senderAddress() != null && !policy.senderAddress().isBlank())
                ? policy.senderAddress()
                : policy.username();

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);

        sender.send(message);
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
