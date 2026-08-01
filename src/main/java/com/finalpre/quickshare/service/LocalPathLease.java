package com.finalpre.quickshare.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

public final class LocalPathLease implements AutoCloseable {

    private final Path path;
    private final boolean deleteOnClose;
    private boolean closed;

    private LocalPathLease(Path path, boolean deleteOnClose) {
        this.path = Objects.requireNonNull(path, "path");
        this.deleteOnClose = deleteOnClose;
    }

    public static LocalPathLease borrowed(Path path) {
        return new LocalPathLease(path, false);
    }

    public static LocalPathLease owned(Path path) {
        return new LocalPathLease(path, true);
    }

    public Path path() {
        return path;
    }

    @Override
    public void close() throws IOException {
        if (closed) {
            return;
        }
        closed = true;
        if (deleteOnClose) {
            Files.deleteIfExists(path);
        }
    }
}
