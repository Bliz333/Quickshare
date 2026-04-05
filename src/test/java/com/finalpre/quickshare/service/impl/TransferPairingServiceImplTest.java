package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.dto.TransferDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.TransferPairCodeClaimRequest;
import com.finalpre.quickshare.dto.TransferPairCodeCreateRequest;
import com.finalpre.quickshare.dto.TransferPairTaskSyncRequest;
import com.finalpre.quickshare.entity.TransferDevice;
import com.finalpre.quickshare.entity.TransferPairTask;
import com.finalpre.quickshare.mapper.TransferDeviceMapper;
import com.finalpre.quickshare.mapper.TransferPairTaskMapper;
import com.finalpre.quickshare.service.TransferSignalingService;
import com.finalpre.quickshare.vo.TransferDirectSessionVO;
import com.finalpre.quickshare.vo.TransferPairClaimVO;
import com.finalpre.quickshare.vo.TransferPairCodeVO;
import com.finalpre.quickshare.vo.TransferPairTaskVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferPairingServiceImplTest {

    @Mock
    private TransferSignalingService transferSignalingService;

    @Mock
    private TransferDeviceMapper transferDeviceMapper;

    @Mock
    private TransferPairTaskMapper transferPairTaskMapper;

    private TransferPairingServiceImpl transferPairingService;
    private Map<Long, TransferPairTask> pairTaskStore;
    private AtomicLong pairTaskIdSequence;

    @BeforeEach
    void setUp() throws Exception {
        transferPairingService = new TransferPairingServiceImpl();
        TransferProperties properties = new TransferProperties();
        properties.setPairCodeTtlMinutes(10);
        properties.setTransferTtlHours(72);
        ReflectionTestUtils.setField(transferPairingService, "transferProperties", properties);
        ReflectionTestUtils.setField(transferPairingService, "transferSignalingService", transferSignalingService);
        ReflectionTestUtils.setField(transferPairingService, "transferDeviceMapper", transferDeviceMapper);
        ReflectionTestUtils.setField(transferPairingService, "transferPairTaskMapper", transferPairTaskMapper);
        lenient().doNothing().when(transferSignalingService).bindPairSession(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());

        pairTaskStore = new LinkedHashMap<>();
        pairTaskIdSequence = new AtomicLong(500L);
        lenient().when(transferPairTaskMapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(null);
        lenient().when(transferPairTaskMapper.selectList(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> List.copyOf(pairTaskStore.values()));
        lenient().when(transferPairTaskMapper.selectById(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> pairTaskStore.get(invocation.getArgument(0)));
        lenient().doAnswer(invocation -> {
            TransferPairTask saved = invocation.getArgument(0);
            saved.setId(pairTaskIdSequence.getAndIncrement());
            pairTaskStore.put(saved.getId(), saved);
            return 1;
        }).when(transferPairTaskMapper).insert(org.mockito.ArgumentMatchers.any(TransferPairTask.class));
        lenient().doAnswer(invocation -> {
            TransferPairTask saved = invocation.getArgument(0);
            pairTaskStore.put(saved.getId(), saved);
            return 1;
        }).when(transferPairTaskMapper).updateById(org.mockito.ArgumentMatchers.any(TransferPairTask.class));
        lenient().doAnswer(invocation -> {
            pairTaskStore.remove(invocation.getArgument(0));
            return 1;
        }).when(transferPairTaskMapper).deleteById(org.mockito.ArgumentMatchers.any(Long.class));
    }

    @Test
    void createAndClaimPairCodeShouldReturnPairSession() {
        TransferPairCodeCreateRequest createRequest = new TransferPairCodeCreateRequest();
        createRequest.setGuestId("guest-a");
        createRequest.setDeviceName("Guest A");

        TransferPairCodeVO created = transferPairingService.createPairCode(null, createRequest);
        assertThat(created.getCode()).hasSize(6);
        assertThat(created.getCreatorChannelId()).isEqualTo("guest:guest-a");

        TransferPairCodeClaimRequest claimRequest = new TransferPairCodeClaimRequest();
        claimRequest.setGuestId("guest-b");
        claimRequest.setDeviceName("Guest B");

        TransferPairClaimVO claimed = transferPairingService.claimPairCode(null, created.getCode(), claimRequest);
        assertThat(claimed.getPairSessionId()).isNotBlank();
        assertThat(claimed.getPeerChannelId()).isEqualTo("guest:guest-a");
        assertThat(claimed.getSelfChannelId()).isEqualTo("guest:guest-b");
    }

    @Test
    void createDirectSessionShouldBindSameAccountDevices() {
        TransferDevice selfDevice = new TransferDevice();
        selfDevice.setDeviceId("device-a");
        selfDevice.setUserId(9L);
        selfDevice.setDeviceName("Office Mac");

        TransferDevice peerDevice = new TransferDevice();
        peerDevice.setDeviceId("device-b");
        peerDevice.setUserId(9L);
        peerDevice.setDeviceName("Office PC");

        when(transferDeviceMapper.selectById("device-a")).thenReturn(selfDevice);
        when(transferDeviceMapper.selectById("device-b")).thenReturn(peerDevice);
        when(transferSignalingService.isConnected("user:9:device:device-a")).thenReturn(true);
        when(transferSignalingService.isConnected("user:9:device:device-b")).thenReturn(true);

        TransferDirectSessionCreateRequest request = new TransferDirectSessionCreateRequest();
        request.setDeviceId("device-a");
        request.setTargetDeviceId("device-b");

        TransferDirectSessionVO session = transferPairingService.createDirectSession(9L, request);
        assertThat(session.getPairSessionId()).isNotBlank();
        assertThat(session.getSelfDeviceId()).isEqualTo("device-a");
        assertThat(session.getPeerDeviceId()).isEqualTo("device-b");
        assertThat(session.getPeerLabel()).isEqualTo("Office PC");
    }

    @Test
    void syncPairTaskShouldCreatePublicDirectTaskRecord() {
        TransferPairTaskSyncRequest request = new TransferPairTaskSyncRequest();
        request.setPairSessionId("pair-public-1");
        request.setSelfChannelId("guest:sender");
        request.setPeerChannelId("guest:receiver");
        request.setSelfLabel("Guest Sender");
        request.setPeerLabel("Guest Receiver");
        request.setClientTransferId("pair-transfer-1");
        request.setTaskKey("pair:pair-transfer-1");
        request.setFileName("public-direct.txt");
        request.setFileSize(11L);
        request.setContentType("text/plain");
        request.setTotalChunks(2);
        request.setCompletedChunks(1);
        request.setStatus("sending");

        TransferPairTaskVO task = transferPairingService.syncPairTask(request);
        assertThat(task.getId()).isNotNull();
        assertThat(task.getPairSessionId()).isEqualTo("pair-public-1");
        assertThat(task.getTaskKey()).isEqualTo("pair:pair-transfer-1");
        assertThat(task.getTransferMode()).isEqualTo("direct");
        assertThat(task.getCurrentTransferMode()).isEqualTo("direct");
        assertThat(task.getDirection()).isEqualTo("outgoing");
        assertThat(task.getPeerChannelId()).isEqualTo("guest:receiver");
        assertThat(task.getAttemptStatus()).isEqualTo("transferring");
        assertThat(task.getStartReason()).isEqualTo("pair_session_direct");
        assertThat(task.getAttempts()).hasSize(1);
        assertThat(task.getAttempts().get(0).getTransferId()).isEqualTo("pair-transfer-1");
        assertThat(task.getAttempts().get(0).getAttemptStatus()).isEqualTo("transferring");
        assertThat(task.getAttempts().get(0).getStartReason()).isEqualTo("pair_session_direct");
    }

    @Test
    void listPairTasksShouldProjectIncomingAndOutgoingTasksForCurrentChannel() {
        TransferPairTaskSyncRequest outgoingRequest = new TransferPairTaskSyncRequest();
        outgoingRequest.setPairSessionId("pair-public-1");
        outgoingRequest.setSelfChannelId("guest:self");
        outgoingRequest.setPeerChannelId("guest:peer");
        outgoingRequest.setSelfLabel("Self");
        outgoingRequest.setPeerLabel("Peer");
        outgoingRequest.setClientTransferId("pair-transfer-out");
        outgoingRequest.setTaskKey("pair:pair-transfer-out");
        outgoingRequest.setFileName("outgoing.txt");
        outgoingRequest.setFileSize(12L);
        outgoingRequest.setContentType("text/plain");
        outgoingRequest.setTotalChunks(2);
        outgoingRequest.setCompletedChunks(1);
        outgoingRequest.setStatus("sending");
        transferPairingService.syncPairTask(outgoingRequest);

        TransferPairTaskSyncRequest incomingRequest = new TransferPairTaskSyncRequest();
        incomingRequest.setPairSessionId("pair-public-1");
        incomingRequest.setSelfChannelId("guest:peer");
        incomingRequest.setPeerChannelId("guest:self");
        incomingRequest.setSelfLabel("Peer");
        incomingRequest.setPeerLabel("Self");
        incomingRequest.setClientTransferId("pair-transfer-in");
        incomingRequest.setTaskKey("pair:pair-transfer-in");
        incomingRequest.setFileName("incoming.txt");
        incomingRequest.setFileSize(24L);
        incomingRequest.setContentType("text/plain");
        incomingRequest.setTotalChunks(3);
        incomingRequest.setCompletedChunks(3);
        incomingRequest.setStatus("completed");
        transferPairingService.syncPairTask(incomingRequest);

        List<TransferPairTaskVO> tasks = transferPairingService.listPairTasks("pair-public-1", "guest:self");
        assertThat(tasks).hasSize(2);
        assertThat(tasks).extracting(TransferPairTaskVO::getDirection).containsExactly("incoming", "outgoing");
        assertThat(tasks).extracting(TransferPairTaskVO::getPeerChannelId).containsExactly("guest:peer", "guest:peer");
        assertThat(tasks).extracting(TransferPairTaskVO::getFileName).containsExactly("incoming.txt", "outgoing.txt");
        assertThat(tasks.get(0).getAttempts()).hasSize(1);
        assertThat(tasks.get(0).getAttempts().get(0).getTransferId()).isEqualTo("pair-transfer-in");
        assertThat(tasks.get(1).getAttempts()).hasSize(1);
        assertThat(tasks.get(1).getAttempts().get(0).getTransferId()).isEqualTo("pair-transfer-out");
    }

    @Test
    void syncPairTaskShouldTrackFailureLifecycle() {
        TransferPairTaskSyncRequest initial = new TransferPairTaskSyncRequest();
        initial.setPairSessionId("pair-public-2");
        initial.setSelfChannelId("guest:self");
        initial.setPeerChannelId("guest:peer");
        initial.setSelfLabel("Self");
        initial.setPeerLabel("Peer");
        initial.setClientTransferId("pair-transfer-fail");
        initial.setTaskKey("pair:pair-transfer-fail");
        initial.setFileName("broken.txt");
        initial.setFileSize(12L);
        initial.setContentType("text/plain");
        initial.setTotalChunks(2);
        initial.setCompletedChunks(1);
        initial.setStatus("sending");
        transferPairingService.syncPairTask(initial);

        TransferPairTaskSyncRequest failed = new TransferPairTaskSyncRequest();
        failed.setPairSessionId("pair-public-2");
        failed.setSelfChannelId("guest:self");
        failed.setPeerChannelId("guest:peer");
        failed.setSelfLabel("Self");
        failed.setPeerLabel("Peer");
        failed.setClientTransferId("pair-transfer-fail");
        failed.setTaskKey("pair:pair-transfer-fail");
        failed.setFileName("broken.txt");
        failed.setFileSize(12L);
        failed.setContentType("text/plain");
        failed.setTotalChunks(2);
        failed.setCompletedChunks(1);
        failed.setStatus("failed");
        failed.setFailureReason("peer_reported_error");

        TransferPairTaskVO task = transferPairingService.syncPairTask(failed);
        assertThat(task.getId()).isNotNull();
        assertThat(task.getAttemptStatus()).isEqualTo("failed");
        assertThat(task.getFailureReason()).isEqualTo("peer_reported_error");
        assertThat(task.getFailedAt()).isNotNull();
        assertThat(task.getAttempts()).hasSize(1);
        assertThat(task.getAttempts().get(0).getFailureReason()).isEqualTo("peer_reported_error");
        assertThat(task.getAttempts().get(0).getFailedAt()).isNotNull();
    }
}
