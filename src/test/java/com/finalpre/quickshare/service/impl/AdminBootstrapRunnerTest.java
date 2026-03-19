package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.BootstrapAdminProperties;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapRunnerTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminBootstrapRunner adminBootstrapRunner;

    @BeforeEach
    void setUp() {
        BootstrapAdminProperties properties = new BootstrapAdminProperties();
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("secret");
        properties.setEmail("admin@example.com");
        properties.setNickname("Administrator");
        ReflectionTestUtils.setField(adminBootstrapRunner, "bootstrapAdminProperties", properties);
    }

    @Test
    void runShouldCreateAdminWhenMissing() throws Exception {
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("secret")).thenReturn("encoded-secret");
        doAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(1L);
            return 1;
        }).when(userMapper).insert(any(User.class));

        adminBootstrapRunner.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo("admin");
        assertThat(captor.getValue().getPassword()).isEqualTo("encoded-secret");
        assertThat(captor.getValue().getRole()).isEqualTo("ADMIN");
        assertThat(captor.getValue().getNickname()).isEqualTo("Administrator");
        assertThat(captor.getValue().getEmail()).isEqualTo("admin@example.com");
    }

    @Test
    void runShouldPromoteExistingUserWithoutResettingPassword() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setUsername("admin");
        user.setPassword("old-password");
        user.setRole("USER");
        user.setNickname(null);

        when(userMapper.selectOne(any())).thenReturn(user);

        adminBootstrapRunner.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo("ADMIN");
        assertThat(captor.getValue().getNickname()).isEqualTo("Administrator");
        assertThat(captor.getValue().getPassword()).isEqualTo("old-password");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void runShouldResetPasswordWhenConfigured() throws Exception {
        BootstrapAdminProperties properties = new BootstrapAdminProperties();
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("secret");
        properties.setResetPasswordOnStartup(true);
        ReflectionTestUtils.setField(adminBootstrapRunner, "bootstrapAdminProperties", properties);

        User user = new User();
        user.setId(9L);
        user.setUsername("admin");
        user.setPassword("old-password");
        user.setRole("ADMIN");
        user.setNickname("Admin");

        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.encode("secret")).thenReturn("encoded-secret");

        adminBootstrapRunner.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        assertThat(captor.getValue().getPassword()).isEqualTo("encoded-secret");
    }

    @Test
    void runShouldRejectMissingPasswordWhenEnabled() {
        BootstrapAdminProperties properties = new BootstrapAdminProperties();
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword(" ");
        ReflectionTestUtils.setField(adminBootstrapRunner, "bootstrapAdminProperties", properties);

        assertThatThrownBy(() -> adminBootstrapRunner.run(new DefaultApplicationArguments(new String[0])))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("启动管理员密码不能为空");
    }
}
