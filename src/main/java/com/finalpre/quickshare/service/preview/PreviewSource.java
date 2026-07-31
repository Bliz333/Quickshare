package com.finalpre.quickshare.service.preview;

import com.finalpre.quickshare.service.StorageService;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

public interface PreviewSource {

    String fileName();

    String contentType();

    boolean exists();

    long contentLength() throws IOException;

    InputStream openStream() throws IOException;

    Path localPath() throws IOException;

    static PreviewSource stored(StorageService storageService,
                                String storageKey,
                                String fileName,
                                String contentType,
                                Long declaredLength) {
        return new StorageAdapter(storageService, storageKey, fileName, contentType, declaredLength);
    }

    static PreviewSource local(Path path,
                               String fileName,
                               String contentType,
                               Long declaredLength) {
        return new LocalPathAdapter(path, fileName, contentType, declaredLength);
    }
}

final class StorageAdapter implements PreviewSource {

    private final StorageService storageService;
    private final String storageKey;
    private final String fileName;
    private final String contentType;
    private final Long declaredLength;

    StorageAdapter(StorageService storageService,
                   String storageKey,
                   String fileName,
                   String contentType,
                   Long declaredLength) {
        this.storageService = Objects.requireNonNull(storageService, "storageService");
        this.storageKey = storageKey;
        this.fileName = fileName;
        this.contentType = contentType;
        this.declaredLength = declaredLength;
    }

    @Override
    public String fileName() {
        return fileName;
    }

    @Override
    public String contentType() {
        return contentType;
    }

    @Override
    public boolean exists() {
        return storageKey != null && !storageKey.isBlank() && storageService.exists(storageKey);
    }

    @Override
    public long contentLength() throws IOException {
        return declaredLength != null && declaredLength >= 0
                ? declaredLength
                : storageService.getSize(storageKey);
    }

    @Override
    public InputStream openStream() throws IOException {
        return storageService.retrieve(storageKey);
    }

    @Override
    public Path localPath() throws IOException {
        return storageService.getLocalPath(storageKey);
    }
}

final class LocalPathAdapter implements PreviewSource {

    private final Path path;
    private final String fileName;
    private final String contentType;
    private final Long declaredLength;

    LocalPathAdapter(Path path,
                     String fileName,
                     String contentType,
                     Long declaredLength) {
        this.path = Objects.requireNonNull(path, "path");
        this.fileName = fileName;
        this.contentType = contentType;
        this.declaredLength = declaredLength;
    }

    @Override
    public String fileName() {
        return fileName;
    }

    @Override
    public String contentType() {
        return contentType;
    }

    @Override
    public boolean exists() {
        return Files.isRegularFile(path);
    }

    @Override
    public long contentLength() throws IOException {
        return declaredLength != null && declaredLength >= 0 ? declaredLength : Files.size(path);
    }

    @Override
    public InputStream openStream() throws IOException {
        return Files.newInputStream(path);
    }

    @Override
    public Path localPath() {
        return path;
    }
}
