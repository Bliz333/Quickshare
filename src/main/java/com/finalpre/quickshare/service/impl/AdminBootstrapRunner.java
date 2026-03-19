package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.UserRole;
import com.finalpre.quickshare.config.BootstrapAdminProperties;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private final BootstrapAdminProperties bootstrapAdminProperties;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public AdminBootstrapRunner(BootstrapAdminProperties bootstrapAdminProperties,
                                UserMapper userMapper,
                                PasswordEncoder passwordEncoder) {
        this.bootstrapAdminProperties = bootstrapAdminProperties;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!bootstrapAdminProperties.isEnabled()) {
            return;
        }

        String username = requireValue(bootstrapAdminProperties.getUsername(), "启动管理员用户名不能为空");
        String password = requireValue(bootstrapAdminProperties.getPassword(), "启动管理员密码不能为空");
        String email = normalizeOptional(bootstrapAdminProperties.getEmail());
        String nickname = normalizeOptional(bootstrapAdminProperties.getNickname());

        User existingUser = findUserByUsername(username);
        if (existingUser == null) {
            createAdminUser(username, password, email, nickname);
            return;
        }

        updateAdminUserIfNecessary(existingUser, username, password, email, nickname);
    }

    private User findUserByUsername(String username) {
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("username", username);
        wrapper.last("LIMIT 1");
        return userMapper.selectOne(wrapper);
    }

    private void createAdminUser(String username, String password, String email, String nickname) {
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setEmail(email);
        user.setNickname(nickname != null ? nickname : username);
        user.setRole(UserRole.ADMIN.name());
        user.setCreateTime(LocalDateTime.now());

        userMapper.insert(user);
        log.info("Bootstrap admin account created. username={}", username);
    }

    private void updateAdminUserIfNecessary(User user,
                                            String username,
                                            String password,
                                            String email,
                                            String nickname) {
        boolean changed = false;

        if (!UserRole.ADMIN.name().equals(UserRole.normalize(user.getRole()))) {
            user.setRole(UserRole.ADMIN.name());
            changed = true;
        }

        if (email != null && !email.equals(user.getEmail())) {
            user.setEmail(email);
            changed = true;
        }

        String targetNickname = nickname != null ? nickname : normalizeOptional(user.getNickname()) == null ? username : null;
        if (targetNickname != null && !targetNickname.equals(user.getNickname())) {
            user.setNickname(targetNickname);
            changed = true;
        }

        if (bootstrapAdminProperties.isResetPasswordOnStartup()) {
            user.setPassword(passwordEncoder.encode(password));
            changed = true;
        }

        if (!changed) {
            log.info("Bootstrap admin account already ready. username={}", username);
            return;
        }

        userMapper.updateById(user);
        log.info("Bootstrap admin account updated. username={}, resetPassword={}",
                username, bootstrapAdminProperties.isResetPasswordOnStartup());
    }

    private String requireValue(String value, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
