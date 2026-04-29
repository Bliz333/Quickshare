package com.finalpre.quickshare.utils;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secretString", "0123456789abcdef0123456789abcdef");
        ReflectionTestUtils.setField(jwtUtil, "expirationTime", 3_600_000L);
    }

    @Test
    void validateAccessTokenShouldRejectGuestUploadToken() {
        String guestToken = jwtUtil.generateGuestUploadToken(42L);

        assertThat(jwtUtil.validateAccessToken(guestToken)).isFalse();
        assertThat(jwtUtil.isGuestUploadToken(guestToken)).isTrue();
        assertThat(jwtUtil.validateGuestUploadToken(guestToken, 42L)).isTrue();
    }

    @Test
    void validateAccessTokenShouldRejectMalformedToken() {
        assertThat(jwtUtil.validateAccessToken("not-a-jwt")).isFalse();
        assertThat(jwtUtil.validateToken("not-a-jwt")).isFalse();
    }

    @Test
    void validateAccessTokenShouldAcceptGeneratedUserToken() {
        String token = jwtUtil.generateToken(7L, "alice");

        assertThat(jwtUtil.validateAccessToken(token)).isTrue();
        assertThat(jwtUtil.getUserIdFromToken(token)).isEqualTo(7L);
    }
}
