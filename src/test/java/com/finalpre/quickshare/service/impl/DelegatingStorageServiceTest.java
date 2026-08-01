package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.LocalPathLease;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.StoragePolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DelegatingStorageServiceTest {

    private final StoragePolicyService s3Policy = () -> new StoragePolicy(
            "s3",
            "https://s3.example.test",
            "access-key",
            "secret-key",
            "bucket",
            "us-east-1",
            true
    );

    @Test
    void s3LocalPathLeaseShouldDeleteItsDownloadedCopy() throws Exception {
        byte[] body = "remote content".getBytes();
        DelegatingStorageService storage = storageReturning(new ByteArrayInputStream(body));
        Path downloadedPath;

        try (LocalPathLease lease = storage.acquireLocalPath("report.docx")) {
            downloadedPath = lease.path();
            assertThat(downloadedPath.getFileName().toString()).startsWith("qs-s3-");
            assertThat(Files.readAllBytes(downloadedPath)).isEqualTo(body);
        }

        assertThat(downloadedPath).doesNotExist();
    }

    @Test
    void failedS3DownloadShouldDeleteItsPartialCopy() throws Exception {
        String storageKey = "failed-" + UUID.randomUUID() + ".bin";
        DelegatingStorageService storage = storageReturning(new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("download failed");
            }
        });

        assertThatThrownBy(() -> storage.acquireLocalPath(storageKey))
                .isInstanceOf(IOException.class)
                .hasMessage("download failed");

        try (Stream<Path> temporaryFiles = Files.list(Path.of(System.getProperty("java.io.tmpdir")))) {
            assertThat(temporaryFiles
                    .filter(path -> path.getFileName().toString().endsWith("-" + storageKey)))
                    .isEmpty();
        }
    }

    private DelegatingStorageService storageReturning(InputStream content) {
        DelegatingStorageService storage = new DelegatingStorageService() {
            @Override
            public InputStream retrieve(String storageKey) {
                return content;
            }
        };
        ReflectionTestUtils.setField(storage, "storagePolicyService", s3Policy);
        return storage;
    }
}
