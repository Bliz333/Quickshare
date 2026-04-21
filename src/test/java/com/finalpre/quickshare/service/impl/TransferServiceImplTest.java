package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.dto.TransferCreateRequest;
import com.finalpre.quickshare.dto.TransferDirectAttemptSyncRequest;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.entity.TransferDevice;
import com.finalpre.quickshare.entity.TransferTask;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.mapper.TransferDeviceMapper;
import com.finalpre.quickshare.mapper.TransferTaskMapper;
import com.finalpre.quickshare.mapper.TransferRelayMapper;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.TransferTaskVO;
import com.finalpre.quickshare.vo.TransferRelayVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferServiceImplTest {

    @TempDir
    Path tempDir;

    @Mock
    private TransferDeviceMapper transferDeviceMapper;

    @Mock
    private TransferRelayMapper transferTransferMapper;

    @Mock
    private TransferTaskMapper transferTaskMapper;

    @Mock
    private FileService fileService;

    private TransferServiceImpl transferService;
    private Map<Long, TransferTask> taskStore;
    private AtomicLong taskIdSequence;

    @BeforeEach
    void setUp() {
        transferService = new TransferServiceImpl();
        ReflectionTestUtils.setField(transferService, "transferDeviceMapper", transferDeviceMapper);
        ReflectionTestUtils.setField(transferService, "transferTransferMapper", transferTransferMapper);
        ReflectionTestUtils.setField(transferService, "transferTaskMapper", transferTaskMapper);
        ReflectionTestUtils.setField(transferService, "fileService", fileService);

        FileConfig fileConfig = new FileConfig();
        ReflectionTestUtils.setField(fileConfig, "uploadDir", tempDir.toString());
        ReflectionTestUtils.setField(transferService, "fileConfig", fileConfig);

        TransferProperties properties = new TransferProperties();
        properties.setChunkSizeBytes(4);
        ReflectionTestUtils.setField(transferService, "transferProperties", properties);

        taskStore = new LinkedHashMap<>();
        taskIdSequence = new AtomicLong(200L);

        lenient().when(transferTaskMapper.selectOne(any())).thenReturn(null);
        lenient().when(transferTaskMapper.selectList(any())).thenAnswer(invocation -> List.copyOf(taskStore.values()));
        lenient().when(transferTaskMapper.selectById(any())).thenAnswer(invocation -> taskStore.get(invocation.getArgument(0)));
        lenient().doAnswer(invocation -> {
            TransferTask saved = invocation.getArgument(0);
            saved.setId(taskIdSequence.getAndIncrement());
            taskStore.put(saved.getId(), saved);
            return 1;
        }).when(transferTaskMapper).insert(any(TransferTask.class));
        lenient().doAnswer(invocation -> {
            TransferTask saved = invocation.getArgument(0);
            taskStore.put(saved.getId(), saved);
            return 1;
        }).when(transferTaskMapper).updateById(any(TransferTask.class));
        lenient().doAnswer(invocation -> {
            taskStore.remove(invocation.getArgument(0));
            return 1;
        }).when(transferTaskMapper).deleteById(any(Long.class));
    }

    @Test
    void uploadChunkShouldAssembleReadyTransferWhenAllChunksArrive() throws Exception {
        TransferRelay transfer = new TransferRelay();
        transfer.setId(51L);
        transfer.setUserId(8L);
        transfer.setSenderDeviceId("sender-device");
        transfer.setReceiverDeviceId("receiver-device");
        transfer.setTransferKey("tx-key");
        transfer.setFileName("hello.txt");
        transfer.setFileSize(10L);
        transfer.setContentType("text/plain");
        transfer.setChunkSize(5);
        transfer.setTotalChunks(2);
        transfer.setUploadedChunks(0);
        transfer.setStatus("pending_upload");
        transfer.setExpireTime(LocalDateTime.now().plusHours(1));

        when(transferTransferMapper.selectById(51L)).thenReturn(transfer);
        when(transferTransferMapper.updateById(any(TransferRelay.class))).thenReturn(1);

        TransferRelayVO firstChunk = transferService.uploadChunk(8L, 51L, "sender-device", 0, "hello".getBytes());
        assertThat(firstChunk.getStatus()).isEqualTo("uploading");
        assertThat(firstChunk.getUploadedChunkIndexes()).containsExactly(0);
        assertThat(firstChunk.getTask()).isNotNull();
        assertThat(firstChunk.getTask().getTransferMode()).isEqualTo("relay");
        assertThat(firstChunk.getTask().getCurrentTransferMode()).isEqualTo("relay");
        assertThat(firstChunk.getTask().getDirection()).isEqualTo("outgoing");
        assertThat(firstChunk.getTask().getPeerDeviceId()).isEqualTo("receiver-device");
        assertThat(firstChunk.getTask().getAttempts()).hasSize(1);
        assertThat(firstChunk.getTask().getAttempts().get(0).getTransferId()).isEqualTo("51");
        assertThat(firstChunk.getTask().getAttempts().get(0).getAttemptStatus()).isEqualTo("transferring");
        assertThat(firstChunk.getTask().getAttempts().get(0).getStartReason()).isEqualTo("relay_transfer_created");

        TransferRelayVO completed = transferService.uploadChunk(8L, 51L, "sender-device", 1, "world".getBytes());
        assertThat(completed.getStatus()).isEqualTo("ready");
        assertThat(completed.isReady()).isTrue();
        assertThat(completed.getUploadedChunks()).isEqualTo(2);
        assertThat(completed.getTaskId()).isNotNull();
        assertThat(completed.getTask()).isNotNull();
        assertThat(completed.getTask().getStage()).isEqualTo("ready");
        assertThat(completed.getTask().getCompletedChunks()).isEqualTo(2);
        assertThat(transfer.getAssembledPath()).isNotBlank();
        assertThat(Files.readString(Path.of(transfer.getAssembledPath()))).isEqualTo("helloworld");
    }

    @Test
    void createTransferShouldPersistTaskKey() {
        TransferDevice sender = new TransferDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);

        TransferDevice receiver = new TransferDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);

        when(transferDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(transferDeviceMapper.selectById("receiver-device")).thenReturn(receiver);
        doAnswer(invocation -> {
            TransferRelay saved = invocation.getArgument(0);
            saved.setId(88L);
            return 1;
        }).when(transferTransferMapper).insert(any(TransferRelay.class));

        TransferCreateRequest request = new TransferCreateRequest();
        request.setDeviceId("sender-device");
        request.setReceiverDeviceId("receiver-device");
        request.setTaskKey("outgoing|receiver-device|report.pdf|42|1710000000000");
        request.setFileName("report.pdf");
        request.setFileSize(42L);
        request.setContentType("application/pdf");
        request.setChunkSize(4);

        TransferRelayVO created = transferService.createTransfer(8L, request);
        assertThat(created.getTaskKey()).isEqualTo("outgoing|receiver-device|report.pdf|42|1710000000000");
        assertThat(created.getId()).isEqualTo(88L);
        assertThat(created.getTaskId()).isNotNull();
        assertThat(created.getDirection()).isEqualTo("outgoing");
        assertThat(created.getTransferMode()).isEqualTo("relay");
        assertThat(created.getPeerDeviceId()).isEqualTo("receiver-device");
        assertThat(created.getPeerLabel()).isEqualTo("receiver-device");
        assertThat(created.getTask()).isNotNull();
        assertThat(created.getTask().getTaskKey()).isEqualTo("outgoing|receiver-device|report.pdf|42|1710000000000");
        assertThat(created.getTask().getTransferMode()).isEqualTo("relay");
        assertThat(created.getTask().getCurrentTransferMode()).isEqualTo("relay");
        assertThat(created.getTask().getDirection()).isEqualTo("outgoing");
        assertThat(created.getTask().getAttempts()).hasSize(1);
        assertThat(created.getTask().getAttempts().get(0).getTransferId()).isEqualTo("88");
    }

    @Test
    void syncDirectAttemptShouldCreateUnifiedDirectTask() {
        TransferDevice sender = new TransferDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);
        sender.setDeviceName("Sender Device");

        TransferDevice receiver = new TransferDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);
        receiver.setDeviceName("Receiver Device");

        when(transferDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(transferDeviceMapper.selectById("receiver-device")).thenReturn(receiver);

        TransferDirectAttemptSyncRequest request = new TransferDirectAttemptSyncRequest();
        request.setDeviceId("sender-device");
        request.setSenderDeviceId("sender-device");
        request.setReceiverDeviceId("receiver-device");
        request.setClientTransferId("direct-1");
        request.setTaskKey("outgoing|receiver-device|clip.txt|6|1710000000000");
        request.setFileName("clip.txt");
        request.setFileSize(6L);
        request.setContentType("text/plain");
        request.setTotalChunks(3);
        request.setCompletedChunks(2);
        request.setStatus("sending");

        TransferTaskVO task = transferService.syncDirectAttempt(8L, request);
        assertThat(task.getId()).isNotNull();
        assertThat(task.getTaskKey()).isEqualTo("outgoing|receiver-device|clip.txt|6|1710000000000");
        assertThat(task.getTransferMode()).isEqualTo("direct");
        assertThat(task.getCurrentTransferMode()).isEqualTo("direct");
        assertThat(task.getDirection()).isEqualTo("outgoing");
        assertThat(task.getPeerDeviceId()).isEqualTo("receiver-device");
        assertThat(task.getCompletedChunks()).isEqualTo(2);
        assertThat(task.getAttemptStatus()).isEqualTo("transferring");
        assertThat(task.getStartReason()).isEqualTo("same_account_direct");
        assertThat(task.getAttempts()).hasSize(1);
        assertThat(task.getAttempts().get(0).getTransferId()).isEqualTo("direct-1");
        assertThat(task.getAttempts().get(0).getAttemptStatus()).isEqualTo("transferring");
        assertThat(task.getAttempts().get(0).getStartReason()).isEqualTo("same_account_direct");
    }

    @Test
    void syncDirectAttemptShouldRetainStartReasonAndTrackFallbackFailure() {
        TransferDevice sender = new TransferDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);
        sender.setDeviceName("Sender Device");

        TransferDevice receiver = new TransferDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);
        receiver.setDeviceName("Receiver Device");

        when(transferDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(transferDeviceMapper.selectById("receiver-device")).thenReturn(receiver);

        TransferDirectAttemptSyncRequest first = new TransferDirectAttemptSyncRequest();
        first.setDeviceId("sender-device");
        first.setSenderDeviceId("sender-device");
        first.setReceiverDeviceId("receiver-device");
        first.setClientTransferId("direct-fallback-1");
        first.setTaskKey("outgoing|receiver-device|clip.txt|6|1710000000000");
        first.setFileName("clip.txt");
        first.setFileSize(6L);
        first.setContentType("text/plain");
        first.setTotalChunks(3);
        first.setCompletedChunks(1);
        first.setStatus("sending");

        TransferTaskVO initial = transferService.syncDirectAttempt(8L, first);

        TransferDirectAttemptSyncRequest second = new TransferDirectAttemptSyncRequest();
        second.setTaskId(initial.getId());
        second.setDeviceId("sender-device");
        second.setSenderDeviceId("sender-device");
        second.setReceiverDeviceId("receiver-device");
        second.setClientTransferId("direct-fallback-1");
        second.setTaskKey("outgoing|receiver-device|clip.txt|6|1710000000000");
        second.setFileName("clip.txt");
        second.setFileSize(6L);
        second.setContentType("text/plain");
        second.setTotalChunks(3);
        second.setCompletedChunks(1);
        second.setStatus("relay_fallback");
        second.setFailureReason("peer_missed_offer");

        TransferTaskVO fallback = transferService.syncDirectAttempt(8L, second);
        assertThat(fallback.getAttemptStatus()).isEqualTo("relay_fallback");
        assertThat(fallback.getStartReason()).isEqualTo("same_account_direct");
        assertThat(fallback.getEndReason()).isEqualTo("relay_fallback");
        assertThat(fallback.getFailureReason()).isEqualTo("peer_missed_offer");
        assertThat(fallback.getFallbackAt()).isNotNull();
        assertThat(fallback.getAttempts()).hasSize(1);
        assertThat(fallback.getAttempts().get(0).getStartTime()).isEqualTo(initial.getAttempts().get(0).getStartTime());
        assertThat(fallback.getAttempts().get(0).getFailureReason()).isEqualTo("peer_missed_offer");
        assertThat(fallback.getAttempts().get(0).getFallbackAt()).isNotNull();
    }

    @Test
    void saveTransferToNetdiskShouldPersistSavedLifecycleState() throws Exception {
        TransferDevice receiver = new TransferDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);

        TransferTask task = new TransferTask();
        task.setId(301L);
        task.setUserId(8L);
        task.setTaskKey("incoming|sender-device|report.pdf|12|1710000000000");
        task.setSenderDeviceId("sender-device");
        task.setReceiverDeviceId("receiver-device");
        task.setFileName("report.pdf");
        task.setFileSize(12L);
        task.setContentType("application/pdf");
        task.setTransferMode("relay");
        task.setCurrentTransferMode("relay");
        task.setStatus("ready");
        task.setCompletedChunks(3);
        task.setTotalChunks(3);
        task.setAttemptsJson("[]");
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(task.getCreateTime());
        task.setExpireTime(task.getCreateTime().plusHours(1));
        taskStore.put(task.getId(), task);

        Path assembledPath = tempDir.resolve("report.pdf");
        Files.writeString(assembledPath, "hello report");

        TransferRelay transfer = new TransferRelay();
        transfer.setId(51L);
        transfer.setTaskId(301L);
        transfer.setTaskKey(task.getTaskKey());
        transfer.setUserId(8L);
        transfer.setSenderDeviceId("sender-device");
        transfer.setReceiverDeviceId("receiver-device");
        transfer.setFileName("report.pdf");
        transfer.setFileSize(12L);
        transfer.setContentType("application/pdf");
        transfer.setChunkSize(4);
        transfer.setTotalChunks(3);
        transfer.setUploadedChunks(3);
        transfer.setStatus("ready");
        transfer.setAssembledPath(assembledPath.toString());
        transfer.setExpireTime(LocalDateTime.now().plusHours(1));

        when(transferDeviceMapper.selectById("receiver-device")).thenReturn(receiver);
        when(transferTransferMapper.selectById(51L)).thenReturn(transfer);
        when(transferTransferMapper.updateById(any(TransferRelay.class))).thenReturn(1);

        FileInfoVO imported = new FileInfoVO();
        imported.setId(900L);
        imported.setOriginalName("report.pdf");
        when(fileService.importLocalFile(any(Path.class), any(String.class), any(String.class), any(Long.class), any(Long.class)))
                .thenReturn(imported);

        FileInfoVO result = transferService.saveTransferToNetdisk(8L, 51L, "receiver-device", 0L);

        assertThat(result.getId()).isEqualTo(900L);
        assertThat(transfer.getStatus()).isEqualTo("completed");
        assertThat(transfer.getDownloadedAt()).isNotNull();
        TransferTask savedTask = taskStore.get(301L);
        assertThat(savedTask.getSavedToNetdiskAt()).isNotNull();
        assertThat(savedTask.getCompletedAt()).isNotNull();
    }
}
