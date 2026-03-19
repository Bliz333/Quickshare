package com.finalpre.quickshare.service;

import java.util.List;

public record FileUploadPolicy(
        boolean guestUploadEnabled,
        long maxFileSizeBytes,
        List<String> allowedExtensions
) {
}
