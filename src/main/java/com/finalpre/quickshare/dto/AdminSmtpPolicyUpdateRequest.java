package com.finalpre.quickshare.dto;

import lombok.Data;

@Data
public class AdminSmtpPolicyUpdateRequest {
    private String host;
    private Integer port;
    private String username;
    private String password;
    private Boolean starttlsEnabled;
    private String senderAddress;
}
