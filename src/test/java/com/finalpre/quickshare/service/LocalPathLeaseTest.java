package com.finalpre.quickshare.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class LocalPathLeaseTest {

    @TempDir
    Path tempDir;

    @Test
    void borrowedLeaseShouldPreserveTheLocalFile() throws Exception {
        Path localFile = Files.writeString(tempDir.resolve("local.txt"), "local");

        try (LocalPathLease lease = LocalPathLease.borrowed(localFile)) {
            assertThat(lease.path()).isEqualTo(localFile);
        }

        assertThat(localFile).exists();
    }

    @Test
    void ownedLeaseShouldDeleteTheTemporaryFileOnce() throws Exception {
        Path temporaryFile = Files.writeString(tempDir.resolve("remote-copy.txt"), "temporary");
        LocalPathLease lease = LocalPathLease.owned(temporaryFile);

        lease.close();
        lease.close();

        assertThat(temporaryFile).doesNotExist();
    }
}
