package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.PreviewUnavailableException;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.config.OfficePreviewProperties;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.vo.FileInfoVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LibreOfficeOfficePreviewServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void preparePreviewShouldConvertOfficeFileAndReuseCache() throws Exception {
        Path cacheDir = tempDir.resolve("cache");
        Path markerFile = tempDir.resolve("soffice-invocations.log");
        Path commandScript = createFakeSofficeScript(tempDir.resolve("fake-soffice.sh"), markerFile, false);
        LibreOfficeOfficePreviewService service = createService(commandScript, cacheDir, true);

        Path sourceFile = tempDir.resolve("report.docx");
        Files.writeString(sourceFile, "office source");

        FileInfoVO fileInfo = new FileInfoVO();
        fileInfo.setOriginalName("report.docx");
        fileInfo.setFilePath(sourceFile.toString());
        fileInfo.setFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        PreviewResource firstPreview = service.preparePreview(fileInfo);
        assertThat(firstPreview.contentType()).isEqualTo("application/pdf");
        assertThat(firstPreview.fileName()).isEqualTo("report.pdf");
        assertThat(Files.readString(firstPreview.file())).isEqualTo("fake pdf preview");
        assertThat(readLines(markerFile)).hasSize(1);

        createFakeSofficeScript(commandScript, markerFile, true);

        PreviewResource secondPreview = service.preparePreview(fileInfo);
        assertThat(secondPreview.file()).isEqualTo(firstPreview.file());
        assertThat(readLines(markerFile)).hasSize(1);
    }

    @Test
    void preparePreviewShouldFailWhenServiceDisabled() throws Exception {
        LibreOfficeOfficePreviewService service = createService(tempDir.resolve("missing-soffice"), tempDir.resolve("cache"), false);

        FileInfoVO fileInfo = new FileInfoVO();
        fileInfo.setOriginalName("report.docx");
        fileInfo.setFilePath(tempDir.resolve("report.docx").toString());
        fileInfo.setFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        assertThatThrownBy(() -> service.preparePreview(fileInfo))
                .isInstanceOf(PreviewUnavailableException.class)
                .hasMessage("Office 文档预览服务未启用");
    }

    @Test
    void preparePreviewShouldFailWhenConverterReturnsError() throws Exception {
        Path cacheDir = tempDir.resolve("cache-error");
        Path markerFile = tempDir.resolve("soffice-error.log");
        Path commandScript = createFakeSofficeScript(tempDir.resolve("fake-soffice-error.sh"), markerFile, true);
        LibreOfficeOfficePreviewService service = createService(commandScript, cacheDir, true);

        Path sourceFile = tempDir.resolve("slides.pptx");
        Files.writeString(sourceFile, "office source");

        FileInfoVO fileInfo = new FileInfoVO();
        fileInfo.setOriginalName("slides.pptx");
        fileInfo.setFilePath(sourceFile.toString());
        fileInfo.setFileType("application/vnd.openxmlformats-officedocument.presentationml.presentation");

        assertThatThrownBy(() -> service.preparePreview(fileInfo))
                .isInstanceOf(PreviewUnavailableException.class)
                .hasMessage("Office 文档预览转换失败，请稍后重试或直接下载");
        assertThat(readLines(markerFile)).hasSize(1);
    }

    private LibreOfficeOfficePreviewService createService(Path commandPath, Path cacheDir, boolean enabled) {
        LibreOfficeOfficePreviewService service = new LibreOfficeOfficePreviewService();

        OfficePreviewProperties properties = new OfficePreviewProperties();
        properties.setEnabled(enabled);
        properties.setCommand(commandPath.toAbsolutePath().toString());
        properties.setTimeoutSeconds(10);
        properties.setCacheDir(cacheDir.toAbsolutePath().toString());

        FileConfig fileConfig = new FileConfig();
        ReflectionTestUtils.setField(fileConfig, "uploadDir", tempDir.resolve("uploads").toString());

        ReflectionTestUtils.setField(service, "officePreviewProperties", properties);
        ReflectionTestUtils.setField(service, "fileConfig", fileConfig);
        return service;
    }

    private Path createFakeSofficeScript(Path scriptPath, Path markerFile, boolean fail) throws IOException {
        String script = """
                #!/bin/sh
                marker=%s
                echo invoked >> "$marker"
                if [ "%s" = "true" ]; then
                  echo conversion failed >&2
                  exit 1
                fi
                outdir=""
                input=""
                while [ $# -gt 0 ]; do
                  case "$1" in
                    --outdir)
                      shift
                      outdir="$1"
                      ;;
                    *)
                      input="$1"
                      ;;
                  esac
                  shift
                done
                name=$(basename "$input")
                name="${name%%.*}.pdf"
                mkdir -p "$outdir"
                printf "fake pdf preview" > "$outdir/$name"
                """.formatted(markerFile.toAbsolutePath(), fail);
        Files.writeString(scriptPath, script);
        scriptPath.toFile().setExecutable(true);
        return scriptPath;
    }

    private List<String> readLines(Path file) throws IOException {
        if (!Files.exists(file)) {
            return List.of();
        }
        return Files.readAllLines(file);
    }
}
