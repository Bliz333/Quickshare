package com.finalpre.quickshare.dto;

import lombok.Data;
import java.util.Map;

@Data
public class AdminEmailTemplateUpdateRequest {
    private Map<String, LocaleTemplateInput> locales;

    @Data
    public static class LocaleTemplateInput {
        private String subject;
        private String body;
    }
}
