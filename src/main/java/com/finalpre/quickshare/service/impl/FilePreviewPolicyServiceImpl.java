package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FilePreviewProperties;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class FilePreviewPolicyServiceImpl implements FilePreviewPolicyService {

    private static final Set<String> TEXT_EXTENSIONS = Set.of(
            "txt", "md", "markdown", "csv", "log", "json", "xml", "yaml", "yml",
            "properties", "ini", "conf", "sql", "sh", "bat", "java", "js", "ts",
            "tsx", "jsx", "css", "html", "htm"
    );
    private static final Set<String> TEXT_MIME_TYPES = Set.of(
            "application/json", "application/xml", "application/javascript", "application/x-javascript",
            "application/yaml", "application/x-yaml", "application/sql"
    );
    private static final Set<String> OFFICE_EXTENSIONS = Set.of(
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"
    );
    private static final Set<String> OFFICE_MIME_TYPES = Set.of(
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.oasis.opendocument.text",
            "application/vnd.oasis.opendocument.spreadsheet",
            "application/vnd.oasis.opendocument.presentation"
    );

    @Autowired
    private FilePreviewProperties filePreviewProperties;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public FilePreviewPolicy getPolicy() {
        if (systemSettingOverrideService != null) {
            var override = systemSettingOverrideService.getFilePreviewPolicy();
            if (override != null && override.isPresent()) {
                return normalize(override.get());
            }
        }

        return normalize(new FilePreviewPolicy(
                filePreviewProperties.isEnabled(),
                filePreviewProperties.isImageEnabled(),
                filePreviewProperties.isVideoEnabled(),
                filePreviewProperties.isAudioEnabled(),
                filePreviewProperties.isPdfEnabled(),
                filePreviewProperties.isTextEnabled(),
                filePreviewProperties.isOfficeEnabled(),
                parseAllowedExtensions(filePreviewProperties.getAllowedExtensions())
        ));
    }

    @Override
    public boolean isPreviewAllowed(String fileName, String contentType) {
        FilePreviewPolicy policy = getPolicy();
        if (!policy.enabled()) {
            return false;
        }

        String extension = extractExtension(fileName);
        String normalizedContentType = normalizeContentType(contentType);
        if (!matchesPreviewCategory(policy, extension, normalizedContentType)) {
            return false;
        }

        if (policy.allowedExtensions().isEmpty()) {
            return true;
        }
        return !extension.isBlank() && policy.allowedExtensions().contains(extension);
    }

    private FilePreviewPolicy normalize(FilePreviewPolicy source) {
        if (source == null) {
            return new FilePreviewPolicy(true, true, true, true, true, true, true, List.of());
        }

        return new FilePreviewPolicy(
                source.enabled(),
                source.imageEnabled(),
                source.videoEnabled(),
                source.audioEnabled(),
                source.pdfEnabled(),
                source.textEnabled(),
                source.officeEnabled(),
                normalizeExtensions(source.allowedExtensions())
        );
    }

    private boolean matchesPreviewCategory(FilePreviewPolicy policy, String extension, String contentType) {
        if (policy.imageEnabled() && contentType.startsWith("image/")) {
            return true;
        }
        if (policy.videoEnabled() && contentType.startsWith("video/")) {
            return true;
        }
        if (policy.audioEnabled() && contentType.startsWith("audio/")) {
            return true;
        }
        if (policy.pdfEnabled() && ("application/pdf".equals(contentType) || "pdf".equals(extension))) {
            return true;
        }
        if (policy.textEnabled() && isTextType(extension, contentType)) {
            return true;
        }
        return policy.officeEnabled() && isOfficeType(extension, contentType);
    }

    private boolean isTextType(String extension, String contentType) {
        return contentType.startsWith("text/")
                || TEXT_MIME_TYPES.contains(contentType)
                || TEXT_EXTENSIONS.contains(extension);
    }

    private boolean isOfficeType(String extension, String contentType) {
        return OFFICE_MIME_TYPES.contains(contentType)
                || OFFICE_EXTENSIONS.contains(extension);
    }

    private List<String> parseAllowedExtensions(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return normalizeExtensions(List.of(raw.split(",")));
    }

    private List<String> normalizeExtensions(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }

        return values.stream()
                .map(value -> value == null ? "" : value.trim())
                .map(value -> value.startsWith(".") ? value.substring(1) : value)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private String extractExtension(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "";
        }

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "";
        }

        String value = contentType.trim().toLowerCase(Locale.ROOT);
        int semicolonIndex = value.indexOf(';');
        return semicolonIndex >= 0 ? value.substring(0, semicolonIndex).trim() : value;
    }
}
