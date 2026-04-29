package com.finalpre.quickshare.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.mapper.PaymentOrderMapper;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.PaymentService;
import com.finalpre.quickshare.utils.JwtUtil;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
class PaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PaymentService paymentService;

    @MockBean
    private PaymentOrderMapper paymentOrderMapper;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @Test
    void getMyOrdersShouldApplyDefaultLimit() throws Exception {
        PaymentOrder order = new PaymentOrder();
        order.setId(11L);
        order.setUserId(8L);
        when(paymentOrderMapper.selectList(any())).thenReturn(List.of(order));

        mockMvc.perform(get("/api/payment/orders")
                        .principal(new TestingAuthenticationToken(8L, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(11));

        ArgumentCaptor<QueryWrapper<PaymentOrder>> captor = ArgumentCaptor.forClass(QueryWrapper.class);
        org.mockito.Mockito.verify(paymentOrderMapper).selectList(captor.capture());
        assertThat(captor.getValue().getSqlSegment()).contains("LIMIT 20");
    }

    @Test
    void getMyOrdersShouldClampLargeLimit() throws Exception {
        when(paymentOrderMapper.selectList(any())).thenReturn(List.of());

        mockMvc.perform(get("/api/payment/orders?limit=500")
                        .principal(new TestingAuthenticationToken(8L, null)))
                .andExpect(status().isOk());

        ArgumentCaptor<QueryWrapper<PaymentOrder>> captor = ArgumentCaptor.forClass(QueryWrapper.class);
        org.mockito.Mockito.verify(paymentOrderMapper).selectList(captor.capture());
        assertThat(captor.getValue().getSqlSegment()).contains("LIMIT 100");
    }
}
