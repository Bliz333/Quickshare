package com.finalpre.quickshare.service;

/**
 * Encrypts and decrypts system setting values.
 * Sensitive config_value entries are stored with an "ENC:" prefix.
 */
public interface SettingEncryptor {

    String encrypt(String plainText);

    String decrypt(String cipherText);

    /** Check if a raw DB value is encrypted (starts with ENC:). */
    default boolean isEncrypted(String raw) {
        return raw != null && raw.startsWith("ENC:");
    }
}
