package com.finalpre.quickshare.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("quickdrop_transfer")
public class QuickDropTransfer {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private String senderDeviceId;
    private String receiverDeviceId;
    private String taskKey;
    private Long taskId;
    private String transferKey;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private Integer chunkSize;
    private Integer totalChunks;
    private Integer uploadedChunks;
    private String status;
    private String assembledPath;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private LocalDateTime expireTime;
    private LocalDateTime downloadedAt;
}
