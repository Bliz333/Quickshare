package com.finalpre.quickshare.service.preview;

import com.finalpre.quickshare.common.FeatureDisabledException;
import com.finalpre.quickshare.common.PreviewUnavailableException;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.vo.FileInfoVO;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

@Service
public class DefaultPreviewDelivery implements PreviewDelivery {

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final FilePreviewPolicyService filePreviewPolicyService;
    private final OfficePreviewService officePreviewService;

    public DefaultPreviewDelivery(FilePreviewPolicyService filePreviewPolicyService,
                                  OfficePreviewService officePreviewService) {
        this.filePreviewPolicyService = filePreviewPolicyService;
        this.officePreviewService = officePreviewService;
    }

    @Override
    public PreparedPreview open(PreviewSource source, PreviewOptions options) throws IOException {
        Objects.requireNonNull(options, "options");
        if (source == null || !source.exists()) {
            throw new ResourceNotFoundException("文件不存在");
        }

        String fileName = normalizeFileName(source.fileName());
        String contentType = normalizeContentType(source.contentType());
        if (!filePreviewPolicyService.isPreviewAllowed(fileName, contentType)) {
            throw new FeatureDisabledException("当前文件类型不允许预览");
        }

        if (officePreviewService.supports(fileName, contentType)) {
            return openOfficePreview(source, options, fileName, contentType);
        }

        if (contentType.startsWith("image/") && options.thumbnailRequested()) {
            PreparedPreview thumbnail = tryOpenThumbnail(source, options, fileName, contentType);
            if (thumbnail != null) {
                return thumbnail;
            }
        }

        return new PreparedPreview(
                fileName,
                contentType,
                source.contentLength(),
                options.cacheControl(),
                source.openStream()
        );
    }

    private PreparedPreview openOfficePreview(PreviewSource source,
                                              PreviewOptions options,
                                              String fileName,
                                              String contentType) throws IOException {
        try {
            FileInfoVO fileInfo = new FileInfoVO();
            fileInfo.setOriginalName(fileName);
            fileInfo.setFileType(contentType);
            fileInfo.setFilePath(source.localPath().toString());
            fileInfo.setFileSize(source.contentLength());

            PreviewResource preview = officePreviewService.preparePreview(fileInfo);
            return new PreparedPreview(
                    normalizeFileName(preview.fileName()),
                    normalizeContentType(preview.contentType()),
                    preview.contentLength(),
                    options.cacheControl(),
                    Files.newInputStream(preview.file())
            );
        } catch (PreviewUnavailableException | ResourceNotFoundException | IllegalArgumentException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new PreviewUnavailableException("Office 文档转换失败，请直接下载", ex);
        }
    }

    private PreparedPreview tryOpenThumbnail(PreviewSource source,
                                             PreviewOptions options,
                                             String fileName,
                                             String contentType) {
        Path thumbnailFile = null;
        try {
            thumbnailFile = Files.createTempFile("quickshare-thumbnail-", ".tmp");
            try (OutputStream output = Files.newOutputStream(thumbnailFile)) {
                Thumbnails.of(source.localPath().toFile())
                        .size(options.maxSize(), options.maxSize())
                        .outputQuality(0.8f)
                        .toOutputStream(output);
            }

            long contentLength = Files.size(thumbnailFile);
            InputStream content = new DeleteOnCloseInputStream(Files.newInputStream(thumbnailFile), thumbnailFile);
            return new PreparedPreview(
                    fileName,
                    contentType,
                    contentLength,
                    options.cacheControl(),
                    content
            );
        } catch (Exception ignored) {
            deleteQuietly(thumbnailFile);
            return null;
        }
    }

    private void deleteQuietly(Path file) {
        if (file == null) {
            return;
        }
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
            // A failed thumbnail is already falling back to the original source.
        }
    }

    private String normalizeFileName(String fileName) {
        return fileName == null || fileName.isBlank() ? "preview" : fileName;
    }

    private String normalizeContentType(String contentType) {
        return contentType == null || contentType.isBlank() ? DEFAULT_CONTENT_TYPE : contentType.trim();
    }

    private static final class DeleteOnCloseInputStream extends FilterInputStream {

        private final Path file;
        private boolean closed;

        private DeleteOnCloseInputStream(InputStream input, Path file) {
            super(input);
            this.file = file;
        }

        @Override
        public void close() throws IOException {
            if (closed) {
                return;
            }
            closed = true;

            IOException failure = null;
            try {
                super.close();
            } catch (IOException ex) {
                failure = ex;
            }
            try {
                Files.deleteIfExists(file);
            } catch (IOException ex) {
                if (failure == null) {
                    failure = ex;
                } else {
                    failure.addSuppressed(ex);
                }
            }
            if (failure != null) {
                throw failure;
            }
        }
    }
}
