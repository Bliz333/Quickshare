package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.EmailTemplate;
import com.finalpre.quickshare.service.EmailTemplate.LocaleTemplate;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailTemplateServiceImplTest {

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private EmailTemplateServiceImpl emailTemplateService;

    @Test
    void getTemplateShouldReturnDefaultWhenNoOverride() {
        when(systemSettingOverrideService.getEmailTemplate("verification-code"))
                .thenReturn(Optional.empty());

        EmailTemplate template = emailTemplateService.getTemplate("verification-code");

        assertThat(template.locales()).containsKeys("en", "zh");
        assertThat(template.locales().get("en").subject()).isEqualTo("QuickShare Verification Code");
        assertThat(template.locales().get("zh").subject()).isEqualTo("QuickShare 邮箱验证码");
    }

    @Test
    void getTemplateShouldReturnOverrideWhenPresent() {
        EmailTemplate override = new EmailTemplate(Map.of(
                "en", new LocaleTemplate("Custom Subject", "Custom body {code}")
        ));
        when(systemSettingOverrideService.getEmailTemplate("verification-code"))
                .thenReturn(Optional.of(override));

        EmailTemplate template = emailTemplateService.getTemplate("verification-code");

        // Override en, default zh should be merged in
        assertThat(template.locales().get("en").subject()).isEqualTo("Custom Subject");
        assertThat(template.locales()).containsKey("zh");
    }

    @Test
    void renderShouldReplaceVariables() {
        when(systemSettingOverrideService.getEmailTemplate("verification-code"))
                .thenReturn(Optional.empty());

        LocaleTemplate rendered = emailTemplateService.render(
                "verification-code", "en",
                Map.of("code", "123456", "expireMinutes", "5", "appName", "QuickShare")
        );

        assertThat(rendered.subject()).isEqualTo("QuickShare Verification Code");
        assertThat(rendered.body()).contains("123456");
        assertThat(rendered.body()).contains("5 minutes");
        assertThat(rendered.body()).doesNotContain("{code}");
        assertThat(rendered.body()).doesNotContain("{expireMinutes}");
    }

    @Test
    void renderShouldFallbackToEnWhenLocaleNotFound() {
        when(systemSettingOverrideService.getEmailTemplate("verification-code"))
                .thenReturn(Optional.empty());

        LocaleTemplate rendered = emailTemplateService.render(
                "verification-code", "fr",
                Map.of("code", "999999", "expireMinutes", "10", "appName", "QS")
        );

        assertThat(rendered.subject()).isEqualTo("QuickShare Verification Code");
        assertThat(rendered.body()).contains("999999");
    }

    @Test
    void renderShouldUseZhLocale() {
        when(systemSettingOverrideService.getEmailTemplate("verification-code"))
                .thenReturn(Optional.empty());

        LocaleTemplate rendered = emailTemplateService.render(
                "verification-code", "zh",
                Map.of("code", "654321", "expireMinutes", "5", "appName", "QuickShare")
        );

        assertThat(rendered.subject()).isEqualTo("QuickShare 邮箱验证码");
        assertThat(rendered.body()).contains("654321");
        assertThat(rendered.body()).contains("5分钟");
    }

    @Test
    void saveTemplateShouldRejectEmpty() {
        assertThatThrownBy(() -> emailTemplateService.saveTemplate("verification-code", null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
