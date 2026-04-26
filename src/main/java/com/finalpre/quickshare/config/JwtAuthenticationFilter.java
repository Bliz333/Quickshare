package com.finalpre.quickshare.config;

import com.finalpre.quickshare.common.UserRole;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.utils.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserMapper userMapper;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserMapper userMapper) {
        this.jwtUtil = jwtUtil;
        this.userMapper = userMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String token = null;
        boolean tokenFromHeader = false;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String headerToken = authHeader.substring(7);
            if (jwtUtil.validateAccessToken(headerToken)) {
                token = headerToken;
                tokenFromHeader = true;
            }
        }
        if (token == null || token.isBlank()) {
            String cookieToken = AuthCookieSupport.resolveAccessToken(request);
            if (jwtUtil.validateAccessToken(cookieToken)) {
                token = cookieToken;
            }
        }
        if (token == null || token.isBlank()) {
            String paramToken = request.getParameter("token");
            if (jwtUtil.validateAccessToken(paramToken)) {
                token = paramToken;
            }
        }

        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        Long userId = jwtUtil.getUserIdFromToken(token);
        User user = userMapper.selectById(userId);
        if (user == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String role = UserRole.normalize(user.getRole());

        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                userId,
                null,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
        );
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        if (tokenFromHeader) {
            AuthCookieSupport.writeAccessTokenCookie(request, response, token, jwtUtil.getAccessTokenExpirationSeconds());
        }
        filterChain.doFilter(request, response);
    }
}
