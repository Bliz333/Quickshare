package com.finalpre.quickshare.utils;

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

    private static final String DEFAULT_ROLE = "USER";

    @Value("${jwt.secret}")
    private String secretString;

    @Value("${jwt.expiration}")
    private long expirationTime;

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
                .claim("username", username)
                .claim("role", role == null || role.isEmpty() ? DEFAULT_ROLE : role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
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
        Object role = claims.get("role");
        if (role == null) {
            return DEFAULT_ROLE;
        }
        return role.toString();
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
