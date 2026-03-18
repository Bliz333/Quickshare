package com.finalpre.quickshare.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class FileInfoVO {
    private Long id;
    private String fileName;
    private String originalName;
    private String filePath;
    private Long fileSize;
    private String fileType;
    private LocalDateTime uploadTime;
    private String name;           // 文件夹名称（用于前端显示）
    private Integer isFolder;      // 0=文件，1=文件夹
    private Long parentId;         // 父文件夹ID
    private Long folderId;         // 兼容前端旧字段，值与 parentId 一致
    private Integer fileCount;     // 文件夹内文件数量（可选）
    private LocalDateTime createTime;  // 创建时间
}
