package com.finalpre.quickshare.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;

/**
 * Abstraction for file storage backends (local filesystem, S3-compatible, etc.).
 * All methods work with storage keys (relative paths like "abc123.docx").
 */
public interface StorageService {

    /**
     * Store a file and return the storage key.
     */
    String store(String fileName, InputStream content, long size) throws IOException;

    /**
     * Retrieve a file as an InputStream.
     */
    InputStream retrieve(String storageKey) throws IOException;

    /**
     * Delete a file.
     */
    void delete(String storageKey) throws IOException;

    /**
     * Check if a file exists.
     */
    boolean exists(String storageKey);

    /**
     * Get file size in bytes.
     */
    long getSize(String storageKey) throws IOException;

    /**
     * Get a local Path for the file. For local storage this is the actual path;
     * for remote storage, this downloads to a temporary file.
     * Caller should NOT delete the returned path (it may be the real file).
     */
    Path getLocalPath(String storageKey) throws IOException;
}
