package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class QuickDropSyncVO {
    private QuickDropDeviceVO currentDevice;
    private List<QuickDropDeviceVO> devices;
    private List<QuickDropTaskVO> incomingTasks;
    private List<QuickDropTaskVO> outgoingTasks;
    private List<QuickDropTransferVO> incomingTransfers;
    private List<QuickDropTransferVO> outgoingTransfers;
    private Integer recommendedChunkSize;
}
