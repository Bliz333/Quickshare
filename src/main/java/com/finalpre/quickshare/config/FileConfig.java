package com.finalpre.quickshare.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

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

    @Value("${spring.servlet.multipart.max-file-size:10GB}")
    private String servletMaxFileSize;

    public String getConfiguredUploadDir() {
        return uploadDir;
    }

    public String getUploadDir() {
        if (uploadDir == null || uploadDir.isBlank()) {
            return uploadDir;
        }

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

    public long getServletMaxFileSizeBytes() {
        if (servletMaxFileSize == null || servletMaxFileSize.isBlank()) {
            return -1L;
        }

        try {
            return DataSize.parse(servletMaxFileSize).toBytes();
        } catch (IllegalArgumentException ex) {
            return -1L;
        }
    }
}
