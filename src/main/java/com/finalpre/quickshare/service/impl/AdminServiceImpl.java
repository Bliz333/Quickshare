package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.common.UserRole;
import com.finalpre.quickshare.dto.AdminAnnouncementRequest;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.dto.AdminPlanRequest;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.entity.ShareLink;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.AdminService;
import com.finalpre.quickshare.service.SmtpPolicy;
import com.finalpre.quickshare.service.SmtpPolicyService;
import com.finalpre.quickshare.service.StorageService;
import com.finalpre.quickshare.vo.AdminAnnouncementResultVO;
import com.finalpre.quickshare.vo.AdminFileVO;
import com.finalpre.quickshare.vo.AdminOverviewVO;
import com.finalpre.quickshare.vo.AdminShareVO;
import com.finalpre.quickshare.vo.UserVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AdminServiceImpl implements AdminService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private FileInfoMapper fileInfoMapper;

    @Autowired
    private ShareLinkMapper shareLinkMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SmtpPolicyService smtpPolicyService;

    @Autowired
    private EmailServiceImpl emailServiceImpl;

    @Autowired
    private StorageService storageService;

    @Autowired
    private PlanMapper planMapper;

    @Override
    public AdminOverviewVO getOverview() {
        AdminOverviewVO overview = new AdminOverviewVO();
        overview.setUserCount(userMapper.selectCount(new QueryWrapper<User>().eq("deleted", 0)));
        overview.setFileCount(fileInfoMapper.selectCount(new QueryWrapper<FileInfo>().eq("deleted", 0).eq("is_folder", 0)));
        overview.setFolderCount(fileInfoMapper.selectCount(new QueryWrapper<FileInfo>().eq("deleted", 0).eq("is_folder", 1)));
        overview.setShareCount(shareLinkMapper.selectCount(new QueryWrapper<ShareLink>()));
        overview.setActiveShareCount(shareLinkMapper.selectCount(new QueryWrapper<ShareLink>().eq("status", 1)));

        List<FileInfo> files = fileInfoMapper.selectList(new QueryWrapper<FileInfo>()
                .eq("deleted", 0)
                .eq("is_folder", 0));
        long totalStorageBytes = files.stream()
                .map(FileInfo::getFileSize)
                .filter(size -> size != null && size > 0)
                .mapToLong(Long::longValue)
                .sum();
        overview.setTotalStorageBytes(totalStorageBytes);
        return overview;
    }

    @Override
    public List<UserVO> getUsers() {
        List<User> users = userMapper.selectList(new QueryWrapper<User>()
                .eq("deleted", 0)
                .orderByDesc("create_time"));
        return users.stream()
                .map(this::toUserVO)
                .toList();
    }

    @Override
    public List<AdminFileVO> getFiles() {
        List<FileInfo> files = fileInfoMapper.selectList(new QueryWrapper<FileInfo>()
                .eq("deleted", 0)
                .orderByDesc("upload_time"));
        Map<Long, User> userMap = loadUsersByIds(files.stream().map(FileInfo::getUserId).collect(Collectors.toSet()));

        return files.stream()
                .map(file -> toAdminFileVO(file, userMap.get(file.getUserId())))
                .toList();
    }

    @Override
    public List<AdminShareVO> getShares() {
        List<ShareLink> shares = shareLinkMapper.selectList(new QueryWrapper<ShareLink>()
                .orderByDesc("create_time"));

        Map<Long, FileInfo> fileMap = loadFilesByIds(shares.stream().map(ShareLink::getFileId).collect(Collectors.toSet()));
        Map<Long, User> userMap = loadUsersByIds(fileMap.values().stream()
                .map(FileInfo::getUserId)
                .collect(Collectors.toSet()));

        return shares.stream()
                .map(share -> toAdminShareVO(share, fileMap.get(share.getFileId()), userMap))
                .toList();
    }

    @Override
    public UserVO createUser(AdminCreateUserRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("用户信息不能为空");
        }

        String username = normalizeRequiredValue(request.getUsername(), "用户名不能为空");
        if (username.length() < 3) {
            throw new IllegalArgumentException("用户名至少 3 个字符");
        }

        String password = normalizeRequiredValue(request.getPassword(), "密码不能为空");
        if (password.length() < 6) {
            throw new IllegalArgumentException("密码至少 6 位");
        }

        if (userMapper.selectCount(new QueryWrapper<User>().eq("username", username)) > 0) {
            throw new IllegalArgumentException("用户名已存在");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setEmail(normalizeOptionalValue(request.getEmail()));
        user.setNickname(resolveNickname(request.getNickname(), username));
        user.setRole(UserRole.normalizeForManagement(request.getRole()));
        user.setCreateTime(LocalDateTime.now());

        userMapper.insert(user);
        return toUserVO(user);
    }

    @Override
    public void updateUserRole(Long userId, String role) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new ResourceNotFoundException("用户不存在");
        }

        String normalizedRole = UserRole.normalizeForManagement(role);
        if (!UserRole.ADMIN.name().equals(normalizedRole) && isLastActiveAdmin(user)) {
            throw new IllegalArgumentException("至少保留一个管理员账号");
        }

        user.setRole(normalizedRole);
        userMapper.updateById(user);
    }

    @Override
    public void deleteUser(Long userId, Long operatorUserId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new ResourceNotFoundException("用户不存在");
        }

        if (operatorUserId != null && operatorUserId.equals(userId)) {
            throw new IllegalArgumentException("不能删除当前登录的管理员账号");
        }
        if (isLastActiveAdmin(user)) {
            throw new IllegalArgumentException("至少保留一个管理员账号");
        }

        List<FileInfo> rootEntries = fileInfoMapper.selectList(new QueryWrapper<FileInfo>()
                .eq("deleted", 0)
                .eq("user_id", userId)
                .eq("parent_id", 0)
                .orderByAsc("is_folder")
                .orderByAsc("id"));
        for (FileInfo rootEntry : rootEntries) {
            deleteFileRecursively(rootEntry);
        }

        userMapper.deleteById(userId);
    }

    @Override
    public void deleteFile(Long fileId) {
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);
        if (fileInfo == null) {
            throw new ResourceNotFoundException("文件不存在");
        }

        deleteFileRecursively(fileInfo);
    }

    @Override
    public void disableShare(Long shareId) {
        ShareLink shareLink = shareLinkMapper.selectById(shareId);
        if (shareLink == null) {
            throw new ResourceNotFoundException("分享不存在");
        }

        shareLink.setStatus(0);
        shareLinkMapper.updateById(shareLink);
    }

    private void deleteFileRecursively(FileInfo fileInfo) {
        if (fileInfo == null) {
            return;
        }

        if (Integer.valueOf(1).equals(fileInfo.getIsFolder())) {
            List<FileInfo> children = fileInfoMapper.selectList(new QueryWrapper<FileInfo>()
                    .eq("deleted", 0)
                    .eq("parent_id", fileInfo.getId()));
            for (FileInfo child : children) {
                deleteFileRecursively(child);
            }
        } else {
            deletePhysicalFile(fileInfo);
        }

        shareLinkMapper.delete(new QueryWrapper<ShareLink>().eq("file_id", fileInfo.getId()));
        fileInfoMapper.deleteById(fileInfo.getId());
    }

    @Override
    public List<Plan> getPlans() {
        return planMapper.selectList(new QueryWrapper<Plan>().orderByAsc("sort_order").orderByDesc("create_time"));
    }

    @Override
    public Plan createPlan(AdminPlanRequest request) {
        validatePlanRequest(request);
        Plan plan = new Plan();
        applyPlanFields(plan, request);
        plan.setCreateTime(LocalDateTime.now());
        planMapper.insert(plan);
        return plan;
    }

    @Override
    public Plan updatePlan(Long planId, AdminPlanRequest request) {
        Plan plan = planMapper.selectById(planId);
        if (plan == null) throw new ResourceNotFoundException("套餐不存在");
        validatePlanRequest(request);
        applyPlanFields(plan, request);
        planMapper.updateById(plan);
        return plan;
    }

    @Override
    public void deletePlan(Long planId) {
        Plan plan = planMapper.selectById(planId);
        if (plan == null) throw new ResourceNotFoundException("套餐不存在");
        planMapper.deleteById(planId);
    }

    private void validatePlanRequest(AdminPlanRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("套餐名称不能为空");
        }
        if (request.getType() == null || !List.of("storage", "downloads", "vip").contains(request.getType())) {
            throw new IllegalArgumentException("套餐类型必须是 storage / downloads / vip");
        }
        if (request.getPrice() == null || request.getPrice().signum() < 0) {
            throw new IllegalArgumentException("价格不能为负数");
        }
        if (request.getValue() == null || request.getValue() < 0) {
            throw new IllegalArgumentException("套餐值不能为负数");
        }
    }

    private void applyPlanFields(Plan plan, AdminPlanRequest request) {
        plan.setName(request.getName().trim());
        plan.setDescription(request.getDescription());
        plan.setType(request.getType());
        plan.setValue(request.getValue());
        plan.setPrice(request.getPrice());
        plan.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);
        plan.setStatus(request.getStatus() != null ? request.getStatus() : 1);
    }

    private void deletePhysicalFile(FileInfo fileInfo) {
        String storageKey = fileInfo.getFilePath();
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }

        try {
            storageService.delete(storageKey);
        } catch (IOException ex) {
            throw new RuntimeException("删除物理文件失败: " + ex.getMessage(), ex);
        }
    }

    private Map<Long, User> loadUsersByIds(Set<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }

        List<User> users = userMapper.selectList(new QueryWrapper<User>()
                .in("id", userIds)
                .eq("deleted", 0));
        return users.stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private boolean isLastActiveAdmin(User user) {
        if (user == null || !UserRole.ADMIN.name().equals(UserRole.normalize(user.getRole()))) {
            return false;
        }

        List<User> users = userMapper.selectList(new QueryWrapper<User>().eq("deleted", 0));
        long activeAdminCount = users.stream()
                .filter(item -> UserRole.ADMIN.name().equals(UserRole.normalize(item.getRole())))
                .count();
        return activeAdminCount <= 1;
    }

    private String normalizeRequiredValue(String rawValue, String message) {
        String value = normalizeOptionalValue(rawValue);
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String normalizeOptionalValue(String rawValue) {
        if (rawValue == null) {
            return null;
        }

        String value = rawValue.trim();
        return value.isEmpty() ? null : value;
    }

    private String resolveNickname(String nickname, String username) {
        String value = normalizeOptionalValue(nickname);
        return value != null ? value : username;
    }

    private Map<Long, FileInfo> loadFilesByIds(Set<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return Map.of();
        }

        List<FileInfo> files = fileInfoMapper.selectList(new QueryWrapper<FileInfo>()
                .in("id", fileIds)
                .eq("deleted", 0));
        return files.stream().collect(Collectors.toMap(FileInfo::getId, Function.identity()));
    }

    private UserVO toUserVO(User user) {
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        vo.setRole(UserRole.normalize(user.getRole()));
        vo.setToken(null);
        return vo;
    }

    private AdminFileVO toAdminFileVO(FileInfo fileInfo, User user) {
        AdminFileVO vo = new AdminFileVO();
        BeanUtils.copyProperties(fileInfo, vo);
        vo.setUserId(fileInfo.getUserId());
        vo.setUsername(user == null ? null : user.getUsername());
        return vo;
    }

    @Override
    public AdminAnnouncementResultVO sendAnnouncement(AdminAnnouncementRequest request) {
        if (request == null || request.getSubject() == null || request.getSubject().isBlank()) {
            throw new IllegalArgumentException("公告主题不能为空");
        }
        if (request.getBody() == null || request.getBody().isBlank()) {
            throw new IllegalArgumentException("公告正文不能为空");
        }

        // Verify SMTP is configured
        SmtpPolicy smtp = smtpPolicyService.getPolicy();
        if (smtp.host() == null || smtp.host().isBlank()) {
            throw new IllegalStateException("邮件服务未配置，请先在 SMTP 设置中完成配置");
        }

        // Resolve recipients
        List<User> recipients;
        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            recipients = userMapper.selectList(new QueryWrapper<User>()
                    .eq("deleted", 0)
                    .in("id", request.getUserIds()));
        } else {
            recipients = userMapper.selectList(new QueryWrapper<User>()
                    .eq("deleted", 0));
        }

        // Filter users with valid email
        List<User> validRecipients = recipients.stream()
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank() && u.getEmail().contains("@"))
                .toList();

        AdminAnnouncementResultVO result = new AdminAnnouncementResultVO();
        result.setTotalRecipients(validRecipients.size());
        int success = 0;
        int fail = 0;

        for (User user : validRecipients) {
            try {
                emailServiceImpl.sendRawEmail(user.getEmail(), request.getSubject().trim(), request.getBody());
                success++;
            } catch (Exception e) {
                fail++;
                log.warn("Failed to send announcement to {}. reason={}", user.getEmail(), e.getMessage());
            }
        }

        result.setSuccessCount(success);
        result.setFailCount(fail);
        log.info("Announcement sent. total={}, success={}, fail={}", validRecipients.size(), success, fail);
        return result;
    }

    private AdminShareVO toAdminShareVO(ShareLink shareLink, FileInfo fileInfo, Map<Long, User> userMap) {
        AdminShareVO vo = new AdminShareVO();
        BeanUtils.copyProperties(shareLink, vo);
        if (fileInfo != null) {
            vo.setFileName(fileInfo.getOriginalName());
            vo.setUserId(fileInfo.getUserId());
            User user = userMap.get(fileInfo.getUserId());
            vo.setUsername(user == null ? null : user.getUsername());
        }
        return vo;
    }
}
