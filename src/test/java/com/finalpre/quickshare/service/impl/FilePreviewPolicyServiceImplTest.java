package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FilePreviewProperties;
import com.finalpre.quickshare.service.FilePreviewPolicy;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FilePreviewPolicyServiceImplTest {

    @Mock
    private SystemSettingOverrideService systemSettingOverrideService;

    @InjectMocks
    private FilePreviewPolicyServiceImpl filePreviewPolicyService;

    @BeforeEach
    void setUp() {
        FilePreviewProperties properties = new FilePreviewProperties();
        properties.setOfficeEnabled(false);
        properties.setAllowedExtensions("pdf, txt ,png");
        ReflectionTestUtils.setField(filePreviewPolicyService, "filePreviewProperties", properties);
    }

    @Test
    void getPolicyShouldUseStoredOverrideWhenPresent() {
        when(systemSettingOverrideService.getFilePreviewPolicy())
                .thenReturn(Optional.of(new FilePreviewPolicy(
                        true, true, true, false, true, true, true, List.of(".DOCX", " pptx ")
                )));

        FilePreviewPolicy policy = filePreviewPolicyService.getPolicy();

        assertThat(policy.audioEnabled()).isFalse();
        assertThat(policy.officeEnabled()).isTrue();
        assertThat(policy.allowedExtensions()).containsExactly("docx", "pptx");
    }

    @Test
    void getPolicyShouldFallbackToPropertiesWhenOverrideMissing() {
        when(systemSettingOverrideService.getFilePreviewPolicy()).thenReturn(Optional.empty());

        FilePreviewPolicy policy = filePreviewPolicyService.getPolicy();

        assertThat(policy.enabled()).isTrue();
        assertThat(policy.officeEnabled()).isFalse();
        assertThat(policy.allowedExtensions()).containsExactly("pdf", "txt", "png");
    }

    @Test
    void isPreviewAllowedShouldRespectCategorySwitchAndAllowlist() {
        when(systemSettingOverrideService.getFilePreviewPolicy())
                .thenReturn(Optional.of(new FilePreviewPolicy(
                        true, true, true, true, true, true, true, List.of("pdf", "docx")
                )));

        assertThat(filePreviewPolicyService.isPreviewAllowed("report.docx", "application/octet-stream")).isTrue();
        assertThat(filePreviewPolicyService.isPreviewAllowed("song.mp3", "audio/mpeg")).isFalse();
    }
}
