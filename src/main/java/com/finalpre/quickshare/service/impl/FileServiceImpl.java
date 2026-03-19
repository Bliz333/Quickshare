package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.entity.ShareLink;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.PreviewResource;
import com.finalpre.quickshare.service.StorageService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FileServiceImpl implements FileService {

    @Autowired
    private FileInfoMapper fileInfoMapper;

    @Autowired
    private ShareLinkMapper shareLinkMapper;

    @Autowired
    private FileConfig fileConfig;

    @Autowired
    private FileUploadPolicyService fileUploadPolicyService;

    @Autowired
    private FilePreviewPolicyService filePreviewPolicyService;

    @Autowired
    private OfficePreviewService officePreviewService;

    @Autowired
    private StorageService storageService;

    @Override
    public FileInfoVO uploadFile(MultipartFile file, Long userId, Long folderId) {
        try {
            Long targetFolderId = normalizeParentId(folderId);
            validateTargetFolder(targetFolderId, userId);

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.trim().isEmpty()) {
                throw new IllegalArgumentException("文件名不能为空");
            }
            String safeOriginalName = Paths.get(originalFilename).getFileName().toString();
            int dotIndex = safeOriginalName.lastIndexOf('.');
            String extension = dotIndex > 0 ? safeOriginalName.substring(dotIndex + 1).toLowerCase() : "";

            FileUploadPolicy fileUploadPolicy = fileUploadPolicyService.getPolicy();
            List<String> allowedTypes = fileUploadPolicy.allowedExtensions();
            if (!allowedTypes.isEmpty() && (extension.isEmpty() || !allowedTypes.contains(extension))) {
                throw new IllegalArgumentException("不支持的文件类型");
            }

            long maxSize = fileUploadPolicy.maxFileSizeBytes();
            if (maxSize > 0 && file.getSize() > maxSize) {
                throw new IllegalArgumentException("文件大小超过限制");
            }

            String fileName = IdUtil.simpleUUID() + (extension.isEmpty() ? "" : "." + extension);

            // 保存文件到存储后端
            String storageKey;
            try (InputStream inputStream = file.getInputStream()) {
                storageKey = storageService.store(fileName, inputStream, file.getSize());
            }

            // 计算MD5
            String md5;
            try (InputStream md5Stream = storageService.retrieve(storageKey)) {
                md5 = DigestUtil.md5Hex(md5Stream);
            }

            String contentType = file.getContentType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/octet-stream";
            }

            // 保存文件信息到数据库
            FileInfo fileInfo = new FileInfo();
            fileInfo.setFileName(fileName);
            fileInfo.setOriginalName(safeOriginalName);
            fileInfo.setFilePath(storageKey);
            fileInfo.setFileSize(file.getSize());
            fileInfo.setFileType(contentType);
            fileInfo.setMd5(md5);
            fileInfo.setUploadTime(LocalDateTime.now());
            fileInfo.setUserId(userId);
            fileInfo.setIsFolder(0);
            fileInfo.setParentId(targetFolderId);

            fileInfoMapper.insert(fileInfo);

            return convertToVO(fileInfo);

        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        }
    }

    @Override
    public ShareLinkVO createShareLink(ShareRequestDTO request, Long userId) {
        // 检查文件是否存在
        FileInfo fileInfo = fileInfoMapper.selectById(request.getFileId());
        if (fileInfo == null || (fileInfo.getDeleted() != null && fileInfo.getDeleted() == 1)) {
            throw new ResourceNotFoundException("文件不存在");
        }

        // 验证文件所有权
        if (!fileInfo.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权分享此文件");
        }

        // 生成提取码
        String extractCode = request.getExtractCode();
        if (extractCode == null || extractCode.isEmpty()) {
            extractCode = RandomUtil.randomNumbers(4);
        }

        // 计算过期时间
        LocalDateTime expireTime = null;
        if (request.getExpireHours() != null && request.getExpireHours() > 0) {
            expireTime = LocalDateTime.now().plusHours(request.getExpireHours());
        }

        // 生成分享码（带重试避免唯一约束冲突）
        String shareCode = null;
        ShareLink shareLink = new ShareLink();
        shareLink.setFileId(request.getFileId());
        shareLink.setExtractCode(extractCode);
        shareLink.setExpireTime(expireTime);
        shareLink.setMaxDownload(request.getMaxDownload() != null ? request.getMaxDownload() : -1);
        shareLink.setDownloadCount(0);
        shareLink.setCreateTime(LocalDateTime.now());
        shareLink.setStatus(1);

        for (int attempt = 0; attempt < 5; attempt++) {
            shareCode = RandomUtil.randomString(8);
            shareLink.setShareCode(shareCode);
            try {
                shareLinkMapper.insert(shareLink);
                break;
            } catch (org.springframework.dao.DuplicateKeyException e) {
                if (attempt == 4) {
                    throw new RuntimeException("分享码生成失败，请重试");
                }
                shareLink.setId(null); // reset for next insert attempt
            }
        }

        // 返回VO
        ShareLinkVO vo = new ShareLinkVO();
        vo.setShareCode(shareCode);
        vo.setShareUrl("http://localhost:8080/api/share/" + shareCode);
        vo.setExtractCode(extractCode);
        vo.setExpireTime(expireTime);
        vo.setMaxDownload(shareLink.getMaxDownload());
        vo.setFileName(fileInfo.getOriginalName());

        return vo;
    }

    @Override
    public ShareLinkVO getShareInfo(String shareCode, String extractCode) {
        // 查询分享链接
        QueryWrapper<ShareLink> wrapper = new QueryWrapper<>();
        wrapper.eq("share_code", shareCode);
        ShareLink shareLink = shareLinkMapper.selectOne(wrapper);

        if (shareLink == null) {
            throw new ResourceNotFoundException("分享链接不存在");
        }

        if (shareLink.getStatus() == null || shareLink.getStatus() == 0) {
            throw new IllegalArgumentException("分享链接已失效");
        }

        // 验证提取码
        if (!shareLink.getExtractCode().equals(extractCode)) {
            throw new IllegalArgumentException("提取码错误");
        }

        // 检查是否过期
        if (shareLink.getExpireTime() != null && LocalDateTime.now().isAfter(shareLink.getExpireTime())) {
            throw new IllegalArgumentException("分享链接已过期");
        }

        // 检查下载次数（快速检查，实际下载时由原子 SQL 保证并发安全）
        if (shareLink.getMaxDownload() > 0 && shareLink.getDownloadCount() >= shareLink.getMaxDownload()) {
            throw new IllegalArgumentException("下载次数已达上限");
        }

        // 获取文件信息
        FileInfo fileInfo = fileInfoMapper.selectById(shareLink.getFileId());
        if (fileInfo == null || (fileInfo.getDeleted() != null && fileInfo.getDeleted() == 1)) {
            throw new ResourceNotFoundException("文件不存在或已删除");
        }

        // 返回VO
        ShareLinkVO vo = new ShareLinkVO();
        vo.setShareCode(shareCode);
        vo.setExtractCode(extractCode);
        vo.setExpireTime(shareLink.getExpireTime());
        vo.setMaxDownload(shareLink.getMaxDownload());
        vo.setFileName(fileInfo.getOriginalName());
        vo.setFileType(fileInfo.getFileType());

        return vo;
    }

    @Override
    public void downloadFile(String shareCode, String extractCode, HttpServletResponse response) {
        // Validate share info (checks expiration, extract code, status, file exists)
        ShareLinkVO shareInfo = getShareInfo(shareCode, extractCode);

        // Atomic download count increment + limit check
        QueryWrapper<ShareLink> wrapper = new QueryWrapper<>();
        wrapper.eq("share_code", shareCode);
        ShareLink shareLink = shareLinkMapper.selectOne(wrapper);

        int updated = shareLinkMapper.incrementDownloadCount(shareLink.getId());
        if (updated == 0) {
            throw new IllegalArgumentException("下载次数已达上限");
        }

        // 获取文件信息
        FileInfo fileInfo = fileInfoMapper.selectById(shareLink.getFileId());

        String storageKey = fileInfo.getFilePath();
        if (!storageService.exists(storageKey)) {
            throw new ResourceNotFoundException("文件不存在");
        }

        try {
            response.setContentType("application/octet-stream");
            response.setHeader("Content-Disposition",
                    "attachment; filename=\"" + new String(fileInfo.getOriginalName().getBytes("UTF-8"), "ISO-8859-1") + "\"");
            response.setContentLengthLong(fileInfo.getFileSize());

            try (InputStream is = storageService.retrieve(storageKey);
                 OutputStream os = response.getOutputStream()) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = is.read(buffer)) > 0) {
                    os.write(buffer, 0, length);
                }
                os.flush();
            }

        } catch (IOException e) {
            throw new RuntimeException("文件下载失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void previewShareFile(String shareCode, String extractCode, HttpServletResponse response) {
        // Validate share info (same checks as download)
        ShareLinkVO shareInfo = getShareInfo(shareCode, extractCode);

        QueryWrapper<ShareLink> wrapper = new QueryWrapper<>();
        wrapper.eq("share_code", shareCode);
        ShareLink shareLink = shareLinkMapper.selectOne(wrapper);

        FileInfo fileInfo = fileInfoMapper.selectById(shareLink.getFileId());
        String storageKey = fileInfo.getFilePath();
        if (!storageService.exists(storageKey)) {
            throw new ResourceNotFoundException("文件不存在");
        }

        String contentType = fileInfo.getFileType();
        if (contentType == null || contentType.isEmpty()) {
            contentType = "application/octet-stream";
        }

        if (!filePreviewPolicyService.isPreviewAllowed(fileInfo.getOriginalName(), contentType)) {
            throw new com.finalpre.quickshare.common.FeatureDisabledException("当前文件类型不允许预览");
        }

        String responseFileName = fileInfo.getOriginalName();
        long contentLength;
        try {
            contentLength = fileInfo.getFileSize() == null ? storageService.getSize(storageKey) : fileInfo.getFileSize();
        } catch (IOException e) {
            contentLength = 0;
        }
        InputStream previewStream = null;

        // Office conversion (needs local file)
        if (officePreviewService.supports(fileInfo.getOriginalName(), contentType)) {
            try {
                FileInfoVO tempVO = new FileInfoVO();
                BeanUtils.copyProperties(fileInfo, tempVO);
                tempVO.setName(fileInfo.getOriginalName());
                tempVO.setFilePath(storageService.getLocalPath(storageKey).toString());
                PreviewResource previewResource = officePreviewService.preparePreview(tempVO);
                previewStream = new FileInputStream(previewResource.file().toFile());
                contentType = previewResource.contentType();
                responseFileName = previewResource.fileName();
                contentLength = previewResource.contentLength();
            } catch (IOException e) {
                throw new com.finalpre.quickshare.common.PreviewUnavailableException("Office 文档转换失败，请直接下载");
            }
        }

        try {
            response.setContentType(contentType);
            response.setHeader("Cache-Control", "private, max-age=3600");
            response.setHeader("Content-Disposition",
                    "inline; filename=\"" + new String(responseFileName.getBytes("UTF-8"), "ISO-8859-1") + "\"");
            response.setContentLengthLong(contentLength);

            try (InputStream is = previewStream != null ? previewStream : storageService.retrieve(storageKey);
                 OutputStream os = response.getOutputStream()) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = is.read(buffer)) > 0) {
                    os.write(buffer, 0, length);
                }
                os.flush();
            }
        } catch (IOException e) {
            throw new RuntimeException("文件预览失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取用户的所有文件
     */
    @Override
    public List<FileInfoVO> getUserFiles(Long userId) {
        // 1. 查询该用户的所有文件
        QueryWrapper<FileInfo> wrapper = new QueryWrapper<>();
        wrapper.eq("user_id", userId)
                .eq("deleted", 0)
                .orderByDesc("upload_time");

        List<FileInfo> fileList = fileInfoMapper.selectList(wrapper);

        // 2. 转换为 VO
        return fileList.stream()
                .map(this::convertToVO)
                .collect(Collectors.toList());
    }


    /**
     * 删除文件（逻辑删除）
     */
    @Override
    public void deleteFile(Long fileId, Long userId) {
        // 查询文件
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);

        if (fileInfo == null) {
            throw new ResourceNotFoundException("文件不存在");
        }

        // 验证是否是文件所有者
        if (!fileInfo.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权删除此文件");
        }

        deletePhysicalFile(fileInfo);
        fileInfoMapper.deleteById(fileId);
    }

    /**
     * 重命名文件
     */
    @Override
    public void renameFile(Long fileId, String newName, Long userId) {
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);
        if (fileInfo == null) {
            throw new ResourceNotFoundException("文件不存在");
        }
        if (!fileInfo.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权修改此文件");
        }
        if (fileInfo.getDeleted() != null && fileInfo.getDeleted() == 1) {
            throw new ResourceNotFoundException("文件不存在");
        }
        if (Integer.valueOf(1).equals(fileInfo.getIsFolder())) {
            throw new IllegalArgumentException("该对象不是文件");
        }

        String normalizedName = normalizeItemName(newName, "文件名");
        ensureNameAvailable(userId, fileInfo.getParentId(), normalizedName, fileId);

        fileInfo.setOriginalName(normalizedName);
        fileInfoMapper.updateById(fileInfo);
    }

    /**
     * 获取文件信息（验证权限）
     */
    @Override
    public FileInfoVO getFileById(Long fileId, Long userId) {
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);

        if (fileInfo == null) {
            throw new ResourceNotFoundException("文件不存在");
        }

        if (fileInfo.getDeleted() != null && fileInfo.getDeleted() == 1) {
            throw new ResourceNotFoundException("文件不存在");
        }

        // 验证权限
        if (!fileInfo.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权访问此文件");
        }

        return convertToVO(fileInfo);
    }

    /**
     * 创建文件夹
     */
    @Override
    public FileInfoVO createFolder(String folderName, Long parentId, Long userId) {
        String normalizedFolderName = normalizeItemName(folderName, "文件夹名");
        Long normalizedParentId = normalizeParentId(parentId);
        ensureNameAvailable(userId, normalizedParentId, normalizedFolderName, null);

        FileInfo folder = new FileInfo();
        folder.setUserId(userId);
        folder.setOriginalName(normalizedFolderName);
        folder.setFileName(normalizedFolderName);
        folder.setIsFolder(1);
        folder.setParentId(normalizedParentId);
        folder.setFileSize(0L);
        folder.setFileType("folder");
        folder.setUploadTime(LocalDateTime.now());

        fileInfoMapper.insert(folder);

        return convertToVO(folder);
    }



    /**
     * 将 FileInfo 转换为 FileInfoVO
     */
    private FileInfoVO convertToVO(FileInfo fileInfo) {
        FileInfoVO vo = new FileInfoVO();
        BeanUtils.copyProperties(fileInfo, vo);
        vo.setName(fileInfo.getOriginalName());
        vo.setFolderId(fileInfo.getParentId());
        vo.setCreateTime(fileInfo.getUploadTime());
        return vo;
    }

    @Override
    public List<FileInfoVO> getFilesByFolder(Long parentId, Long userId) {
        Long normalizedParentId = normalizeParentId(parentId);
        QueryWrapper<FileInfo> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId);
        queryWrapper.eq("parent_id", normalizedParentId);
        queryWrapper.eq("deleted", 0);
        queryWrapper.orderByDesc("is_folder")
                .orderByDesc("upload_time");

        List<FileInfo> fileInfos = fileInfoMapper.selectList(queryWrapper);

        return fileInfos.stream()
                .map(this::convertToVO)
                .collect(Collectors.toList());
    }

    /**
     * 删除文件夹
     */
    @Override
    public void deleteFolder(Long folderId, Long userId) {
        // 查询文件夹
        FileInfo folder = fileInfoMapper.selectById(folderId);

        if (folder == null) {
            throw new ResourceNotFoundException("文件夹不存在");
        }

        // 验证是否是文件夹所有者
        if (!folder.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权删除此文件夹");
        }

        // 验证是否是文件夹
        if (folder.getIsFolder() != 1) {
            throw new IllegalArgumentException("该对象不是文件夹");
        }

        // 删除文件夹下的所有文件
        QueryWrapper<FileInfo> wrapper = new QueryWrapper<>();
        wrapper.eq("parent_id", folderId);
        List<FileInfo> children = fileInfoMapper.selectList(wrapper);

        for (FileInfo child : children) {
            if (child.getIsFolder() == 1) {
                // 递归删除子文件夹
                deleteFolder(child.getId(), userId);
            } else {
                deletePhysicalFile(child);
                fileInfoMapper.deleteById(child.getId());
            }
        }

        // 删除文件夹本身
        fileInfoMapper.deleteById(folderId);
    }

    /**
     * 重命名文件夹
     */
    @Override
    public void renameFolder(Long folderId, String newName, Long userId) {
        FileInfo folder = fileInfoMapper.selectById(folderId);
        if (folder == null) {
            throw new ResourceNotFoundException("文件夹不存在");
        }
        if (!folder.getUserId().equals(userId)) {
            throw new AccessDeniedException("无权修改此文件夹");
        }
        if (folder.getDeleted() != null && folder.getDeleted() == 1) {
            throw new ResourceNotFoundException("文件夹不存在");
        }
        if (folder.getIsFolder() != 1) {
            throw new IllegalArgumentException("该对象不是文件夹");
        }

        String normalizedName = normalizeItemName(newName, "文件夹名");
        ensureNameAvailable(userId, folder.getParentId(), normalizedName, folderId);

        folder.setOriginalName(normalizedName);
        folder.setFileName(normalizedName);
        fileInfoMapper.updateById(folder);
    }

    private Long normalizeParentId(Long parentId) {
        return parentId == null ? 0L : parentId;
    }

    private String normalizeItemName(String rawName, String label) {
        if (rawName == null || rawName.trim().isEmpty()) {
            throw new IllegalArgumentException(label + "不能为空");
        }
        return rawName.trim();
    }

    private void ensureNameAvailable(Long userId, Long parentId, String name, Long currentId) {
        QueryWrapper<FileInfo> wrapper = new QueryWrapper<>();
        wrapper.eq("user_id", userId)
                .eq("parent_id", normalizeParentId(parentId))
                .eq("original_name", name)
                .eq("deleted", 0);
        if (currentId != null) {
            wrapper.ne("id", currentId);
        }

        if (fileInfoMapper.selectCount(wrapper) > 0) {
            throw new IllegalArgumentException("该目录下已存在同名文件或文件夹");
        }
    }

    private void validateTargetFolder(Long folderId, Long userId) {
        if (folderId == null || folderId == 0L) {
            return;
        }

        FileInfo folder = fileInfoMapper.selectById(folderId);
        if (folder == null || (folder.getDeleted() != null && folder.getDeleted() == 1)) {
            throw new ResourceNotFoundException("目标文件夹不存在");
        }
        if (!userId.equals(folder.getUserId())) {
            throw new AccessDeniedException("无权上传到该文件夹");
        }
        if (!Integer.valueOf(1).equals(folder.getIsFolder())) {
            throw new IllegalArgumentException("目标路径不是文件夹");
        }
    }

    private void deletePhysicalFile(FileInfo fileInfo) {
        if (fileInfo == null || Integer.valueOf(1).equals(fileInfo.getIsFolder())) {
            return;
        }
        String storageKey = fileInfo.getFilePath();
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }

        try {
            storageService.delete(storageKey);
        } catch (IOException e) {
            throw new RuntimeException("删除物理文件失败: " + e.getMessage(), e);
        }
    }
}
