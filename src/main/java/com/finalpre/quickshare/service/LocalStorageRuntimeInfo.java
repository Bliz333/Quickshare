package com.finalpre.quickshare.service;

public record LocalStorageRuntimeInfo(
        String uploadDir,
        boolean uploadDirExists,
        Long diskTotalBytes,
        Long diskUsableBytes,
        Double diskUsablePercent,
        String diskRiskLevel
) {
}
