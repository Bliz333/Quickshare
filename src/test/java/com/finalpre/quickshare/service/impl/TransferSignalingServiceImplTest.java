package com.finalpre.quickshare.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferSignalingServiceImplTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private WebSocketSession leftSession;

    @Mock
    private WebSocketSession rightSession;

    private TransferSignalingServiceImpl transferSignalingService;
    private List<Map<String, Object>> leftMessages;
    private List<Map<String, Object>> rightMessages;

    @BeforeEach
    void setUp() throws Exception {
        transferSignalingService = new TransferSignalingServiceImpl();
        leftMessages = new ArrayList<>();
        rightMessages = new ArrayList<>();
        stubSession(leftSession, leftMessages);
        stubSession(rightSession, rightMessages);
    }

    @Test
    void bindPairSessionShouldAllowGuestChannelsWithoutDeviceId() throws Exception {
        transferSignalingService.registerSession("guest:left", "Left Guest", "127.0.0.1", leftSession);
        transferSignalingService.registerSession("guest:right", "Right Guest", "127.0.0.1", rightSession);
        leftMessages.clear();
        rightMessages.clear();

        transferSignalingService.bindPairSession("pair-guest-1", "guest:left", "guest:right");

        assertThat(leftMessages).singleElement().satisfies(message -> {
            assertThat(message).containsEntry("type", "pair-ready");
            assertThat(message).containsEntry("pairSessionId", "pair-guest-1");
            assertThat(message).containsEntry("peerChannelId", "guest:right");
            assertThat(message).containsEntry("peerDeviceId", "");
            assertThat(message).containsEntry("peerLabel", "Right Guest");
        });
        assertThat(rightMessages).singleElement().satisfies(message -> {
            assertThat(message).containsEntry("type", "pair-ready");
            assertThat(message).containsEntry("pairSessionId", "pair-guest-1");
            assertThat(message).containsEntry("peerChannelId", "guest:left");
            assertThat(message).containsEntry("peerDeviceId", "");
            assertThat(message).containsEntry("peerLabel", "Left Guest");
        });
    }

    private void stubSession(WebSocketSession session, List<Map<String, Object>> sink) throws Exception {
        when(session.isOpen()).thenReturn(true);
        doAnswer(invocation -> {
            TextMessage message = invocation.getArgument(0);
            sink.add(readPayload(message));
            return null;
        }).when(session).sendMessage(any(TextMessage.class));
    }

    private Map<String, Object> readPayload(TextMessage message) throws IOException {
        return objectMapper.readValue(message.getPayload(), new TypeReference<>() {
        });
    }
}
