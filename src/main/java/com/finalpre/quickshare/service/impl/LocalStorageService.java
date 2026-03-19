package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.service.StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Service
@ConditionalOnProperty(name = "storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    @Autowired
    private FileConfig fileConfig;

    @Override
    public String store(String fileName, InputStream content, long size) throws IOException {
        Path uploadDir = Paths.get(fileConfig.getUploadDir());
        Files.createDirectories(uploadDir);

        Path target = uploadDir.resolve(fileName);
        Files.copy(content, target);
        return fileName;
    }

    @Override
    public InputStream retrieve(String storageKey) throws IOException {
        Path filePath = resolve(storageKey);
        return new FileInputStream(filePath.toFile());
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Path filePath = resolve(storageKey);
        Files.deleteIfExists(filePath);
    }

    @Override
    public boolean exists(String storageKey) {
        return Files.exists(resolve(storageKey));
    }

    @Override
    public long getSize(String storageKey) throws IOException {
        return Files.size(resolve(storageKey));
    }

    @Override
    public Path getLocalPath(String storageKey) {
        return resolve(storageKey);
    }

    private Path resolve(String storageKey) {
        // Support both bare file names and full paths (backward compatibility)
        Path path = Paths.get(storageKey);
        if (path.isAbsolute()) {
            return path;
        }
        return Paths.get(fileConfig.getUploadDir()).resolve(storageKey);
    }
}
