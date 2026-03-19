package com.finalpre.quickshare.service;

import java.util.Map;

/**
 * Represents a multi-locale email template with subject and body.
 * Variables in the form {variableName} are replaced at send time.
 */
public record EmailTemplate(
        Map<String, LocaleTemplate> locales
) {
    public record LocaleTemplate(
            String subject,
            String body
    ) {}

    public LocaleTemplate resolve(String locale) {
        if (locale != null && locales.containsKey(locale)) {
            return locales.get(locale);
        }
        // fallback: en -> zh -> first available
        if (locales.containsKey("en")) return locales.get("en");
        if (locales.containsKey("zh")) return locales.get("zh");
        return locales.values().stream().findFirst().orElse(new LocaleTemplate("", ""));
    }
}
