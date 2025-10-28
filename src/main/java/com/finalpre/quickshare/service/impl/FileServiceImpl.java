package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.entity.ShareLink;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;  // ← 修复这行
import java.util.stream.Collectors;

@Service
public class FileServiceImpl implements FileService {

    @Autowired
    private FileInfoMapper fileInfoMapper;

    @Autowired
    private ShareLinkMapper shareLinkMapper;

    @Autowired
    private FileConfig fileConfig;

    @Override
    public FileInfoVO uploadFile(MultipartFile file, Long userId) {
        try {
            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String fileName = IdUtil.simpleUUID() + extension;

            // 保存文件
            String uploadDir = fileConfig.getUploadDir();
            Path filePath = Paths.get(uploadDir, fileName);
            Files.copy(file.getInputStream(), filePath);

            // 计算MD5
            String md5 = DigestUtil.md5Hex(file.getInputStream());

            // 保存文件信息到数据库
            FileInfo fileInfo = new FileInfo();
            fileInfo.setFileName(fileName);
            fileInfo.setOriginalName(originalFilename);
            fileInfo.setFilePath(filePath.toString());
            fileInfo.setFileSize(file.getSize());
            fileInfo.setFileType(file.getContentType());
            fileInfo.setMd5(md5);
            fileInfo.setUploadTime(LocalDateTime.now());
            fileInfo.setUserId(userId);

            fileInfoMapper.insert(fileInfo);

            // 返回VO
            FileInfoVO vo = new FileInfoVO();
            BeanUtils.copyProperties(fileInfo, vo);
            return vo;

        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage());
        }
    }

    @Override
    public ShareLinkVO createShareLink(ShareRequestDTO request, Long userId) {
        // 检查文件是否存在
        FileInfo fileInfo = fileInfoMapper.selectById(request.getFileId());
        if (fileInfo == null) {
            throw new RuntimeException("文件不存在");
        }

        // 验证文件所有权
        if (!fileInfo.getUserId().equals(userId)) {
            throw new RuntimeException("无权分享此文件");
        }

        // 生成分享码和提取码
        String shareCode = RandomUtil.randomString(8);
        String extractCode = request.getExtractCode();
        if (extractCode == null || extractCode.isEmpty()) {
            extractCode = RandomUtil.randomNumbers(4);
        }

        // 计算过期时间
        LocalDateTime expireTime = null;
        if (request.getExpireHours() != null && request.getExpireHours() > 0) {
            expireTime = LocalDateTime.now().plusHours(request.getExpireHours());
        }

        // 创建分享链接
        ShareLink shareLink = new ShareLink();
        shareLink.setFileId(request.getFileId());
        shareLink.setShareCode(shareCode);
        shareLink.setExtractCode(extractCode);
        shareLink.setExpireTime(expireTime);
        shareLink.setMaxDownload(request.getMaxDownload() != null ? request.getMaxDownload() : -1);
        shareLink.setDownloadCount(0);
        shareLink.setCreateTime(LocalDateTime.now());
        shareLink.setStatus(1);

        shareLinkMapper.insert(shareLink);

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
            throw new RuntimeException("分享链接不存在");
        }

        // 验证提取码
        if (!shareLink.getExtractCode().equals(extractCode)) {
            throw new RuntimeException("提取码错误");
        }

        // 检查是否过期
        if (shareLink.getExpireTime() != null && LocalDateTime.now().isAfter(shareLink.getExpireTime())) {
            throw new RuntimeException("分享链接已过期");
        }

        // 检查下载次数
        if (shareLink.getMaxDownload() > 0 && shareLink.getDownloadCount() >= shareLink.getMaxDownload()) {
            throw new RuntimeException("下载次数已达上限");
        }

        // 检查状态
        if (shareLink.getStatus() == 0) {
            throw new RuntimeException("分享链接已失效");
        }

        // 获取文件信息
        FileInfo fileInfo = fileInfoMapper.selectById(shareLink.getFileId());

        // 返回VO
        ShareLinkVO vo = new ShareLinkVO();
        vo.setShareCode(shareCode);
        vo.setExtractCode(extractCode);
        vo.setExpireTime(shareLink.getExpireTime());
        vo.setMaxDownload(shareLink.getMaxDownload());
        vo.setFileName(fileInfo.getOriginalName());

        return vo;
    }

    @Override
    public void downloadFile(String shareCode, String extractCode, HttpServletResponse response) {
        // 验证分享信息
        ShareLinkVO shareInfo = getShareInfo(shareCode, extractCode);

        // 查询分享链接
        QueryWrapper<ShareLink> wrapper = new QueryWrapper<>();
        wrapper.eq("share_code", shareCode);
        ShareLink shareLink = shareLinkMapper.selectOne(wrapper);

        // 获取文件信息
        FileInfo fileInfo = fileInfoMapper.selectById(shareLink.getFileId());

        try {
            // 读取文件
            File file = new File(fileInfo.getFilePath());
            if (!file.exists()) {
                throw new RuntimeException("文件不存在");
            }

            // 设置响应头
            response.setContentType("application/octet-stream");
            response.setHeader("Content-Disposition",
                    "attachment; filename=\"" + new String(fileInfo.getOriginalName().getBytes("UTF-8"), "ISO-8859-1") + "\"");
            response.setContentLengthLong(fileInfo.getFileSize());

            // 写入响应
            try (InputStream is = new FileInputStream(file);
                 OutputStream os = response.getOutputStream()) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = is.read(buffer)) > 0) {
                    os.write(buffer, 0, length);
                }
                os.flush();
            }

            // 更新下载次数
            shareLink.setDownloadCount(shareLink.getDownloadCount() + 1);
            shareLinkMapper.updateById(shareLink);

        } catch (IOException e) {
            throw new RuntimeException("文件下载失败: " + e.getMessage());
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
               // .eq("is_deleted", 0)
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
            throw new RuntimeException("文件不存在");
        }

        // 验证是否是文件所有者
        if (!fileInfo.getUserId().equals(userId)) {
            throw new RuntimeException("无权删除此文件");
        }

        // 逻辑删除（MyBatis-Plus 会自动设置 deleted=1）
        fileInfoMapper.deleteById(fileId);
    }

    /**
     * 重命名文件
     */
    @Override
    public void renameFile(Long fileId, String newName, Long userId) {
        // 查询文件
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);

        if (fileInfo == null) {
            throw new RuntimeException("文件不存在");
        }

        // 验证是否是文件所有者
        if (!fileInfo.getUserId().equals(userId)) {
            throw new RuntimeException("无权修改此文件");
        }

        // 更新文件名
        fileInfo.setOriginalName(newName);
        fileInfoMapper.updateById(fileInfo);
    }

    /**
     * 获取文件信息（验证权限）
     */
    @Override
    public FileInfoVO getFileById(Long fileId, Long userId) {
        FileInfo fileInfo = fileInfoMapper.selectById(fileId);

        if (fileInfo == null) {
            throw new RuntimeException("文件不存在");
        }

        // 验证权限
        if (!fileInfo.getUserId().equals(userId)) {
            throw new RuntimeException("无权访问此文件");
        }

        return convertToVO(fileInfo);
    }

    /**
     * 创建文件夹
     */
    @Override
    public FileInfoVO createFolder(String folderName, Long parentId, Long userId) {
        // 检查文件夹名是否合法
        if (folderName == null || folderName.trim().isEmpty()) {
            throw new RuntimeException("文件夹名不能为空");
        }

        // 检查同一目录下是否已存在同名文件夹
        QueryWrapper<FileInfo> wrapper = new QueryWrapper<>();
        wrapper.eq("user_id", userId)
                .eq("parent_id", parentId == null ? 0 : parentId)
                .eq("original_name", folderName)
                .eq("is_folder", 1);

        if (fileInfoMapper.selectCount(wrapper) > 0) {
            throw new RuntimeException("该目录下已存在同名文件夹");
        }

        // 创建文件夹记录
        FileInfo folder = new FileInfo();
        folder.setUserId(userId);
        folder.setOriginalName(folderName);
        folder.setFileName(folderName);
        folder.setIsFolder(1);
        folder.setParentId(parentId == null ? 0L : parentId);
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
        return vo;
    }
}