package com.finalpre.quickshare.vo;

import lombok.Data;

import java.util.List;

@Data
public class TransferIceServerVO {
    private List<String> urls;
    private String username;
    private String credential;
}
