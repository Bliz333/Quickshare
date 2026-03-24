package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.config.QuickDropProperties;
import com.finalpre.quickshare.dto.QuickDropCreateTransferRequest;
import com.finalpre.quickshare.dto.QuickDropDirectAttemptSyncRequest;
import com.finalpre.quickshare.entity.QuickDropDevice;
import com.finalpre.quickshare.entity.QuickDropTask;
import com.finalpre.quickshare.entity.QuickDropTransfer;
import com.finalpre.quickshare.mapper.QuickDropDeviceMapper;
import com.finalpre.quickshare.mapper.QuickDropTaskMapper;
import com.finalpre.quickshare.mapper.QuickDropTransferMapper;
import com.finalpre.quickshare.vo.QuickDropTaskVO;
import com.finalpre.quickshare.vo.QuickDropTransferVO;
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
class QuickDropServiceImplTest {

    @TempDir
    Path tempDir;

    @Mock
    private QuickDropDeviceMapper quickDropDeviceMapper;

    @Mock
    private QuickDropTransferMapper quickDropTransferMapper;

    @Mock
    private QuickDropTaskMapper quickDropTaskMapper;

    private QuickDropServiceImpl quickDropService;
    private Map<Long, QuickDropTask> taskStore;
    private AtomicLong taskIdSequence;

    @BeforeEach
    void setUp() {
        quickDropService = new QuickDropServiceImpl();
        ReflectionTestUtils.setField(quickDropService, "quickDropDeviceMapper", quickDropDeviceMapper);
        ReflectionTestUtils.setField(quickDropService, "quickDropTransferMapper", quickDropTransferMapper);
        ReflectionTestUtils.setField(quickDropService, "quickDropTaskMapper", quickDropTaskMapper);

        FileConfig fileConfig = new FileConfig();
        ReflectionTestUtils.setField(fileConfig, "uploadDir", tempDir.toString());
        ReflectionTestUtils.setField(quickDropService, "fileConfig", fileConfig);

        QuickDropProperties properties = new QuickDropProperties();
        properties.setChunkSizeBytes(4);
        ReflectionTestUtils.setField(quickDropService, "quickDropProperties", properties);

        taskStore = new LinkedHashMap<>();
        taskIdSequence = new AtomicLong(200L);

        lenient().when(quickDropTaskMapper.selectOne(any())).thenReturn(null);
        lenient().when(quickDropTaskMapper.selectList(any())).thenAnswer(invocation -> List.copyOf(taskStore.values()));
        lenient().when(quickDropTaskMapper.selectById(any())).thenAnswer(invocation -> taskStore.get(invocation.getArgument(0)));
        lenient().doAnswer(invocation -> {
            QuickDropTask saved = invocation.getArgument(0);
            saved.setId(taskIdSequence.getAndIncrement());
            taskStore.put(saved.getId(), saved);
            return 1;
        }).when(quickDropTaskMapper).insert(any(QuickDropTask.class));
        lenient().doAnswer(invocation -> {
            QuickDropTask saved = invocation.getArgument(0);
            taskStore.put(saved.getId(), saved);
            return 1;
        }).when(quickDropTaskMapper).updateById(any(QuickDropTask.class));
        lenient().doAnswer(invocation -> {
            taskStore.remove(invocation.getArgument(0));
            return 1;
        }).when(quickDropTaskMapper).deleteById(any(Long.class));
    }

    @Test
    void uploadChunkShouldAssembleReadyTransferWhenAllChunksArrive() throws Exception {
        QuickDropTransfer transfer = new QuickDropTransfer();
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

        when(quickDropTransferMapper.selectById(51L)).thenReturn(transfer);
        when(quickDropTransferMapper.updateById(any(QuickDropTransfer.class))).thenReturn(1);

        QuickDropTransferVO firstChunk = quickDropService.uploadChunk(8L, 51L, "sender-device", 0, "hello".getBytes());
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

        QuickDropTransferVO completed = quickDropService.uploadChunk(8L, 51L, "sender-device", 1, "world".getBytes());
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
        QuickDropDevice sender = new QuickDropDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);

        QuickDropDevice receiver = new QuickDropDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);

        when(quickDropDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(quickDropDeviceMapper.selectById("receiver-device")).thenReturn(receiver);
        doAnswer(invocation -> {
            QuickDropTransfer saved = invocation.getArgument(0);
            saved.setId(88L);
            return 1;
        }).when(quickDropTransferMapper).insert(any(QuickDropTransfer.class));

        QuickDropCreateTransferRequest request = new QuickDropCreateTransferRequest();
        request.setDeviceId("sender-device");
        request.setReceiverDeviceId("receiver-device");
        request.setTaskKey("outgoing|receiver-device|report.pdf|42|1710000000000");
        request.setFileName("report.pdf");
        request.setFileSize(42L);
        request.setContentType("application/pdf");
        request.setChunkSize(4);

        QuickDropTransferVO created = quickDropService.createTransfer(8L, request);
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
        QuickDropDevice sender = new QuickDropDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);
        sender.setDeviceName("Sender Device");

        QuickDropDevice receiver = new QuickDropDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);
        receiver.setDeviceName("Receiver Device");

        when(quickDropDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(quickDropDeviceMapper.selectById("receiver-device")).thenReturn(receiver);

        QuickDropDirectAttemptSyncRequest request = new QuickDropDirectAttemptSyncRequest();
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

        QuickDropTaskVO task = quickDropService.syncDirectAttempt(8L, request);
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
        QuickDropDevice sender = new QuickDropDevice();
        sender.setDeviceId("sender-device");
        sender.setUserId(8L);
        sender.setDeviceName("Sender Device");

        QuickDropDevice receiver = new QuickDropDevice();
        receiver.setDeviceId("receiver-device");
        receiver.setUserId(8L);
        receiver.setDeviceName("Receiver Device");

        when(quickDropDeviceMapper.selectById("sender-device")).thenReturn(sender);
        when(quickDropDeviceMapper.selectById("receiver-device")).thenReturn(receiver);

        QuickDropDirectAttemptSyncRequest first = new QuickDropDirectAttemptSyncRequest();
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

        QuickDropTaskVO initial = quickDropService.syncDirectAttempt(8L, first);

        QuickDropDirectAttemptSyncRequest second = new QuickDropDirectAttemptSyncRequest();
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

        QuickDropTaskVO fallback = quickDropService.syncDirectAttempt(8L, second);
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
}
