package com.finalpre.quickshare.service;

public interface EmailTemplateService {

    /** Get the template for a given type, with defaults if not customized. */
    EmailTemplate getTemplate(String templateType);

    /** Save a customized template. */
    void saveTemplate(String templateType, EmailTemplate template);

    /** Render a template for a given locale, replacing {variables}. */
    EmailTemplate.LocaleTemplate render(String templateType, String locale, java.util.Map<String, String> variables);
}
