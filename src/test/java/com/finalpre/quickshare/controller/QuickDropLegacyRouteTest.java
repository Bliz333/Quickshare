package com.finalpre.quickshare.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.dto.TransferDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.TransferPairCodeCreateRequest;
import com.finalpre.quickshare.dto.TransferSyncRequest;
import com.finalpre.quickshare.service.FilePreviewPolicyService;
import com.finalpre.quickshare.service.OfficePreviewService;
import com.finalpre.quickshare.service.SystemSettingOverrideService;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.TransferDirectSessionVO;
import com.finalpre.quickshare.vo.TransferPairCodeVO;
import com.finalpre.quickshare.vo.TransferPublicShareVO;
import com.finalpre.quickshare.vo.TransferSyncVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({
        LegacyQuickDropAliasController.class,
        TransferController.class,
        TransferDirectSessionController.class,
        TransferPairingController.class,
        TransferRtcController.class,
        PublicTransferController.class
})
@AutoConfigureMockMvc(addFilters = false)
class QuickDropLegacyRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TransferService transferService;

    @MockBean
    private TransferPairingService transferPairingService;

    @MockBean
    private FilePreviewPolicyService filePreviewPolicyService;

    @MockBean
    private OfficePreviewService officePreviewService;

    @MockBean
    private TransferProperties transferProperties;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private SystemSettingOverrideService systemSettingOverrideService;

    @Test
    void quickDropHtmlShouldServeCompatibilityRedirectPage() throws Exception {
        mockMvc.perform(get("/quickdrop.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("transfer.html")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("window.location.replace")));
    }

    @Test
    void quickDropShareHtmlShouldServeCompatibilityRedirectPage() throws Exception {
        mockMvc.perform(get("/quickdrop-share.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("transfer-share.html")));
    }

    @Test
    void legacyQuickDropSyncPathShouldResolveToTransferController() throws Exception {
        when(transferService.syncDevice(eq(8L), any(TransferSyncRequest.class))).thenReturn(new TransferSyncVO());

        mockMvc.perform(post("/api/quickdrop/sync")
                        .principal(new TestingAuthenticationToken(8L, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TransferSyncRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void legacyQuickDropDirectSessionPathShouldResolve() throws Exception {
        TransferDirectSessionVO session = new TransferDirectSessionVO();
        session.setPairSessionId("pair-legacy-1");
        session.setSelfDeviceId("device-a");
        session.setPeerDeviceId("device-b");
        session.setPeerLabel("Legacy Peer");
        when(transferPairingService.createDirectSession(eq(8L), any(TransferDirectSessionCreateRequest.class))).thenReturn(session);

        mockMvc.perform(post("/api/quickdrop/direct-sessions")
                        .principal(new TestingAuthenticationToken(8L, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TransferDirectSessionCreateRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.pairSessionId").value("pair-legacy-1"))
                .andExpect(jsonPath("$.data.peerDeviceId").value("device-b"));
    }

    @Test
    void legacyPublicQuickDropRtcConfigPathShouldResolve() throws Exception {
        when(transferProperties.isDirectTransferEnabled()).thenReturn(true);
        when(transferProperties.getStunUrls()).thenReturn(List.of("stun:stun.l.google.com:19302"));
        when(transferProperties.getTurnUrls()).thenReturn(List.of());
        when(transferProperties.getTurnUrl()).thenReturn(null);

        mockMvc.perform(get("/api/public/quickdrop/rtc-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.directTransferEnabled").value(true))
                .andExpect(jsonPath("$.data.iceServers[0].urls[0]").value("stun:stun.l.google.com:19302"));
    }

    @Test
    void legacyPublicQuickDropPairCodePathShouldResolve() throws Exception {
        TransferPairCodeVO pairCode = new TransferPairCodeVO();
        pairCode.setCode("ABC123");
        pairCode.setCreatorChannelId("guest:legacy");
        pairCode.setCreatorLabel("Legacy Guest");
        pairCode.setExpireTime(LocalDateTime.of(2026, 4, 5, 12, 0));
        when(transferPairingService.createPairCode(isNull(), any(TransferPairCodeCreateRequest.class))).thenReturn(pairCode);

        mockMvc.perform(post("/api/public/quickdrop/pair-codes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TransferPairCodeCreateRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.code").value("ABC123"));
    }

    @Test
    void legacyPublicQuickDropSharePathShouldResolve() throws Exception {
        TransferPublicShareVO share = new TransferPublicShareVO();
        share.setShareToken("share-legacy-1");
        share.setFileName("legacy.txt");
        when(transferService.getPublicShare("share-legacy-1")).thenReturn(share);

        mockMvc.perform(get("/api/public/quickdrop/shares/share-legacy-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.shareToken").value("share-legacy-1"))
                .andExpect(jsonPath("$.data.fileName").value("legacy.txt"));
    }
}
