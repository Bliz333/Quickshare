package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.AdminCorsPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminConsoleAccessUpdateRequest;
import com.finalpre.quickshare.dto.AdminFilePreviewPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFileUploadPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminRegistrationSettingsUpdateRequest;
import com.finalpre.quickshare.dto.AdminRateLimitPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminEmailTemplateUpdateRequest;
import com.finalpre.quickshare.dto.AdminSmtpPolicyUpdateRequest;
import com.finalpre.quickshare.vo.AdminConsoleAccessVO;
import com.finalpre.quickshare.vo.AdminEmailTemplateVO;
import com.finalpre.quickshare.vo.AdminCorsPolicyVO;
import com.finalpre.quickshare.vo.AdminFilePreviewPolicyVO;
import com.finalpre.quickshare.vo.AdminFileUploadPolicyVO;
import com.finalpre.quickshare.vo.AdminRegistrationSettingsVO;
import com.finalpre.quickshare.vo.AdminRateLimitPolicyVO;
import com.finalpre.quickshare.vo.AdminSmtpPolicyVO;

import java.util.List;

public interface AdminPolicyService {

    List<AdminRateLimitPolicyVO> getRateLimitPolicies();

    void updateRateLimitPolicy(String scene, AdminRateLimitPolicyUpdateRequest request);

    AdminConsoleAccessVO getAdminConsoleAccess();

    void updateAdminConsoleAccess(AdminConsoleAccessUpdateRequest request);

    AdminRegistrationSettingsVO getRegistrationSettings();

    void updateRegistrationSettings(AdminRegistrationSettingsUpdateRequest request);

    AdminFileUploadPolicyVO getFileUploadPolicy();

    void updateFileUploadPolicy(AdminFileUploadPolicyUpdateRequest request);

    AdminFilePreviewPolicyVO getFilePreviewPolicy();

    void updateFilePreviewPolicy(AdminFilePreviewPolicyUpdateRequest request);

    AdminCorsPolicyVO getCorsPolicy();

    void updateCorsPolicy(AdminCorsPolicyUpdateRequest request);

    AdminSmtpPolicyVO getSmtpPolicy();

    void updateSmtpPolicy(AdminSmtpPolicyUpdateRequest request);

    void sendTestEmail(String toEmail);

    List<AdminEmailTemplateVO> getEmailTemplates();

    void updateEmailTemplate(String templateType, AdminEmailTemplateUpdateRequest request);
}
