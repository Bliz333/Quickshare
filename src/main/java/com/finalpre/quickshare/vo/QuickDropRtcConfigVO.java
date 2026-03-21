package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class QuickDropRtcConfigVO {
    private boolean directTransferEnabled;
    private List<QuickDropIceServerVO> iceServers;
}
