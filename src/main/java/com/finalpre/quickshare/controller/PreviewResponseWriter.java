package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.service.preview.PreparedPreview;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ContentDisposition;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

final class PreviewResponseWriter {

    private PreviewResponseWriter() {
    }

    static void write(PreparedPreview preview, HttpServletResponse response) throws IOException {
        try (preview) {
            response.setContentType(preview.contentType());
            response.setHeader("Cache-Control", preview.cacheControl());
            response.setHeader("Content-Disposition", ContentDisposition.inline()
                    .filename(preview.fileName(), StandardCharsets.UTF_8)
                    .build()
                    .toString());
            response.setContentLengthLong(preview.contentLength());

            try (OutputStream output = response.getOutputStream()) {
                preview.content().transferTo(output);
                output.flush();
            }
        }
    }
}
