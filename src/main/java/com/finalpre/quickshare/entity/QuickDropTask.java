package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("quickdrop_task")
public class QuickDropTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private String taskKey;
    private String senderDeviceId;
    private String receiverDeviceId;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer totalChunks;
    private String transferMode;
    private String currentTransferMode;
    private String status;
    private Integer completedChunks;
    private String attemptsJson;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime expireTime;
    private LocalDateTime completedAt;
    private LocalDateTime savedToNetdiskAt;
}
