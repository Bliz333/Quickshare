package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FileUploadPolicyServiceImpl implements FileUploadPolicyService {

    @Autowired
    private FileConfig fileConfig;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public FileUploadPolicy getPolicy() {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getFileUploadPolicy();
            if (override != null && override.isPresent()) {
                return normalize(override.get());
            }
        }

        return normalize(new FileUploadPolicy(
                true,
                fileConfig.getMaxFileSize(),
                fileConfig.getAllowedTypes()
        ));
    }

    @Override
    public long getHardMaxFileSizeBytes() {
        return fileConfig.getServletMaxFileSizeBytes();
    }

    private FileUploadPolicy normalize(FileUploadPolicy source) {
        if (source == null) {
            return new FileUploadPolicy(true, -1L, List.of());
        }

        long maxFileSizeBytes = source.maxFileSizeBytes() == 0 ? -1L : source.maxFileSizeBytes();
        List<String> allowedExtensions = source.allowedExtensions() == null
                ? List.of()
                : source.allowedExtensions().stream()
                .map(value -> value == null ? "" : value.trim())
                .map(value -> value.startsWith(".") ? value.substring(1) : value)
                .map(String::toLowerCase)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
        return new FileUploadPolicy(source.guestUploadEnabled(), maxFileSizeBytes, allowedExtensions);
    }
}
