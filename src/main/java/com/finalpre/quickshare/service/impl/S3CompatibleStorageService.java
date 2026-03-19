package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.S3StorageProperties;
import com.finalpre.quickshare.service.StorageService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * S3-compatible storage backend. Works with AWS S3, MinIO, Cloudflare R2,
 * and any other S3-compatible service.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "storage.type", havingValue = "s3")
public class S3CompatibleStorageService implements StorageService {

    @Autowired
    private S3StorageProperties properties;

    private S3Client s3Client;

    @PostConstruct
    public void init() {
        S3ClientBuilder builder = S3Client.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())))
                .region(Region.of(properties.getRegion()));

        if (properties.getEndpoint() != null && !properties.getEndpoint().isBlank()) {
            builder.endpointOverride(URI.create(properties.getEndpoint()));
        }

        if (properties.isPathStyleAccess()) {
            builder.serviceConfiguration(S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .build());
        }

        this.s3Client = builder.build();
        log.info("S3-compatible storage initialized. endpoint={}, bucket={}, region={}",
                properties.getEndpoint(), properties.getBucket(), properties.getRegion());
    }

    @Override
    public String store(String fileName, InputStream content, long size) throws IOException {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(fileName)
                .build();

        s3Client.putObject(request, RequestBody.fromInputStream(content, size));
        return fileName;
    }

    @Override
    public InputStream retrieve(String storageKey) throws IOException {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(storageKey)
                .build();

        return s3Client.getObject(request);
    }

    @Override
    public void delete(String storageKey) throws IOException {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(storageKey)
                .build();

        s3Client.deleteObject(request);
    }

    @Override
    public boolean exists(String storageKey) {
        try {
            s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(storageKey)
                    .build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public long getSize(String storageKey) throws IOException {
        HeadObjectResponse response = s3Client.headObject(HeadObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(storageKey)
                .build());
        return response.contentLength();
    }

    @Override
    public Path getLocalPath(String storageKey) throws IOException {
        // Download to temp file for operations that need local filesystem access
        // (e.g. LibreOffice conversion, thumbnail generation)
        Path tempFile = Files.createTempFile("qs-s3-", "-" + extractFileName(storageKey));
        try (InputStream is = retrieve(storageKey)) {
            Files.copy(is, tempFile, StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile;
    }

    private String extractFileName(String key) {
        int lastSlash = key.lastIndexOf('/');
        return lastSlash >= 0 ? key.substring(lastSlash + 1) : key;
    }
}
