package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocalStorageRuntimeInspectorTest {

    @Mock
    private FileConfig fileConfig;

    @InjectMocks
    private LocalStorageRuntimeInspector localStorageRuntimeInspector;

    @Test
    void resolveShouldKeepMissingUploadDirMissing(@TempDir Path tempDir) {
        Path uploadDir = tempDir.resolve("missing").resolve("uploads");
        when(fileConfig.getConfiguredUploadDir()).thenReturn(uploadDir.toString());

        var result = localStorageRuntimeInspector.resolve();

        assertThat(result).isNotNull();
        assertThat(result.uploadDir()).isEqualTo(uploadDir.toAbsolutePath().normalize().toString());
        assertThat(result.uploadDirExists()).isFalse();
        assertThat(result.diskTotalBytes()).isGreaterThan(0L);
        assertThat(result.diskUsableBytes()).isGreaterThan(0L);
        assertThat(result.diskUsablePercent()).isGreaterThan(0.0);
        assertThat(result.diskRiskLevel()).isEqualTo("healthy");
    }

    @Test
    void resolveDiskRiskLevelShouldClassifyCapacityThresholds() {
        assertThat(LocalStorageRuntimeInspector.resolveDiskRiskLevel(100L, 4L)).isEqualTo("critical");
        assertThat(LocalStorageRuntimeInspector.resolveDiskRiskLevel(100L, 15L)).isEqualTo("warning");
        assertThat(LocalStorageRuntimeInspector.resolveDiskRiskLevel(100L, 16L)).isEqualTo("healthy");
        assertThat(LocalStorageRuntimeInspector.resolveDiskRiskLevel(0L, 0L)).isEqualTo("unknown");
    }

    @Test
    void calculateUsablePercentShouldRoundToSingleDecimal() {
        assertThat(LocalStorageRuntimeInspector.calculateUsablePercent(1_000L, 123L)).isEqualTo(12.3);
    }
}
