package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.entity.PaymentProvider;
import com.finalpre.quickshare.mapper.PaymentProviderMapper;
import com.finalpre.quickshare.mapper.PlanMapper;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.utils.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlanController.class)
@AutoConfigureMockMvc(addFilters = false)
class PlanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PlanMapper planMapper;

    @MockBean
    private PaymentProviderMapper paymentProviderMapper;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @Test
    void shouldExposeNormalizedPaymentOptionsFromDefaultProvider() throws Exception {
        PaymentProvider provider = new PaymentProvider();
        provider.setId(6L);
        provider.setName("Primary Provider");
        provider.setPayTypes(" ALIPAY , wxpay,wxpay ");
        provider.setEnabled(1);

        when(paymentProviderMapper.selectOne(any())).thenReturn(provider);

        mockMvc.perform(get("/api/public/payment-options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.providerId").value(6))
                .andExpect(jsonPath("$.data.providerName").value("Primary Provider"))
                .andExpect(jsonPath("$.data.payTypes[0]").value("alipay"))
                .andExpect(jsonPath("$.data.payTypes[1]").value("wxpay"));
    }

    @Test
    void shouldFallbackToAlipayWhenProviderPayTypesBlank() throws Exception {
        PaymentProvider provider = new PaymentProvider();
        provider.setId(7L);
        provider.setName("Fallback Provider");
        provider.setPayTypes("   ");
        provider.setEnabled(1);

        when(paymentProviderMapper.selectOne(any())).thenReturn(provider);

        mockMvc.perform(get("/api/public/payment-options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.providerId").value(7))
                .andExpect(jsonPath("$.data.payTypes[0]").value("alipay"));
    }
}
