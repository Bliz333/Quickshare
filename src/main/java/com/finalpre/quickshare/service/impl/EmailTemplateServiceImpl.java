package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.EmailTemplate;
import com.finalpre.quickshare.service.EmailTemplate.LocaleTemplate;
import com.finalpre.quickshare.service.EmailTemplateService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class EmailTemplateServiceImpl implements EmailTemplateService {

    public static final String TEMPLATE_VERIFICATION_CODE = "verification-code";

    private static final Map<String, EmailTemplate> DEFAULTS = Map.of(
            TEMPLATE_VERIFICATION_CODE, new EmailTemplate(Map.of(
                    "en", new LocaleTemplate(
                            "QuickShare Verification Code",
                            """
                            Your verification code is: {code}

                            This code expires in {expireMinutes} minutes. Do not share it with anyone.

                            If you did not request this, please ignore this email."""
                    ),
                    "zh", new LocaleTemplate(
                            "QuickShare 邮箱验证码",
                            """
                            您的验证码是: {code}

                            验证码{expireMinutes}分钟内有效，请勿泄露给他人。

                            如非本人操作，请忽略此邮件。"""
                    )
            ))
    );

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public EmailTemplate getTemplate(String templateType) {
        var override = systemSettingOverrideService.getEmailTemplate(templateType);
        if (override != null && override.isPresent()) {
            return mergeWithDefaults(templateType, override.get());
        }
        return DEFAULTS.getOrDefault(templateType, emptyTemplate());
    }

    @Override
    public void saveTemplate(String templateType, EmailTemplate template) {
        if (template == null || template.locales() == null || template.locales().isEmpty()) {
            throw new IllegalArgumentException("邮件模板不能为空");
        }
        systemSettingOverrideService.saveEmailTemplate(templateType, template);
    }

    @Override
    public LocaleTemplate render(String templateType, String locale, Map<String, String> variables) {
        EmailTemplate template = getTemplate(templateType);
        LocaleTemplate localeTemplate = template.resolve(locale);

        String subject = replaceVariables(localeTemplate.subject(), variables);
        String body = replaceVariables(localeTemplate.body(), variables);

        return new LocaleTemplate(subject, body);
    }

    private String replaceVariables(String text, Map<String, String> variables) {
        if (text == null || variables == null) return text;
        String result = text;
        for (var entry : variables.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return result;
    }

    /**
     * Merge override with defaults: if override is missing a locale, use the default.
     */
    private EmailTemplate mergeWithDefaults(String templateType, EmailTemplate override) {
        EmailTemplate defaultTemplate = DEFAULTS.get(templateType);
        if (defaultTemplate == null) return override;

        Map<String, LocaleTemplate> merged = new LinkedHashMap<>(defaultTemplate.locales());
        merged.putAll(override.locales());
        return new EmailTemplate(merged);
    }

    private EmailTemplate emptyTemplate() {
        return new EmailTemplate(Map.of(
                "en", new LocaleTemplate("", ""),
                "zh", new LocaleTemplate("", "")
        ));
    }
}
