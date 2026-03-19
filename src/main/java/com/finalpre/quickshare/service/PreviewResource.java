package com.finalpre.quickshare.service;

import java.nio.file.Path;

public record PreviewResource(
        Path file,
        String contentType,
        String fileName,
        long contentLength
) {
}
