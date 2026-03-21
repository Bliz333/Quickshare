package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.service.LocalStorageRuntimeInfo;
import com.finalpre.quickshare.service.StoragePolicyService;
import com.finalpre.quickshare.service.impl.DelegatingStorageService;
import com.finalpre.quickshare.service.impl.LocalStorageRuntimeInspector;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class HealthController {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private StoragePolicyService storagePolicyService;

    @Autowired
    private LocalStorageRuntimeInspector localStorageRuntimeInspector;

    @Autowired
    private DelegatingStorageService delegatingStorageService;

    @GetMapping("/health")
    public Result<Map<String, Object>> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "UP");

        // Database check
        try (Connection conn = dataSource.getConnection()) {
            status.put("database", conn.isValid(3) ? "UP" : "DOWN");
        } catch (Exception e) {
            status.put("database", "DOWN: " + e.getMessage());
        }

        // Redis check
        try {
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            status.put("redis", pong != null ? "UP" : "DOWN");
        } catch (Exception e) {
            status.put("redis", "DOWN: " + e.getMessage());
        }

        // Storage check
        try {
            var policy = storagePolicyService.getPolicy();
            status.put("storage", policy.isS3() ? "s3" : "local");
            if (policy.isLocal()) {
                status.put("storageConnectionStatus", "local");
                populateLocalStorageMetrics(status);
            } else {
                populateS3StorageMetrics(status, policy);
            }
        } catch (Exception e) {
            status.put("storage", "UNKNOWN");
        }

        boolean allUp = "UP".equals(status.get("database")) && "UP".equals(status.get("redis"));
        status.put("status", allUp ? "UP" : "DEGRADED");

        return Result.success(status);
    }

    private void populateLocalStorageMetrics(Map<String, Object> status) {
        LocalStorageRuntimeInfo runtimeInfo = localStorageRuntimeInspector == null ? null : localStorageRuntimeInspector.resolve();
        if (runtimeInfo == null) {
            return;
        }

        status.put("storageUploadDir", runtimeInfo.uploadDir());
        status.put("storageUploadDirExists", runtimeInfo.uploadDirExists());
        status.put("storageDiskTotalBytes", runtimeInfo.diskTotalBytes());
        status.put("storageDiskUsableBytes", runtimeInfo.diskUsableBytes());
        status.put("storageDiskUsablePercent", runtimeInfo.diskUsablePercent());
        status.put("storageDiskRiskLevel", runtimeInfo.diskRiskLevel());
    }

    private void populateS3StorageMetrics(Map<String, Object> status, com.finalpre.quickshare.service.StoragePolicy policy) {
        status.put("storageEndpoint", policy.s3Endpoint());
        status.put("storageBucket", policy.s3Bucket());

        if (!policy.hasS3Config()) {
            status.put("storageConnectionStatus", "not_configured");
            return;
        }

        String err = delegatingStorageService == null ? "s3_test_unavailable" : delegatingStorageService.testS3Connection(policy);
        status.put("storageConnectionStatus", err == null ? "connected" : "error: " + err);
    }
}
