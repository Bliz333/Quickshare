package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class TransferSyncVO {
    private TransferDeviceVO currentDevice;
    private List<TransferDeviceVO> devices;
    private List<TransferTaskVO> incomingTasks;
    private List<TransferTaskVO> outgoingTasks;
    private List<TransferRelayVO> incomingTransfers;
    private List<TransferRelayVO> outgoingTransfers;
    private Integer recommendedChunkSize;
}
