package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("file_info")
public class FileInfo {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String fileName;

    private String originalName;

    private String filePath;

    private Long fileSize;

    private String fileType;

    private String md5;

    private LocalDateTime uploadTime;

    @TableLogic
    private Integer deleted;

    private Integer isFolder;  // 0=文件，1=文件夹

    private Long parentId;  // 父文件夹ID，0表示根目录
}

