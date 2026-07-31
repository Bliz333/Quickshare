package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.service.preview.PreparedPreview;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class PreviewResponseWriterTest {

    @Test
    void writesPreparedMetadataAndClosesContent() throws Exception {
        AtomicBoolean closed = new AtomicBoolean();
        byte[] body = "%PDF preview".getBytes();
        ByteArrayInputStream content = new ByteArrayInputStream(body) {
            @Override
            public void close() throws IOException {
                closed.set(true);
                super.close();
            }
        };
        PreparedPreview preview = new PreparedPreview(
                "报告.pdf", "application/pdf", body.length, "private, max-age=300", content);
        MockHttpServletResponse response = new MockHttpServletResponse();

        PreviewResponseWriter.write(preview, response);

        assertThat(response.getContentType()).isEqualTo("application/pdf");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("private, max-age=300");
        assertThat(response.getHeader("Content-Disposition"))
                .startsWith("inline;")
                .contains("filename*=");
        assertThat(response.getContentLengthLong()).isEqualTo(body.length);
        assertThat(response.getContentAsByteArray()).isEqualTo(body);
        assertThat(closed).isTrue();
    }
}
