package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.RegistrationSettingsPolicy;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.utils.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PublicSettingsController.class)
@AutoConfigureMockMvc(addFilters = false)
class PublicSettingsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RegistrationSettingsService registrationSettingsService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @Test
    void shouldExposePublicRegistrationSettings() throws Exception {
        when(registrationSettingsService.getPolicy()).thenReturn(new RegistrationSettingsPolicy(
                false,
                false,
                "recaptcha",
                "",
                "",
                "https://www.google.com/recaptcha/api/siteverify",
                "google-client-id",
                "apple-client-id"
        ));

        mockMvc.perform(get("/api/public/registration-settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.emailVerificationEnabled").value(false))
                .andExpect(jsonPath("$.data.recaptchaEnabled").value(false))
                .andExpect(jsonPath("$.data.googleClientId").value("google-client-id"))
                .andExpect(jsonPath("$.data.appleClientId").value("apple-client-id"));
    }
}
