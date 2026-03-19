package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.S3StorageProperties;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.StoragePolicyService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StoragePolicyServiceImpl implements StoragePolicyService {

    @Value("${storage.type:local}")
    private String defaultType;

    @Autowired
    private S3StorageProperties s3Props;

    @Autowired
    private SystemSettingOverrideService systemSettingOverrideService;

    @Override
    public StoragePolicy getPolicy() {
        var override = systemSettingOverrideService.getStoragePolicy();
        if (override != null && override.isPresent()) {
            return override.get();
        }

        return new StoragePolicy(
                defaultType,
                s3Props.getEndpoint(),
                s3Props.getAccessKey(),
                s3Props.getSecretKey(),
                s3Props.getBucket(),
                s3Props.getRegion(),
                s3Props.isPathStyleAccess()
        );
    }
}
