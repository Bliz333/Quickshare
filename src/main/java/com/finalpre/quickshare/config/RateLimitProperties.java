package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    private Rule guestUpload = createRule(2, 3600);
    private Rule basicUserUpload = createRule(20, 3600);
    private Rule publicShareInfo = createRule(60, 600);
    private Rule publicDownload = createRule(30, 600);
    private Rule publicShareExtractCodeError = createRule(5, 600);

    private static Rule createRule(long maxRequests, long windowSeconds) {
        Rule rule = new Rule();
        rule.setMaxRequests(maxRequests);
        rule.setWindowSeconds(windowSeconds);
        return rule;
    }

    @Data
    public static class Rule {
        private boolean enabled = true;
        private long maxRequests;
        private long windowSeconds;
    }
}
