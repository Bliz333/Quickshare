package com.finalpre.quickshare.service.preview;

import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.common.PreviewUnavailableException;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.StorageService;
import com.finalpre.quickshare.vo.FileInfoVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DefaultPreviewDeliveryTest {

    @TempDir
    Path tempDir;

    @Mock
    private FilePreviewPolicyService filePreviewPolicyService;

    @Mock
    private OfficePreviewService officePreviewService;

    @Mock
    private StorageService storageService;

    private PreviewDelivery previewDelivery;

    @BeforeEach
    void setUp() {
        previewDelivery = new DefaultPreviewDelivery(filePreviewPolicyService, officePreviewService);
    }

    @Test
    void opensStoredContentAndClosesTheSourceStream() throws Exception {
        byte[] body = "hello preview".getBytes();
        AtomicBoolean closed = new AtomicBoolean();
        InputStream content = new ByteArrayInputStream(body) {
            @Override
            public void close() throws IOException {
                closed.set(true);
                super.close();
            }
        };

        when(storageService.exists("demo-key.txt")).thenReturn(true);
        when(storageService.getSize("demo-key.txt")).thenReturn((long) body.length);
        when(storageService.retrieve("demo-key.txt")).thenReturn(content);
        when(filePreviewPolicyService.isPreviewAllowed("demo.txt", "text/plain")).thenReturn(true);

        PreparedPreview preview = previewDelivery.open(
                PreviewSource.stored(storageService, "demo-key.txt", "demo.txt", "text/plain", null),
                new PreviewOptions(null, Duration.ofHours(1))
        );

        assertThat(preview.fileName()).isEqualTo("demo.txt");
        assertThat(preview.contentType()).isEqualTo("text/plain");
        assertThat(preview.contentLength()).isEqualTo(body.length);
        assertThat(preview.cacheControl()).isEqualTo("private, max-age=3600");
        assertThat(preview.content().readAllBytes()).isEqualTo(body);

        preview.close();
        assertThat(closed).isTrue();
    }

    @Test
    void rejectsMissingLocalSourceBeforeApplyingPolicy() {
        PreviewSource source = PreviewSource.local(
                tempDir.resolve("missing.txt"), "missing.txt", "text/plain", null);

        assertThatThrownBy(() -> previewDelivery.open(source, new PreviewOptions(null, Duration.ZERO)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("文件不存在");

        verifyNoInteractions(filePreviewPolicyService, officePreviewService);
    }

    @Test
    void rejectsATypeDisabledByPreviewPolicy() throws Exception {
        Path sourceFile = tempDir.resolve("blocked.txt");
        Files.writeString(sourceFile, "blocked");
        when(filePreviewPolicyService.isPreviewAllowed("blocked.txt", "text/plain")).thenReturn(false);

        assertThatThrownBy(() -> previewDelivery.open(
                PreviewSource.local(sourceFile, "blocked.txt", "text/plain", null),
                new PreviewOptions(null, Duration.ZERO)))
                .isInstanceOf(FeatureDisabledException.class)
                .hasMessage("当前文件类型不允许预览");

        verifyNoInteractions(officePreviewService);
    }

    @Test
    void convertsOfficeSourceAndReturnsPreparedPdf() throws Exception {
        Path sourceFile = tempDir.resolve("report.docx");
        Path pdfFile = tempDir.resolve("report.pdf");
        Files.writeString(sourceFile, "office source");
        Files.writeString(pdfFile, "%PDF preview");
        String officeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        when(filePreviewPolicyService.isPreviewAllowed("report.docx", officeType)).thenReturn(true);
        when(officePreviewService.supports("report.docx", officeType)).thenReturn(true);
        when(officePreviewService.preparePreview(any())).thenReturn(
                new PreviewResource(pdfFile, "application/pdf", "report.pdf", Files.size(pdfFile)));

        try (PreparedPreview preview = previewDelivery.open(
                PreviewSource.local(sourceFile, "report.docx", officeType, null),
                new PreviewOptions(null, Duration.ofMinutes(5)))) {
            assertThat(preview.fileName()).isEqualTo("report.pdf");
            assertThat(preview.contentType()).isEqualTo("application/pdf");
            assertThat(preview.cacheControl()).isEqualTo("private, max-age=300");
            assertThat(new String(preview.content().readAllBytes())).isEqualTo("%PDF preview");
        }

        ArgumentCaptor<FileInfoVO> fileCaptor = ArgumentCaptor.forClass(FileInfoVO.class);
        verify(officePreviewService).preparePreview(fileCaptor.capture());
        assertThat(fileCaptor.getValue().getOriginalName()).isEqualTo("report.docx");
        assertThat(fileCaptor.getValue().getFilePath()).isEqualTo(sourceFile.toString());
        assertThat(fileCaptor.getValue().getFileSize()).isEqualTo(Files.size(sourceFile));
    }

    @Test
    void translatesOfficeIoFailureIntoPreviewUnavailable() throws Exception {
        Path sourceFile = tempDir.resolve("report.docx");
        Files.writeString(sourceFile, "office source");
        String officeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        when(filePreviewPolicyService.isPreviewAllowed("report.docx", officeType)).thenReturn(true);
        when(officePreviewService.supports("report.docx", officeType)).thenReturn(true);
        when(officePreviewService.preparePreview(any())).thenThrow(new IOException("conversion failed"));

        assertThatThrownBy(() -> previewDelivery.open(
                PreviewSource.local(sourceFile, "report.docx", officeType, null),
                new PreviewOptions(null, Duration.ZERO)))
                .isInstanceOf(PreviewUnavailableException.class)
                .hasMessage("Office 文档转换失败，请直接下载")
                .hasCauseInstanceOf(IOException.class);
    }

    @Test
    void preparesBoundedImageThumbnailWithItsActualLength() throws Exception {
        Path sourceFile = tempDir.resolve("photo.png");
        BufferedImage image = new BufferedImage(20, 10, BufferedImage.TYPE_INT_RGB);
        ImageIO.write(image, "png", sourceFile.toFile());

        when(filePreviewPolicyService.isPreviewAllowed("photo.png", "image/png")).thenReturn(true);

        try (PreparedPreview preview = previewDelivery.open(
                PreviewSource.local(sourceFile, "photo.png", "image/png", null),
                new PreviewOptions(5, Duration.ofMinutes(5)))) {
            byte[] thumbnailBytes = preview.content().readAllBytes();
            BufferedImage thumbnail = ImageIO.read(new ByteArrayInputStream(thumbnailBytes));

            assertThat(preview.contentLength()).isEqualTo(thumbnailBytes.length);
            assertThat(thumbnail.getWidth()).isLessThanOrEqualTo(5);
            assertThat(thumbnail.getHeight()).isLessThanOrEqualTo(5);
        }
    }

    @Test
    void fallsBackToOriginalStreamWhenThumbnailPreparationFails() throws Exception {
        byte[] body = "original image".getBytes();
        when(storageService.exists("photo.png")).thenReturn(true);
        when(storageService.getLocalPath("photo.png")).thenThrow(new IOException("local copy failed"));
        when(storageService.retrieve("photo.png")).thenReturn(new ByteArrayInputStream(body));
        when(filePreviewPolicyService.isPreviewAllowed("photo.png", "image/png")).thenReturn(true);

        try (PreparedPreview preview = previewDelivery.open(
                PreviewSource.stored(storageService, "photo.png", "photo.png", "image/png", (long) body.length),
                new PreviewOptions(64, Duration.ZERO))) {
            assertThat(preview.contentLength()).isEqualTo(body.length);
            assertThat(preview.content().readAllBytes()).isEqualTo(body);
        }
    }
}
