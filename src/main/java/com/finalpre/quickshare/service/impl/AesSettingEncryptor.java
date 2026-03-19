package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.service.SettingEncryptor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-GCM based encryptor for sensitive system settings.
 * The encryption key is derived from the SETTING_ENCRYPT_KEY environment variable.
 * If no key is configured, values are stored in plaintext (with a log warning on first use).
 */
@Slf4j
@Service
public class AesSettingEncryptor implements SettingEncryptor {

    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final String PREFIX = "ENC:";

    private final byte[] keyBytes;
    private final boolean enabled;

    public AesSettingEncryptor(
            @Value("${setting.encrypt-key:${SETTING_ENCRYPT_KEY:}}") String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            this.keyBytes = null;
            this.enabled = false;
            log.warn("SETTING_ENCRYPT_KEY not configured — sensitive settings will be stored in plaintext. "
                    + "Set SETTING_ENCRYPT_KEY (min 16 chars) to enable encryption.");
        } else {
            this.keyBytes = deriveKey(rawKey);
            this.enabled = true;
        }
    }

    @Override
    public String encrypt(String plainText) {
        if (!enabled || plainText == null) return plainText;
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] cipherBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // prepend IV to ciphertext
            byte[] combined = new byte[iv.length + cipherBytes.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherBytes, 0, combined, iv.length, cipherBytes.length);

            return PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Failed to encrypt setting value", e);
            throw new IllegalStateException("加密失败", e);
        }
    }

    @Override
    public String decrypt(String cipherText) {
        if (cipherText == null) return null;
        if (!isEncrypted(cipherText)) return cipherText; // plaintext passthrough

        if (!enabled) {
            log.warn("Encrypted value found but SETTING_ENCRYPT_KEY not configured — cannot decrypt");
            return null;
        }

        try {
            byte[] combined = Base64.getDecoder().decode(cipherText.substring(PREFIX.length()));
            byte[] iv = Arrays.copyOfRange(combined, 0, GCM_IV_LENGTH);
            byte[] encrypted = Arrays.copyOfRange(combined, GCM_IV_LENGTH, combined.length);

            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] plainBytes = cipher.doFinal(encrypted);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Failed to decrypt setting value", e);
            return null;
        }
    }

    private static byte[] deriveKey(String rawKey) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return sha256.digest(rawKey.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive encryption key", e);
        }
    }
}
