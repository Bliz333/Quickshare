package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.UserRole;
import com.finalpre.quickshare.dto.LoginDTO;
import com.finalpre.quickshare.dto.RegisterDTO;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.UserService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.UserVO;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public UserVO register(RegisterDTO dto) {
        // 检查用户名是否存在
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("username", dto.getUsername());
        if (userMapper.selectCount(wrapper) > 0) {
            throw new IllegalArgumentException("用户名已存在");
        }

        // 创建用户
        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setEmail(dto.getEmail());
        user.setNickname(dto.getNickname() != null ? dto.getNickname() : dto.getUsername());
        user.setRole(UserRole.USER.name());

        userMapper.insert(user);

        // 生成 token
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

        // 返回 VO
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        vo.setToken(token);
        vo.setRole(user.getRole());

        return vo;
    }

    @Override
    public UserVO login(LoginDTO dto) {
        // 查询用户
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("username", dto.getUsername());
        User user = userMapper.selectOne(wrapper);

        if (user == null) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        // 验证密码
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        String role = UserRole.normalize(user.getRole());

        // 生成 token
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), role);

        // 返回 VO
        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        vo.setToken(token);
        vo.setRole(role);

        return vo;
    }

    @Override
    public UserVO getProfile(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new AuthenticationCredentialsNotFoundException("未授权或登录已失效");
        }

        UserVO vo = new UserVO();
        BeanUtils.copyProperties(user, vo);
        vo.setRole(UserRole.normalize(user.getRole()));
        vo.setToken(null);
        return vo;
    }
}
