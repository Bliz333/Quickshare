package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.StoragePolicyService;
import com.finalpre.quickshare.service.StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;

import java.io.*;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Delegates to local or S3 storage based on current StoragePolicy.
 * S3 client is lazily initialized and refreshed when config changes.
 */
@Slf4j
@Primary
@Service
public class DelegatingStorageService implements StorageService {

    @Autowired
    private StoragePolicyService storagePolicyService;

    @Autowired
    private FileConfig fileConfig;

    private final AtomicReference<S3ClientHolder> s3Holder = new AtomicReference<>();

    @Override
    public String store(String fileName, InputStream content, long size) throws IOException {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            S3Client client = getOrCreateS3Client(policy);
            client.putObject(
                    PutObjectRequest.builder().bucket(policy.s3Bucket()).key(fileName).build(),
                    RequestBody.fromInputStream(content, size));
            return fileName;
        }
        return storeLocal(fileName, content);
    }

    @Override
    public InputStream retrieve(String storageKey) throws IOException {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            S3Client client = getOrCreateS3Client(policy);
            return client.getObject(GetObjectRequest.builder()
                    .bucket(policy.s3Bucket()).key(storageKey).build());
        }
        return new FileInputStream(resolveLocal(storageKey).toFile());
    }

    @Override
    public void delete(String storageKey) throws IOException {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            S3Client client = getOrCreateS3Client(policy);
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(policy.s3Bucket()).key(storageKey).build());
            return;
        }
        Files.deleteIfExists(resolveLocal(storageKey));
    }

    @Override
    public boolean exists(String storageKey) {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            try {
                S3Client client = getOrCreateS3Client(policy);
                client.headObject(HeadObjectRequest.builder()
                        .bucket(policy.s3Bucket()).key(storageKey).build());
                return true;
            } catch (NoSuchKeyException e) {
                return false;
            }
        }
        return Files.exists(resolveLocal(storageKey));
    }

    @Override
    public long getSize(String storageKey) throws IOException {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            S3Client client = getOrCreateS3Client(policy);
            return client.headObject(HeadObjectRequest.builder()
                    .bucket(policy.s3Bucket()).key(storageKey).build()).contentLength();
        }
        return Files.size(resolveLocal(storageKey));
    }

    @Override
    public Path getLocalPath(String storageKey) throws IOException {
        StoragePolicy policy = storagePolicyService.getPolicy();
        if (policy.isS3() && policy.hasS3Config()) {
            Path tempFile = Files.createTempFile("qs-s3-", "-" + extractFileName(storageKey));
            try (InputStream is = retrieve(storageKey)) {
                Files.copy(is, tempFile, StandardCopyOption.REPLACE_EXISTING);
            }
            return tempFile;
        }
        return resolveLocal(storageKey);
    }

    /**
     * Test S3 connection with given policy (used by admin panel).
     * Returns null on success, error message on failure.
     */
    public String testS3Connection(StoragePolicy policy) {
        if (!policy.hasS3Config()) {
            return "S3 配置不完整";
        }
        try {
            S3Client client = buildS3Client(policy);
            client.headBucket(HeadBucketRequest.builder().bucket(policy.s3Bucket()).build());
            return null; // success
        } catch (Exception e) {
            return e.getMessage();
        }
    }

    // --- Local storage helpers ---

    private String storeLocal(String fileName, InputStream content) throws IOException {
        Path uploadDir = Paths.get(fileConfig.getUploadDir());
        Files.createDirectories(uploadDir);
        Path target = uploadDir.resolve(fileName);
        Files.copy(content, target);
        return fileName;
    }

    private Path resolveLocal(String storageKey) {
        Path path = Paths.get(storageKey);
        if (path.isAbsolute()) return path;
        return Paths.get(fileConfig.getUploadDir()).resolve(storageKey);
    }

    // --- S3 client management ---

    private S3Client getOrCreateS3Client(StoragePolicy policy) {
        S3ClientHolder current = s3Holder.get();
        String configFingerprint = policy.s3Endpoint() + "|" + policy.s3AccessKey() + "|"
                + policy.s3Bucket() + "|" + policy.s3Region();

        if (current != null && Objects.equals(current.fingerprint, configFingerprint)) {
            return current.client;
        }

        S3Client newClient = buildS3Client(policy);
        s3Holder.set(new S3ClientHolder(newClient, configFingerprint));
        log.info("S3 client initialized/refreshed. endpoint={}, bucket={}", policy.s3Endpoint(), policy.s3Bucket());

        if (current != null) {
            try { current.client.close(); } catch (Exception ignored) {}
        }

        return newClient;
    }

    private S3Client buildS3Client(StoragePolicy policy) {
        S3ClientBuilder builder = S3Client.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(policy.s3AccessKey(), policy.s3SecretKey())))
                .region(Region.of(policy.s3Region() != null ? policy.s3Region() : "auto"));

        if (policy.s3Endpoint() != null && !policy.s3Endpoint().isBlank()) {
            builder.endpointOverride(URI.create(policy.s3Endpoint()));
        }
        if (policy.s3PathStyleAccess()) {
            builder.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }

        return builder.build();
    }

    private String extractFileName(String key) {
        int lastSlash = key.lastIndexOf('/');
        return lastSlash >= 0 ? key.substring(lastSlash + 1) : key;
    }

    private record S3ClientHolder(S3Client client, String fingerprint) {}
}
