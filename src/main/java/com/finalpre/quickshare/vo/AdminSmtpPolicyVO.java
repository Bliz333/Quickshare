package com.finalpre.quickshare.vo;

import lombok.Data;

@Data
public class AdminSmtpPolicyVO {
    private String host;
    private int port;
    private String username;
    private boolean hasPassword;
    private boolean starttlsEnabled;
    private String senderAddress;
}
