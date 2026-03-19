package com.finalpre.quickshare.common;

import java.util.Locale;

public enum UserRole {
    USER,
    ADMIN;

    public static String normalize(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return USER.name();
        }

        try {
            return valueOf(rawRole.trim().toUpperCase(Locale.ROOT)).name();
        } catch (IllegalArgumentException ex) {
            return USER.name();
        }
    }

    public static String normalizeForManagement(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            throw new IllegalArgumentException("角色不能为空");
        }

        try {
            return valueOf(rawRole.trim().toUpperCase(Locale.ROOT)).name();
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("不支持的角色");
        }
    }
}
