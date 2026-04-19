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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
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

    @Test
    void publicRoomShouldBroadcastJoinedPeers() throws Exception {
        transferSignalingService.registerSession("guest:left", "Left Guest", "127.0.0.1", leftSession);
        transferSignalingService.registerSession("guest:right", "Right Guest", "10.0.0.2", rightSession);
        leftMessages.clear();
        rightMessages.clear();

        String roomCode = transferSignalingService.createPublicRoom("guest:left");
        transferSignalingService.joinPublicRoom("guest:right", roomCode);

        assertThat(transferSignalingService.getChannelRoomId("guest:left")).endsWith(roomCode);
        assertThat(transferSignalingService.getChannelRoomId("guest:right")).endsWith(roomCode);
        assertThat(leftMessages)
                .filteredOn(message -> "room-update".equals(message.get("type")))
                .last()
                .satisfies(message -> {
                    assertThat(message).containsEntry("roomScope", "public");
                    assertThat(message).containsEntry("roomCode", roomCode);
                    assertThat((List<?>) message.get("devices")).hasSize(2);
                });
        assertThat(rightMessages)
                .filteredOn(message -> "room-update".equals(message.get("type")))
                .last()
                .satisfies(message -> {
                    assertThat(message).containsEntry("roomScope", "public");
                    assertThat(message).containsEntry("roomCode", roomCode);
                    assertThat((List<?>) message.get("devices")).hasSize(2);
                });
    }

    @Test
    void leavingPublicRoomShouldReturnChannelToDefaultLanRoom() throws Exception {
        transferSignalingService.registerSession("guest:left", "Left Guest", "127.0.0.1", leftSession);
        transferSignalingService.registerSession("guest:right", "Right Guest", "10.0.0.2", rightSession);
        leftMessages.clear();
        rightMessages.clear();

        String roomCode = transferSignalingService.createPublicRoom("guest:left");
        transferSignalingService.joinPublicRoom("guest:right", roomCode);
        transferSignalingService.leavePublicRoom("guest:right");

        assertThat(transferSignalingService.getChannelRoomId("guest:right")).isEqualTo("room:10.0.0.2");
        assertThat(rightMessages)
                .filteredOn(message -> "room-update".equals(message.get("type")))
                .last()
                .satisfies(message -> {
                    assertThat(message).containsEntry("roomScope", "local");
                    assertThat(message).containsEntry("roomCode", "");
                });
        assertThat(leftMessages)
                .filteredOn(message -> "room-update".equals(message.get("type")))
                .last()
                .satisfies(message -> {
                    assertThat(message).containsEntry("roomScope", "public");
                    assertThat(message).containsEntry("roomCode", roomCode);
                    assertThat((List<?>) message.get("devices")).hasSize(1);
                });
    }

    @Test
    void requestRoomTransferShouldRejectChannelsInDifferentRooms() throws Exception {
        transferSignalingService.registerSession("guest:left", "Left Guest", "127.0.0.1", leftSession);
        transferSignalingService.registerSession("guest:right", "Right Guest", "10.0.0.2", rightSession);
        transferSignalingService.createPublicRoom("guest:left");

        assertThatThrownBy(() -> transferSignalingService.requestRoomTransfer("guest:left", "guest:right"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Both devices must be in the same discovery room");
    }

    @Test
    void getRoomIdShouldGroupIpv6AddressesByShared64Prefix() {
        String leftRoomId = transferSignalingService.getRoomId("240e:3a1:abcd:1200:1111:2222:3333:4444");
        String rightRoomId = transferSignalingService.getRoomId("240e:3a1:abcd:1200:aaaa:bbbb:cccc:dddd");
        String otherRoomId = transferSignalingService.getRoomId("240e:3a1:abcd:1201:1111:2222:3333:4444");

        assertThat(leftRoomId).isEqualTo("room:v6:240e03a1abcd1200");
        assertThat(rightRoomId).isEqualTo(leftRoomId);
        assertThat(otherRoomId).isNotEqualTo(leftRoomId);
    }

    private void stubSession(WebSocketSession session, List<Map<String, Object>> sink) throws Exception {
        lenient().when(session.isOpen()).thenReturn(true);
        lenient().doAnswer(invocation -> {
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
