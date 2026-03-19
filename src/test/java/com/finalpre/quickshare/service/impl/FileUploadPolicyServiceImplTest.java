package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileUploadPolicyServiceImplTest {

    @Mock
    private FileConfig fileConfig;

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private FileUploadPolicyServiceImpl fileUploadPolicyService;

    @Test
    void getPolicyShouldUseStoredOverrideWhenPresent() {
        when(systemSettingOverrideService.getFileUploadPolicy())
                .thenReturn(Optional.of(new FileUploadPolicy(false, 2048L, List.of(".PDF", " docx "))));

        FileUploadPolicy policy = fileUploadPolicyService.getPolicy();

        assertThat(policy.guestUploadEnabled()).isFalse();
        assertThat(policy.maxFileSizeBytes()).isEqualTo(2048L);
        assertThat(policy.allowedExtensions()).containsExactly("pdf", "docx");
    }

    @Test
    void getPolicyShouldFallbackToFileConfigWhenOverrideMissing() {
        when(systemSettingOverrideService.getFileUploadPolicy()).thenReturn(Optional.empty());
        when(fileConfig.getMaxFileSize()).thenReturn(4096L);
        when(fileConfig.getAllowedTypes()).thenReturn(List.of("jpg", "png"));

        FileUploadPolicy policy = fileUploadPolicyService.getPolicy();

        assertThat(policy.guestUploadEnabled()).isTrue();
        assertThat(policy.maxFileSizeBytes()).isEqualTo(4096L);
        assertThat(policy.allowedExtensions()).containsExactly("jpg", "png");
    }

    @Test
    void getHardMaxFileSizeBytesShouldDelegateToFileConfig() {
        when(fileConfig.getServletMaxFileSizeBytes()).thenReturn(10_000L);

        long hardLimit = fileUploadPolicyService.getHardMaxFileSizeBytes();

        assertThat(hardLimit).isEqualTo(10_000L);
    }
}
