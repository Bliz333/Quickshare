package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("share_link")
public class ShareLink {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long fileId;

    private String shareCode;

    private String extractCode;

    private LocalDateTime expireTime;

    private Integer downloadCount;

    private Integer maxDownload;

    private LocalDateTime createTime;

    private Integer status;
}