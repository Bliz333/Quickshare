package com.finalpre.quickshare.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class FileConfig {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${file.allowed-types:}")
    private String allowedTypes;

    @Value("${file.max-size:-1}")
    private long maxFileSize;

    public String getUploadDir() {
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return uploadDir;
    }

    public List<String> getAllowedTypes() {
        if (allowedTypes == null || allowedTypes.trim().isEmpty()) {
            return Collections.emptyList();
        }
        return Arrays.stream(allowedTypes.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }

    public long getMaxFileSize() {
        return maxFileSize;
    }
}
