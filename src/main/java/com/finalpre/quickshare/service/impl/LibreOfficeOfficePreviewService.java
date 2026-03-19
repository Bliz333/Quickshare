package com.finalpre.quickshare.service.impl;

import cn.hutool.crypto.digest.DigestUtil;
import com.finalpre.quickshare.common.PreviewUnavailableException;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.config.OfficePreviewProperties;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.vo.FileInfoVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class LibreOfficeOfficePreviewService implements OfficePreviewService {

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
    private OfficePreviewProperties officePreviewProperties;

    @Autowired
    private FileConfig fileConfig;

    @Override
    public boolean supports(String fileName, String contentType) {
        return isOfficeType(extractExtension(fileName), normalizeContentType(contentType));
    }

    @Override
    public PreviewResource preparePreview(FileInfoVO fileInfo) throws IOException {
        if (!officePreviewProperties.isEnabled()) {
            throw new PreviewUnavailableException("Office 文档预览服务未启用");
        }
        if (fileInfo == null || fileInfo.getFilePath() == null || fileInfo.getFilePath().isBlank()) {
            throw new ResourceNotFoundException("文件不存在");
        }
        if (!supports(fileInfo.getOriginalName(), fileInfo.getFileType())) {
            throw new IllegalArgumentException("当前文件类型不支持 Office 预览");
        }

        Path sourceFile = Paths.get(fileInfo.getFilePath());
        if (!Files.exists(sourceFile) || !Files.isRegularFile(sourceFile)) {
            throw new ResourceNotFoundException("文件不存在");
        }

        Path cacheFile = resolveCacheFile(sourceFile);
        if (Files.exists(cacheFile) && Files.size(cacheFile) > 0) {
            return toPreviewResource(cacheFile, buildPreviewFileName(fileInfo.getOriginalName()));
        }

        return convertToPdf(sourceFile, cacheFile, fileInfo.getOriginalName());
    }

    private PreviewResource convertToPdf(Path sourceFile, Path cacheFile, String originalName) throws IOException {
        Path cacheDir = cacheFile.getParent();
        if (cacheDir == null) {
            throw new PreviewUnavailableException("Office 预览缓存目录无效");
        }
        Files.createDirectories(cacheDir);

        Path tempDir = Files.createTempDirectory(cacheDir, "lo-preview-");
        Path outputDir = Files.createDirectory(tempDir.resolve("output"));
        Path profileDir = Files.createDirectory(tempDir.resolve("profile"));
        Path logFile = tempDir.resolve("soffice.log");

        List<String> command = List.of(
                officePreviewProperties.getCommand(),
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                "-env:UserInstallation=" + profileDir.toUri(),
                "--convert-to",
                "pdf",
                "--outdir",
                outputDir.toAbsolutePath().toString(),
                sourceFile.toAbsolutePath().toString()
        );

        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectErrorStream(true);
            builder.redirectOutput(logFile.toFile());

            Process process = builder.start();
            boolean finished = process.waitFor(officePreviewProperties.getTimeoutSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new PreviewUnavailableException("Office 文档预览转换超时，请稍后重试");
            }

            Path generatedPdf = outputDir.resolve(buildPreviewFileName(sourceFile.getFileName().toString()));
            String processLog = readProcessLog(logFile);
            if (process.exitValue() != 0 || !Files.exists(generatedPdf) || Files.size(generatedPdf) == 0) {
                log.error("LibreOffice preview conversion failed. exitCode={}, source={}, log={}",
                        process.exitValue(), sourceFile, processLog);
                throw new PreviewUnavailableException("Office 文档预览转换失败，请稍后重试或直接下载");
            }

            moveToCache(generatedPdf, cacheFile);
            return toPreviewResource(cacheFile, buildPreviewFileName(originalName));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new PreviewUnavailableException("Office 文档预览转换被中断，请稍后重试", ex);
        } catch (IOException ex) {
            log.error("LibreOffice preview conversion unavailable. command={}, source={}", command, sourceFile, ex);
            throw new PreviewUnavailableException("Office 文档预览暂时不可用，请检查 LibreOffice / soffice 配置", ex);
        } finally {
            deleteRecursively(tempDir);
        }
    }

    private PreviewResource toPreviewResource(Path pdfFile, String previewFileName) throws IOException {
        return new PreviewResource(
                pdfFile,
                "application/pdf",
                previewFileName,
                Files.size(pdfFile)
        );
    }

    private Path resolveCacheFile(Path sourceFile) throws IOException {
        long size = Files.size(sourceFile);
        long lastModified = Files.getLastModifiedTime(sourceFile).toMillis();
        String cacheKey = DigestUtil.sha256Hex(sourceFile.toAbsolutePath().normalize() + ":" + size + ":" + lastModified);
        return resolveCacheDir().resolve(cacheKey + ".pdf");
    }

    private Path resolveCacheDir() {
        String configuredCacheDir = officePreviewProperties.getCacheDir();
        if (configuredCacheDir != null && !configuredCacheDir.isBlank()) {
            return Paths.get(configuredCacheDir);
        }
        return Paths.get(fileConfig.getUploadDir(), ".preview-cache");
    }

    private void moveToCache(Path generatedPdf, Path cacheFile) throws IOException {
        try {
            Files.move(generatedPdf, cacheFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(generatedPdf, cacheFile, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void deleteRecursively(Path directory) {
        if (directory == null || !Files.exists(directory)) {
            return;
        }

        try (var stream = Files.walk(directory)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ex) {
                    log.warn("Failed to clean temp preview path: {}", path, ex);
                }
            });
        } catch (IOException ex) {
            log.warn("Failed to clean temp preview directory: {}", directory, ex);
        }
    }

    private String readProcessLog(Path logFile) {
        if (!Files.exists(logFile)) {
            return "";
        }

        try {
            return Files.readString(logFile).trim();
        } catch (IOException ex) {
            return "";
        }
    }

    private boolean isOfficeType(String extension, String contentType) {
        return OFFICE_EXTENSIONS.contains(extension) || OFFICE_MIME_TYPES.contains(contentType);
    }

    private String buildPreviewFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "preview.pdf";
        }

        int dotIndex = fileName.lastIndexOf('.');
        String baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
        return baseName + ".pdf";
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

        String normalized = contentType.trim().toLowerCase(Locale.ROOT);
        int semicolonIndex = normalized.indexOf(';');
        return semicolonIndex >= 0 ? normalized.substring(0, semicolonIndex).trim() : normalized;
    }
}
