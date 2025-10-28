package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class FolderRequest {
    private String name;
    private Long parentId;  // 父文件夹ID，如果是根目录则为null或0
}