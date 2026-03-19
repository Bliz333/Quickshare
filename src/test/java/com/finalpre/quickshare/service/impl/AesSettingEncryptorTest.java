package com.finalpre.quickshare.service.impl;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AesSettingEncryptorTest {

    @Test
    void encryptAndDecryptShouldRoundTrip() {
        AesSettingEncryptor encryptor = new AesSettingEncryptor("my-secret-key-for-testing");
        String original = "{\"host\":\"smtp.gmail.com\",\"password\":\"super-secret\"}";

        String encrypted = encryptor.encrypt(original);

        assertThat(encrypted).startsWith("ENC:");
        assertThat(encrypted).isNotEqualTo(original);

        String decrypted = encryptor.decrypt(encrypted);
        assertThat(decrypted).isEqualTo(original);
    }

    @Test
    void encryptShouldProduceDifferentCiphertextEachTime() {
        AesSettingEncryptor encryptor = new AesSettingEncryptor("my-secret-key");
        String original = "same-input";

        String enc1 = encryptor.encrypt(original);
        String enc2 = encryptor.encrypt(original);

        // Different IVs → different ciphertext
        assertThat(enc1).isNotEqualTo(enc2);

        // Both decrypt to same value
        assertThat(encryptor.decrypt(enc1)).isEqualTo(original);
        assertThat(encryptor.decrypt(enc2)).isEqualTo(original);
    }

    @Test
    void decryptShouldPassthroughPlaintext() {
        AesSettingEncryptor encryptor = new AesSettingEncryptor("key");
        String plaintext = "{\"host\":\"smtp.gmail.com\"}";

        // Not prefixed with ENC: → returned as-is
        assertThat(encryptor.decrypt(plaintext)).isEqualTo(plaintext);
    }

    @Test
    void disabledEncryptorShouldPassthrough() {
        AesSettingEncryptor encryptor = new AesSettingEncryptor("");
        String original = "some-value";

        // No key → encryption disabled, returns plaintext
        assertThat(encryptor.encrypt(original)).isEqualTo(original);
    }

    @Test
    void wrongKeyShouldFailDecryption() {
        AesSettingEncryptor enc1 = new AesSettingEncryptor("key-one");
        AesSettingEncryptor enc2 = new AesSettingEncryptor("key-two");

        String encrypted = enc1.encrypt("secret-data");
        String decrypted = enc2.decrypt(encrypted);

        // Wrong key → decryption fails, returns null
        assertThat(decrypted).isNull();
    }

    @Test
    void isEncryptedShouldDetectPrefix() {
        AesSettingEncryptor encryptor = new AesSettingEncryptor("key");

        assertThat(encryptor.isEncrypted("ENC:abc123")).isTrue();
        assertThat(encryptor.isEncrypted("{\"plain\":true}")).isFalse();
        assertThat(encryptor.isEncrypted(null)).isFalse();
    }
}
