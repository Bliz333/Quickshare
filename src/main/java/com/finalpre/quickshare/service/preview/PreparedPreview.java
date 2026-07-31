package com.finalpre.quickshare.service.preview;

import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

public record PreparedPreview(
        String fileName,
        String contentType,
        long contentLength,
        String cacheControl,
        InputStream content
) implements AutoCloseable {

    public PreparedPreview {
        Objects.requireNonNull(fileName, "fileName");
        Objects.requireNonNull(contentType, "contentType");
        Objects.requireNonNull(cacheControl, "cacheControl");
        Objects.requireNonNull(content, "content");
        if (contentLength < 0) {
            throw new IllegalArgumentException("contentLength must not be negative");
        }
    }

    @Override
    public void close() throws IOException {
        content.close();
    }
}
