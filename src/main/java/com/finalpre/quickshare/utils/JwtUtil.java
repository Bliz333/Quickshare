package com.finalpre.quickshare.utils;

import com.finalpre.quickshare.common.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private static final String DEFAULT_ROLE = UserRole.USER.name();
    private static final String CLAIM_USERNAME = "username";
    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_PURPOSE = "purpose";
    private static final String PURPOSE_GUEST_UPLOAD = "guest-upload";
    private static final long GUEST_UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000L;

    @Value("${jwt.secret}")
    private String secretString;

    @Value("${jwt.expiration}")
    private long expirationTime;

    public long getAccessTokenExpirationSeconds() {
        return Math.max(expirationTime / 1000L, 0L);
    }

    // 延迟初始化密钥
    private SecretKey getSecretKey() {
        return Keys.hmacShaKeyFor(secretString.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String username) {
        return generateToken(userId, username, DEFAULT_ROLE);
    }

    public String generateToken(Long userId, String username, String role) {
        return Jwts.builder()
                .setSubject(userId.toString())
                .claim(CLAIM_USERNAME, username)
                .claim(CLAIM_ROLE, UserRole.normalize(role))
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
                .signWith(getSecretKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateGuestUploadToken(Long fileId) {
        if (fileId == null) {
            throw new IllegalArgumentException("文件ID不能为空");
        }

        long ttl = expirationTime > 0
                ? Math.min(expirationTime, GUEST_UPLOAD_TOKEN_TTL_MS)
                : GUEST_UPLOAD_TOKEN_TTL_MS;

        return Jwts.builder()
                .setSubject(fileId.toString())
                .claim(CLAIM_PURPOSE, PURPOSE_GUEST_UPLOAD)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + ttl))
                .signWith(getSecretKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSecretKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return Long.parseLong(claims.getSubject());
    }

    public String getRoleFromToken(String token) {
        Claims claims = parseToken(token);
        Object role = claims.get(CLAIM_ROLE);
        return UserRole.normalize(role == null ? null : role.toString());
    }

    public boolean validateAccessToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            Claims claims = parseToken(token);
            Object purpose = claims.get(CLAIM_PURPOSE);
            Object username = claims.get(CLAIM_USERNAME);
            return purpose == null && username != null && !username.toString().isBlank();
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isGuestUploadToken(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            Claims claims = parseToken(token);
            Object purpose = claims.get(CLAIM_PURPOSE);
            return PURPOSE_GUEST_UPLOAD.equals(purpose);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateGuestUploadToken(String token, Long fileId) {
        if (token == null || token.isBlank() || fileId == null) {
            return false;
        }

        try {
            Claims claims = parseToken(token);
            Object purpose = claims.get(CLAIM_PURPOSE);
            return PURPOSE_GUEST_UPLOAD.equals(purpose)
                    && fileId.toString().equals(claims.getSubject());
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
