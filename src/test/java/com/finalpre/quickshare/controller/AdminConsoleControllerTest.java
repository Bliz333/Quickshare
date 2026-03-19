package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.AdminConsoleAccessService;
import com.finalpre.quickshare.utils.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminConsoleController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminConsoleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminConsoleAccessService adminConsoleAccessService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @Test
    void hiddenConsoleRouteShouldServeAdminHtml() throws Exception {
        when(adminConsoleAccessService.matchesSlug("secret-console")).thenReturn(true);

        mockMvc.perform(get("/console/secret-console"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void wrongConsoleSlugShouldReturnNotFound() throws Exception {
        when(adminConsoleAccessService.matchesSlug("wrong-console")).thenReturn(false);

        mockMvc.perform(get("/console/wrong-console"))
                .andExpect(status().isNotFound());
    }
}
