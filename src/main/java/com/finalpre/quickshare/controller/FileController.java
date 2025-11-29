package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.dto.FolderRequest;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.ShareLinkVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import net.coobird.thumbnailator.Thumbnails;

import jakarta.servlet.http.HttpServletResponse;
import java.io.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class FileController {

    @Autowired
    private FileService fileService;  // ✅ 只保留这个

    @Autowired
    private JwtUtil jwtUtil;

    // 不要有 FileInfoMapper！！！

    /**
     * 上传文件
     */
    @PostMapping("/upload")
    public Result<FileInfoVO> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(required = false, value = "Authorization") String authHeader) {
        try {
            Long userId;

            if (authHeader != null && !authHeader.isEmpty()) {
                userId = getUserIdFromHeader(authHeader);
            } else {
                userId = 1L;
            }

            FileInfoVO vo = fileService.uploadFile(file, userId);
            return Result.success(vo);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 获取当前用户的文件列表
     */
    @GetMapping("/files")
    public Result<List<FileInfoVO>> getUserFiles(
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = getUserIdFromHeader(authHeader);
            List<FileInfoVO> fileList = fileService.getUserFiles(userId);
            return Result.success(fileList);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 删除文件
     */
    @DeleteMapping("/files/{fileId}")
    public Result<Void> deleteFile(
            @PathVariable Long fileId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = getUserIdFromHeader(authHeader);
            fileService.deleteFile(fileId, userId);
            return Result.success(null);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("删除失败: " + e.getMessage());
        }
    }
    /**
     * 删除文件夹
     */
    @DeleteMapping("/folders/{folderId}")
    public Result<Void> deleteFolder(
            @PathVariable Long folderId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = getUserIdFromHeader(authHeader);
            fileService.deleteFolder(folderId, userId);
            return Result.success(null);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("删除文件夹失败: " + e.getMessage());
        }
    }

    /**
     * 重命名文件
     */
    @PutMapping("/files/{fileId}/rename")
    public Result<Void> renameFile(
            @PathVariable Long fileId,
            @RequestBody java.util.Map<String, String> request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = getUserIdFromHeader(authHeader);
            String newName = request.get("newName");

            if (newName == null || newName.trim().isEmpty()) {
                return Result.error("文件名不能为空");
            }

            fileService.renameFile(fileId, newName, userId);
            return Result.success(null);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("重命名失败: " + e.getMessage());
        }
    }

    /**
     * 预览/下载文件（支持 header 或 URL 参数传 token）
     */
    @GetMapping("/files/{fileId}/preview")
    public void previewFile(@PathVariable Long fileId,
                            @RequestHeader(required = false, value = "Authorization") String authHeader,
                            @RequestParam(required = false) String token,
                            @RequestParam(value = "max_size", required = false) Integer maxSize, // [新增] 接收尺寸参数
                            HttpServletResponse response) {
        try {
            // --- 1. 鉴权逻辑 (保持不变) ---
            String actualToken = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                actualToken = authHeader.substring(7);
            } else if (token != null && !token.isEmpty()) {
                actualToken = token;
            }

            if (actualToken == null) {
                response.setStatus(401);
                return;
            }

            if (!jwtUtil.validateToken(actualToken)) {
                response.setStatus(401);
                return;
            }

            Long userId = jwtUtil.getUserIdFromToken(actualToken);

            // --- 2. 获取文件信息 (保持不变) ---
            FileInfoVO fileVO = fileService.getFileById(fileId, userId);
            File file = new File(fileVO.getFilePath());
            if (!file.exists()) {
                response.setStatus(404);
                return;
            }

            // --- 3. 设置基础响应头 ---
            String contentType = fileVO.getFileType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/octet-stream";
            }
            response.setContentType(contentType);

            // 设置缓存 (这对预览体验很重要)
            response.setHeader("Cache-Control", "private, max-age=3600");

            // 设置 Content-Disposition (文件名处理)
            String disposition = "attachment";
            if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.equals("application/pdf")) {
                disposition = "inline";
            }
            response.setHeader("Content-Disposition", disposition + "; filename=\"" +
                    new String(fileVO.getOriginalName().getBytes("UTF-8"), "ISO-8859-1") + "\"");

            // --- 4. [核心修改] 判断是压缩输出还是原图输出 ---

            boolean isImage = contentType.startsWith("image/");

            // 如果是图片，且前端请求了压缩 (maxSize > 0)
            if (isImage && maxSize != null && maxSize > 0) {
                // === 分支 A: 压缩图片 ===
                try {
                    // 使用 Thumbnailator 压缩并直接写入响应流
                    // size(w, h): 限制长宽，自动保持比例
                    // outputQuality(0.8f): 压缩质量 80%，肉眼几乎看不出区别但体积减小很多
                    Thumbnails.of(file)
                            .size(maxSize, maxSize)
                            .outputQuality(0.8f)
                            .toOutputStream(response.getOutputStream());
                    return; // 压缩输出完直接结束
                } catch (Exception e) {
                    // 如果压缩失败（比如特殊格式图片），降级到下面的原图输出
                    e.printStackTrace();
                }
            }

            // === 分支 B: 输出原文件 (视频、PDF、非压缩图片) ===

            // 只有原文件模式才能预知大小，设置 Content-Length
            response.setContentLengthLong(fileVO.getFileSize());

            try (InputStream is = new FileInputStream(file);
                 OutputStream os = response.getOutputStream()) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = is.read(buffer)) > 0) {
                    os.write(buffer, 0, length);
                }
                os.flush();
            }

        } catch (RuntimeException e) {
            e.printStackTrace();
            response.setStatus(403);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
        }
    }

    /**
     * 创建分享链接
     */
    @PostMapping("/share")
    public Result<ShareLinkVO> createShare(
            @RequestBody ShareRequestDTO request,
            @RequestHeader(required = false, value = "Authorization") String authHeader) {
        try {
            Long userId;
            if (authHeader != null && !authHeader.isEmpty()) {
                userId = getUserIdFromHeader(authHeader);
            } else {
                userId = 1L;
            }

            ShareLinkVO vo = fileService.createShareLink(request, userId);
            return Result.success(vo);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 获取分享信息（不需要认证）
     */
    @GetMapping("/share/{shareCode}")
    public Result<ShareLinkVO> getShareInfo(
            @PathVariable String shareCode,
            @RequestParam String extractCode) {
        try {
            ShareLinkVO vo = fileService.getShareInfo(shareCode, extractCode);
            return Result.success(vo);
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    /**
     * 下载文件（不需要认证）
     */
    @GetMapping("/download/{shareCode}")
    public void downloadFile(
            @PathVariable String shareCode,
            @RequestParam String extractCode,
            HttpServletResponse response) {
        try {
            fileService.downloadFile(shareCode, extractCode, response);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public Result<String> health() {
        return Result.success("QuickShare is running!");
    }

    /**
     * 从 Authorization header 中提取用户 ID
     */
    private Long getUserIdFromHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("未提供有效的认证信息");
        }

        String token = authHeader.substring(7);

        if (!jwtUtil.validateToken(token)) {
            throw new RuntimeException("Token 无效或已过期");
        }

        return jwtUtil.getUserIdFromToken(token);
    }

    /**
     * 创建文件夹
     */
    @PostMapping("/folders")
    public Result<FileInfoVO> createFolder(
            @RequestBody FolderRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            // 添加日志
            System.out.println("===== 创建文件夹请求 =====");
            System.out.println("文件夹名称: " + request.getName());
            System.out.println("父文件夹ID: " + request.getParentId());
            System.out.println("========================");

            Long userId = getUserIdFromHeader(authHeader);

            FileInfoVO folder = fileService.createFolder(
                    request.getName(),
                    request.getParentId(),
                    userId
            );

            return Result.success(folder);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("创建文件夹失败: " + e.getMessage());
        }
    }

    /**
     * 获取文件夹内的文件列表
     * 解决 api/folders 405 错误
     */
    @GetMapping("/folders")
    public Result<List<FileInfoVO>> getFolderContent(
            @RequestParam(required = false, defaultValue = "0") Long parentId, // 前端传来的文件夹ID
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = getUserIdFromHeader(authHeader);

            // 调用刚才在 Service 中写的方法
            List<FileInfoVO> fileList = fileService.getFilesByFolder(parentId, userId);

            return Result.success(fileList);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.error("获取文件列表失败: " + e.getMessage());
        }
    }
}