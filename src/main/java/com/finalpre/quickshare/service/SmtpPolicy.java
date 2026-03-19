package com.finalpre.quickshare.service;

public record SmtpPolicy(
        String host,
        int port,
        String username,
        String password,
        boolean starttlsEnabled,
        String senderAddress
) {}
