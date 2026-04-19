package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class TransferRtcConfigVO {
    private boolean directTransferEnabled;
    private List<TransferIceServerVO> iceServers;
}
