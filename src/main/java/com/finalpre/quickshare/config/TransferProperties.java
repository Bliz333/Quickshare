package com.finalpre.quickshare.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "app.transfer")
public class TransferProperties {

    private int presenceTimeoutSeconds = 45;
    private int transferTtlHours = 72;
    private int chunkSizeBytes = 2 * 1024 * 1024;
    private int pairCodeTtlMinutes = 10;
    private int syncTaskLimit = 50;
    private boolean directTransferEnabled = true;
    private List<String> stunUrls = new ArrayList<>(List.of("stun:stun.l.google.com:19302"));
    private List<String> turnUrls = new ArrayList<>();
    private String turnUrl = "";
    private String turnUsername = "";
    private String turnPassword = "";
}
