package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.dto.AdminConsoleAccessUpdateRequest;
import com.finalpre.quickshare.dto.AdminCorsPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFilePreviewPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminFileUploadPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminRegistrationSettingsUpdateRequest;
import com.finalpre.quickshare.dto.AdminRateLimitPolicyUpdateRequest;
import com.finalpre.quickshare.dto.AdminUserRoleUpdateRequest;
import com.finalpre.quickshare.vo.AdminConsoleAccessVO;
import com.finalpre.quickshare.service.AdminPolicyService;
import com.finalpre.quickshare.service.AdminService;
import com.finalpre.quickshare.vo.AdminCorsPolicyVO;
import com.finalpre.quickshare.vo.AdminFileVO;
import com.finalpre.quickshare.vo.AdminFilePreviewPolicyVO;
import com.finalpre.quickshare.vo.AdminFileUploadPolicyVO;
import com.finalpre.quickshare.vo.AdminOverviewVO;
import com.finalpre.quickshare.vo.AdminRegistrationSettingsVO;
import com.finalpre.quickshare.vo.AdminRateLimitPolicyVO;
import com.finalpre.quickshare.vo.AdminShareVO;
import com.finalpre.quickshare.vo.UserVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private AdminPolicyService adminPolicyService;

    @GetMapping("/overview")
    public Result<AdminOverviewVO> getOverview() {
        return Result.success(adminService.getOverview());
    }

    @GetMapping("/users")
    public Result<List<UserVO>> getUsers() {
        return Result.success(adminService.getUsers());
    }

    @PostMapping("/users")
    public Result<UserVO> createUser(@RequestBody AdminCreateUserRequest request) {
        return Result.success(adminService.createUser(request));
    }

    @PutMapping("/users/{userId}/role")
    public Result<Void> updateUserRole(@PathVariable Long userId,
                                       @RequestBody AdminUserRoleUpdateRequest request) {
        if (request == null || request.getRole() == null || request.getRole().isBlank()) {
            throw new IllegalArgumentException("角色不能为空");
        }

        adminService.updateUserRole(userId, request.getRole());
        return Result.success();
    }

    @DeleteMapping("/users/{userId}")
    public Result<Void> deleteUser(@PathVariable Long userId, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long operatorUserId)) {
            throw new IllegalArgumentException("未获取到当前登录用户");
        }

        adminService.deleteUser(userId, operatorUserId);
        return Result.success();
    }

    @GetMapping("/files")
    public Result<List<AdminFileVO>> getFiles() {
        return Result.success(adminService.getFiles());
    }

    @DeleteMapping("/files/{fileId}")
    public Result<Void> deleteFile(@PathVariable Long fileId) {
        adminService.deleteFile(fileId);
        return Result.success();
    }

    @GetMapping("/shares")
    public Result<List<AdminShareVO>> getShares() {
        return Result.success(adminService.getShares());
    }

    @PutMapping("/shares/{shareId}/disable")
    public Result<Void> disableShare(@PathVariable Long shareId) {
        adminService.disableShare(shareId);
        return Result.success();
    }

    @GetMapping("/settings/rate-limits")
    public Result<List<AdminRateLimitPolicyVO>> getRateLimitPolicies() {
        return Result.success(adminPolicyService.getRateLimitPolicies());
    }

    @PutMapping("/settings/rate-limits/{scene}")
    public Result<Void> updateRateLimitPolicy(@PathVariable String scene,
                                              @RequestBody AdminRateLimitPolicyUpdateRequest request) {
        adminPolicyService.updateRateLimitPolicy(scene, request);
        return Result.success();
    }

    @GetMapping("/settings/admin-console")
    public Result<AdminConsoleAccessVO> getAdminConsoleAccess() {
        return Result.success(adminPolicyService.getAdminConsoleAccess());
    }

    @PutMapping("/settings/admin-console")
    public Result<Void> updateAdminConsoleAccess(@RequestBody AdminConsoleAccessUpdateRequest request) {
        adminPolicyService.updateAdminConsoleAccess(request);
        return Result.success();
    }

    @GetMapping("/settings/registration")
    public Result<AdminRegistrationSettingsVO> getRegistrationSettings() {
        return Result.success(adminPolicyService.getRegistrationSettings());
    }

    @PutMapping("/settings/registration")
    public Result<Void> updateRegistrationSettings(@RequestBody AdminRegistrationSettingsUpdateRequest request) {
        adminPolicyService.updateRegistrationSettings(request);
        return Result.success();
    }

    @GetMapping("/settings/cors")
    public Result<AdminCorsPolicyVO> getCorsPolicy() {
        return Result.success(adminPolicyService.getCorsPolicy());
    }

    @GetMapping("/settings/file-upload")
    public Result<AdminFileUploadPolicyVO> getFileUploadPolicy() {
        return Result.success(adminPolicyService.getFileUploadPolicy());
    }

    @GetMapping("/settings/file-preview")
    public Result<AdminFilePreviewPolicyVO> getFilePreviewPolicy() {
        return Result.success(adminPolicyService.getFilePreviewPolicy());
    }

    @PutMapping("/settings/cors")
    public Result<Void> updateCorsPolicy(@RequestBody AdminCorsPolicyUpdateRequest request) {
        adminPolicyService.updateCorsPolicy(request);
        return Result.success();
    }

    @PutMapping("/settings/file-upload")
    public Result<Void> updateFileUploadPolicy(@RequestBody AdminFileUploadPolicyUpdateRequest request) {
        adminPolicyService.updateFileUploadPolicy(request);
        return Result.success();
    }

    @PutMapping("/settings/file-preview")
    public Result<Void> updateFilePreviewPolicy(@RequestBody AdminFilePreviewPolicyUpdateRequest request) {
        adminPolicyService.updateFilePreviewPolicy(request);
        return Result.success();
    }
}
