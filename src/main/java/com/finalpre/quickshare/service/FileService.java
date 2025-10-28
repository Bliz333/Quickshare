package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

public interface FileService {

    /**
     * 上传文件
     */
    FileInfoVO uploadFile(MultipartFile file, Long userId);

    /**
     * 创建分享链接
     */
    ShareLinkVO createShareLink(ShareRequestDTO request, Long userId);

    /**
     * 获取分享信息
     */
    ShareLinkVO getShareInfo(String shareCode, String extractCode);

    /**
     * 下载文件
     */
    void downloadFile(String shareCode, String extractCode, HttpServletResponse response);

    /**
     * 获取用户的所有文件
     */
    List<FileInfoVO> getUserFiles(Long userId);

    /**
     * 删除文件
     */
    void deleteFile(Long fileId, Long userId);

    /**
     * 重命名文件
     */
    void renameFile(Long fileId, String newName, Long userId);

    /**
     * 获取文件信息（验证权限）
     */
    FileInfoVO getFileById(Long fileId, Long userId);

    /**
     * 创建文件夹
     */
    FileInfoVO createFolder(String folderName, Long parentId, Long userId);

}
