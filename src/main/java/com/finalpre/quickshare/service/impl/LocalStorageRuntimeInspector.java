package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.service.LocalStorageRuntimeInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Component
@RequiredArgsConstructor
public class LocalStorageRuntimeInspector {

    static final double WARNING_USABLE_PERCENT = 15.0;
    static final double CRITICAL_USABLE_PERCENT = 5.0;

    private final FileConfig fileConfig;

    public LocalStorageRuntimeInfo resolve() {
        String configuredUploadDir = fileConfig == null ? null : fileConfig.getConfiguredUploadDir();
        if (configuredUploadDir == null || configuredUploadDir.isBlank()) {
            return null;
        }

        Path uploadDir = Paths.get(configuredUploadDir).toAbsolutePath().normalize();
        boolean uploadDirExists = Files.exists(uploadDir);
        Long diskTotalBytes = null;
        Long diskUsableBytes = null;

        Path statsPath = findNearestExistingPath(uploadDir);
        if (statsPath != null) {
            try {
                var fileStore = Files.getFileStore(statsPath);
                diskTotalBytes = fileStore.getTotalSpace();
                diskUsableBytes = fileStore.getUsableSpace();
            } catch (IOException ex) {
                log.warn("Failed to resolve local storage capacity for {}", uploadDir, ex);
            }
        }

        Double diskUsablePercent = calculateUsablePercent(diskTotalBytes, diskUsableBytes);
        return new LocalStorageRuntimeInfo(
                uploadDir.toString(),
                uploadDirExists,
                diskTotalBytes,
                diskUsableBytes,
                diskUsablePercent,
                resolveDiskRiskLevel(diskTotalBytes, diskUsableBytes)
        );
    }

    static Double calculateUsablePercent(Long totalBytes, Long usableBytes) {
        if (totalBytes == null || usableBytes == null || totalBytes <= 0 || usableBytes < 0) {
            return null;
        }

        double percent = (usableBytes * 100.0) / totalBytes;
        return Math.round(percent * 10.0) / 10.0;
    }

    static String resolveDiskRiskLevel(Long totalBytes, Long usableBytes) {
        Double usablePercent = calculateUsablePercent(totalBytes, usableBytes);
        if (usablePercent == null) {
            return "unknown";
        }
        if (usablePercent <= CRITICAL_USABLE_PERCENT) {
            return "critical";
        }
        if (usablePercent <= WARNING_USABLE_PERCENT) {
            return "warning";
        }
        return "healthy";
    }

    private Path findNearestExistingPath(Path path) {
        Path current = path;
        while (current != null) {
            if (Files.exists(current)) {
                return current;
            }
            current = current.getParent();
        }
        return null;
    }
}
