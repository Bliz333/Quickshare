package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.common.GlobalExceptionHandler;
import com.finalpre.quickshare.config.CorsProperties;
import com.finalpre.quickshare.config.JwtAuthEntryPoint;
import com.finalpre.quickshare.config.JwtAuthenticationFilter;
import com.finalpre.quickshare.config.SecurityConfig;
import com.finalpre.quickshare.config.WebConfig;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.service.UserService;
import com.finalpre.quickshare.service.impl.CorsPolicyServiceImpl;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.UserVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = ProfileController.class, properties = {
        "app.cors.allowed-origins=http://allowed.example",
        "app.cors.allow-credentials=false",
        "app.cors.max-age-seconds=3600"
})
@Import({
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        JwtAuthEntryPoint.class,
        GlobalExceptionHandler.class,
        WebConfig.class,
        CorsProperties.class,
        CorsPolicyServiceImpl.class
})
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private SystemSettingOverrideService systemSettingOverrideService;

    @Test
    void getProfileShouldRejectMissingToken() throws Exception {
        mockMvc.perform(get("/api/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未授权或登录已失效"));

        verifyNoInteractions(userService);
    }

    @Test
    void getProfileShouldReturnCurrentUser() throws Exception {
        User user = new User();
        user.setId(8L);
        user.setRole("ADMIN");

        UserVO profile = new UserVO();
        profile.setId(8L);
        profile.setUsername("tester1");
        profile.setNickname("Tester");
        profile.setRole("ADMIN");

        when(jwtUtil.validateAccessToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(8L);
        when(userMapper.selectById(8L)).thenReturn(user);
        when(userService.getProfile(8L)).thenReturn(profile);

        mockMvc.perform(get("/api/profile")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(8))
                .andExpect(jsonPath("$.data.username").value("tester1"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }
}
