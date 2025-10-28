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
                            HttpServletResponse response) {
        try {
            // 优先从 header 获取 token，如果没有则从 URL 参数获取
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

            // 验证 token
            if (!jwtUtil.validateToken(actualToken)) {
                response.setStatus(401);
                return;
            }

            Long userId = jwtUtil.getUserIdFromToken(actualToken);

            // 通过 Service 获取文件信息（包含权限验证）
            FileInfoVO fileVO = fileService.getFileById(fileId, userId);

            // 读取文件
            File file = new File(fileVO.getFilePath());
            if (!file.exists()) {
                response.setStatus(404);
                return;
            }

            // 设置响应头
            String contentType = fileVO.getFileType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/octet-stream";
            }
            response.setContentType(contentType);

            // 对于图片和视频，设置为inline显示；其他文件下载
            if (contentType.startsWith("image/") || contentType.startsWith("video/") ||
                    contentType.equals("application/pdf")) {
                response.setHeader("Content-Disposition", "inline; filename=\"" +
                        new String(fileVO.getOriginalName().getBytes("UTF-8"), "ISO-8859-1") + "\"");
            } else {
                response.setHeader("Content-Disposition", "attachment; filename=\"" +
                        new String(fileVO.getOriginalName().getBytes("UTF-8"), "ISO-8859-1") + "\"");
            }

            response.setContentLengthLong(fileVO.getFileSize());

            // 设置缓存（对于图片缩略图很重要）
            response.setHeader("Cache-Control", "private, max-age=3600");

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
}