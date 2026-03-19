package com.finalpre.quickshare.service;

import java.util.List;

public record FilePreviewPolicy(
        boolean enabled,
        boolean imageEnabled,
        boolean videoEnabled,
        boolean audioEnabled,
        boolean pdfEnabled,
        boolean textEnabled,
        boolean officeEnabled,
        List<String> allowedExtensions
) {
}
