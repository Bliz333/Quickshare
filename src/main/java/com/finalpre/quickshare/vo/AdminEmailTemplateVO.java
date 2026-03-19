package com.finalpre.quickshare.vo;

import lombok.Data;
import java.util.Map;

@Data
public class AdminEmailTemplateVO {
    private String templateType;
    private String description;
    private Map<String, LocaleTemplateVO> locales;
    private String availableVariables;

    @Data
    public static class LocaleTemplateVO {
        private String subject;
        private String body;
    }
}
