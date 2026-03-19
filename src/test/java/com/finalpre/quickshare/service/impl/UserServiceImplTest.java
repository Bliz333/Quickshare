package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.dto.LoginDTO;
import com.finalpre.quickshare.dto.RegisterDTO;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.UserVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void registerShouldPersistDefaultUserRole() {
        RegisterDTO dto = new RegisterDTO();
        dto.setUsername("alice");
        dto.setPassword("secret");
        dto.setEmail("alice@example.com");

        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("secret")).thenReturn("encoded-secret");
        doAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(7L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(jwtUtil.generateToken(7L, "alice", "USER")).thenReturn("jwt-user");

        UserVO result = userService.register(dto);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo("USER");
        assertThat(captor.getValue().getNickname()).isEqualTo("alice");
        assertThat(result.getRole()).isEqualTo("USER");
        assertThat(result.getToken()).isEqualTo("jwt-user");
    }

    @Test
    void loginShouldUsePersistedAdminRole() {
        LoginDTO dto = new LoginDTO();
        dto.setUsername("admin");
        dto.setPassword("secret");

        User user = new User();
        user.setId(9L);
        user.setUsername("admin");
        user.setPassword("encoded-secret");
        user.setRole("ADMIN");

        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("secret", "encoded-secret")).thenReturn(true);
        when(jwtUtil.generateToken(9L, "admin", "ADMIN")).thenReturn("jwt-admin");

        UserVO result = userService.login(dto);

        assertThat(result.getRole()).isEqualTo("ADMIN");
        assertThat(result.getToken()).isEqualTo("jwt-admin");
    }

    @Test
    void loginShouldDefaultMissingRoleToUser() {
        LoginDTO dto = new LoginDTO();
        dto.setUsername("bob");
        dto.setPassword("secret");

        User user = new User();
        user.setId(10L);
        user.setUsername("bob");
        user.setPassword("encoded-secret");
        user.setRole(null);

        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("secret", "encoded-secret")).thenReturn(true);
        when(jwtUtil.generateToken(10L, "bob", "USER")).thenReturn("jwt-bob");

        UserVO result = userService.login(dto);

        assertThat(result.getRole()).isEqualTo("USER");
        assertThat(result.getToken()).isEqualTo("jwt-bob");
    }

    @Test
    void getProfileShouldReturnCurrentPersistedRole() {
        User user = new User();
        user.setId(6L);
        user.setUsername("alice");
        user.setNickname("Alice");
        user.setRole("ADMIN");

        when(userMapper.selectById(6L)).thenReturn(user);

        UserVO result = userService.getProfile(6L);

        assertThat(result.getId()).isEqualTo(6L);
        assertThat(result.getUsername()).isEqualTo("alice");
        assertThat(result.getNickname()).isEqualTo("Alice");
        assertThat(result.getRole()).isEqualTo("ADMIN");
        assertThat(result.getToken()).isNull();
    }

    @Test
    void getProfileShouldRejectMissingUser() {
        when(userMapper.selectById(99L)).thenReturn(null);

        assertThatThrownBy(() -> userService.getProfile(99L))
                .isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class)
                .hasMessage("未授权或登录已失效");
    }
}
