package com.finalpre.quickshare.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.dto.TransferCreateRequest;
import com.finalpre.quickshare.dto.TransferDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.TransferPublicShareCreateRequest;
import com.finalpre.quickshare.dto.TransferSyncRequest;
import com.finalpre.quickshare.entity.TransferDevice;
import com.finalpre.quickshare.entity.TransferPublicShare;
import com.finalpre.quickshare.entity.TransferTask;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.mapper.TransferDeviceMapper;
import com.finalpre.quickshare.mapper.TransferPublicShareMapper;
import com.finalpre.quickshare.mapper.TransferTaskMapper;
import com.finalpre.quickshare.mapper.TransferRelayMapper;
import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.TransferDeviceVO;
import com.finalpre.quickshare.vo.TransferPublicShareVO;
import com.finalpre.quickshare.vo.TransferSyncVO;
import com.finalpre.quickshare.vo.TransferTaskAttemptVO;
import com.finalpre.quickshare.vo.TransferTaskVO;
import com.finalpre.quickshare.vo.TransferRelayVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
public class TransferServiceImpl implements TransferService {

    static final String STATUS_PENDING_UPLOAD = "pending_upload";
    static final String STATUS_UPLOADING = "uploading";
    static final String STATUS_READY = "ready";
    static final String STATUS_COMPLETED = "completed";
    static final String STATUS_CANCELLED = "cancelled";

    private static final String MODE_RELAY = "relay";
    private static final String MODE_DIRECT = "direct";
    private static final String MODE_HYBRID = "hybrid";

    private static final int MIN_CHUNK_SIZE = 256 * 1024;
    private static final int MAX_CHUNK_SIZE = 8 * 1024 * 1024;

    private static final ObjectMapper QUICKDROP_OBJECT_MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    @Autowired
    private TransferDeviceMapper transferDeviceMapper;

    @Autowired
    private TransferRelayMapper transferTransferMapper;

    @Autowired
    private TransferTaskMapper transferTaskMapper;

    @Autowired
    private TransferPublicShareMapper transferPublicShareMapper;

    @Autowired
    private FileConfig fileConfig;

    @Autowired
    private TransferProperties transferProperties;

    @Autowired
    private FileService fileService;

    @Autowired
    private com.finalpre.quickshare.service.TransferSignalingService transferSignalingService;

    @Override
    public TransferSyncVO syncDevice(Long userId, TransferSyncRequest request) {
        String deviceId = normalizeDeviceId(request.getDeviceId());
        LocalDateTime now = LocalDateTime.now();

        TransferDevice device = transferDeviceMapper.selectById(deviceId);
        if (device != null && !Objects.equals(device.getUserId(), userId)) {
            throw new IllegalArgumentException("设备标识不可复用");
        }

        if (device == null) {
            device = new TransferDevice();
            device.setDeviceId(deviceId);
            device.setUserId(userId);
            device.setCreateTime(now);
        }

        device.setDeviceName(normalizeDeviceName(request.getDeviceName(), request.getDeviceType()));
        device.setDeviceType(normalizeDeviceType(request.getDeviceType()));
        device.setLastSeenAt(now);
        device.setUpdateTime(now);

        if (transferDeviceMapper.selectById(deviceId) == null) {
            transferDeviceMapper.insert(device);
        } else {
            transferDeviceMapper.updateById(device);
        }

        List<TransferDeviceVO> devices = loadDevices(userId, deviceId, now);
        Map<String, String> deviceNameLookup = buildDeviceNameLookup(devices);
        deviceNameLookup.put(device.getDeviceId(), device.getDeviceName());
        backfillLegacyTasks(userId, deviceId);

        TransferSyncVO vo = new TransferSyncVO();
        vo.setCurrentDevice(toDeviceVO(device, deviceId, now));
        vo.setDevices(devices);
        vo.setIncomingTasks(loadTasks(userId, "receiver_device_id", deviceId, deviceNameLookup));
        vo.setOutgoingTasks(loadTasks(userId, "sender_device_id", deviceId, deviceNameLookup));
        vo.setIncomingTransfers(loadTransfers(userId, "receiver_device_id", deviceId, false, "incoming", deviceNameLookup));
        vo.setOutgoingTransfers(loadTransfers(userId, "sender_device_id", deviceId, false, "outgoing", deviceNameLookup));
        vo.setRecommendedChunkSize(normalizeChunkSize(null));
        return vo;
    }

    @Override
    public TransferRelayVO createTransfer(Long userId, TransferCreateRequest request) {
        String senderDeviceId = normalizeDeviceId(request.getDeviceId());
        String receiverDeviceId = normalizeDeviceId(request.getReceiverDeviceId());

        requireOwnedDevice(userId, senderDeviceId);
        TransferDevice receiverDevice = requireOwnedDevice(userId, receiverDeviceId);
        if (senderDeviceId.equals(receiverDeviceId)) {
            throw new IllegalArgumentException("请选择另一台设备");
        }

        String fileName = normalizeFileName(request.getFileName());
        long fileSize = normalizeFileSize(request.getFileSize());
        int chunkSize = normalizeChunkSize(request.getChunkSize());
        int totalChunks = Math.max(1, (int) Math.ceil((double) fileSize / chunkSize));

        TransferTask task = resolveOrCreateTask(
                userId,
                request.getTaskId(),
                request.getTaskKey(),
                senderDeviceId,
                receiverDeviceId,
                fileName,
                fileSize,
                normalizeContentType(request.getContentType()),
                totalChunks,
                MODE_RELAY,
                STATUS_PENDING_UPLOAD,
                0
        );

        TransferRelay transfer = new TransferRelay();
        transfer.setUserId(userId);
        transfer.setSenderDeviceId(senderDeviceId);
        transfer.setReceiverDeviceId(receiverDeviceId);
        transfer.setTaskKey(task.getTaskKey());
        transfer.setTaskId(task.getId());
        transfer.setTransferKey(UUID.randomUUID().toString().replace("-", ""));
        transfer.setFileName(fileName);
        transfer.setFileSize(fileSize);
        transfer.setContentType(normalizeContentType(request.getContentType()));
        transfer.setChunkSize(chunkSize);
        transfer.setTotalChunks(totalChunks);
        transfer.setUploadedChunks(0);
        transfer.setStatus(STATUS_PENDING_UPLOAD);
        transfer.setCreateTime(LocalDateTime.now());
        transfer.setUpdateTime(transfer.getCreateTime());
        transfer.setExpireTime(transfer.getCreateTime().plusHours(transferProperties.getTransferTtlHours()));
        transferTransferMapper.insert(transfer);

        TransferTask syncedTask = syncRelayTaskAttempt(transfer, false);
        return toTransferVO(transfer, true, "outgoing", senderDeviceId, buildDeviceNameLookup(List.of()), syncedTask);
    }

    @Override
    public TransferRelayVO getTransfer(Long userId, Long transferId, String deviceId) {
        requireOwnedDevice(userId, deviceId);
        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        TransferTask task = syncRelayTaskAttempt(transfer, false);
        return toTransferVOForDevice(transfer, true, deviceId, task);
    }

    @Override
    public TransferRelayVO uploadChunk(Long userId, Long transferId, String deviceId, Integer chunkIndex, byte[] body) {
        if (body == null || body.length == 0) {
            throw new IllegalArgumentException("分片内容不能为空");
        }

        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        if (!Objects.equals(transfer.getSenderDeviceId(), normalizeDeviceId(deviceId))) {
            throw new IllegalArgumentException("只有发送设备可以继续上传该文件");
        }

        TransferTask task = ensureTaskAssociatedForRelay(transfer);
        if (isFinished(transfer.getStatus())) {
            return toTransferVOForDevice(transfer, true, deviceId, task);
        }

        int normalizedChunkIndex = chunkIndex == null ? -1 : chunkIndex;
        if (normalizedChunkIndex < 0 || normalizedChunkIndex >= transfer.getTotalChunks()) {
            throw new IllegalArgumentException("分片索引超出范围");
        }

        try {
            Path chunkPath = getChunkPath(transfer, normalizedChunkIndex);
            Files.createDirectories(chunkPath.getParent());
            Files.write(chunkPath, body, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            List<Integer> uploadedIndexes = listUploadedChunkIndexes(transfer);
            transfer.setUploadedChunks(uploadedIndexes.size());
            transfer.setUpdateTime(LocalDateTime.now());
            if (uploadedIndexes.size() >= transfer.getTotalChunks()) {
                Path assembledPath = assembleTransferFile(transfer);
                transfer.setAssembledPath(assembledPath.toString());
                transfer.setStatus(STATUS_READY);
            } else {
                transfer.setStatus(STATUS_UPLOADING);
            }
            transferTransferMapper.updateById(transfer);
            task = syncRelayTaskAttempt(transfer, false);
            return toTransferVOForDevice(transfer, true, deviceId, task);
        } catch (IOException ex) {
            throw new IllegalStateException("写入分片失败");
        }
    }

    @Override
    public TransferTaskVO syncDirectAttempt(Long userId, TransferDirectAttemptSyncRequest request) {
        String reporterDeviceId = normalizeDeviceId(request.getDeviceId());
        requireOwnedDevice(userId, reporterDeviceId);

        String senderDeviceId = normalizeDeviceId(request.getSenderDeviceId());
        String receiverDeviceId = normalizeDeviceId(request.getReceiverDeviceId());
        requireOwnedDevice(userId, senderDeviceId);
        requireOwnedDevice(userId, receiverDeviceId);
        if (senderDeviceId.equals(receiverDeviceId)) {
            throw new IllegalArgumentException("请选择另一台设备");
        }

        String fileName = normalizeFileName(request.getFileName());
        long fileSize = normalizeFileSize(request.getFileSize());
        int totalChunks = normalizeTotalChunks(request.getTotalChunks());
        int completedChunks = normalizeCompletedChunks(request.getCompletedChunks(), totalChunks);
        String status = normalizeAttemptStage(request.getStatus(), "sending");
        LocalDateTime now = LocalDateTime.now();

        TransferTask task = resolveOrCreateTask(
                userId,
                request.getTaskId(),
                request.getTaskKey(),
                senderDeviceId,
                receiverDeviceId,
                fileName,
                fileSize,
                normalizeContentType(request.getContentType()),
                totalChunks,
                MODE_DIRECT,
                status,
                completedChunks
        );

        List<TransferTaskAttemptVO> attempts = parseTaskAttempts(task.getAttemptsJson());
        TransferTaskAttemptVO attempt = buildDirectAttempt(request, status, totalChunks, completedChunks, now);
        upsertAttempt(attempts, attempt);

        task.setContentType(normalizeContentType(request.getContentType()));
        task.setFileName(fileName);
        task.setFileSize(fileSize);
        task.setTotalChunks(totalChunks);
        task = saveTaskWithAttempts(task, attempts);
        return toTaskVO(task, reporterDeviceId, buildDeviceNameLookup(loadDevices(userId, reporterDeviceId, LocalDateTime.now())));
    }

    @Override
    public TransferRelay openPreview(Long userId, Long transferId, String deviceId) {
        requireOwnedDevice(userId, deviceId);
        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        if (transfer.getAssembledPath() == null || transfer.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        Path assembledPath = Path.of(transfer.getAssembledPath());
        if (!Files.exists(assembledPath)) {
            throw new ResourceNotFoundException("传输文件不存在或已过期");
        }
        return transfer;
    }

    @Override
    public TransferRelay openDownload(Long userId, Long transferId, String deviceId) {
        requireOwnedDevice(userId, deviceId);
        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        if (transfer.getAssembledPath() == null || transfer.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        Path assembledPath = Path.of(transfer.getAssembledPath());
        if (!Files.exists(assembledPath)) {
            throw new ResourceNotFoundException("传输文件不存在或已过期");
        }

        transfer.setStatus(STATUS_COMPLETED);
        transfer.setDownloadedAt(LocalDateTime.now());
        transfer.setUpdateTime(LocalDateTime.now());
        transferTransferMapper.updateById(transfer);
        syncRelayTaskAttempt(transfer, false);
        return transfer;
    }

    @Override
    public FileInfoVO saveTransferToNetdisk(Long userId, Long transferId, String deviceId, Long folderId) {
        requireOwnedDevice(userId, deviceId);
        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        if (transfer.getAssembledPath() == null || transfer.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        FileInfoVO fileInfoVO = fileService.importLocalFile(
                Path.of(transfer.getAssembledPath()),
                transfer.getFileName(),
                transfer.getContentType(),
                userId,
                folderId
        );

        transfer.setStatus(STATUS_COMPLETED);
        transfer.setDownloadedAt(LocalDateTime.now());
        transfer.setUpdateTime(LocalDateTime.now());
        transferTransferMapper.updateById(transfer);
        syncRelayTaskAttempt(transfer, true);
        return fileInfoVO;
    }

    @Override
    public void deleteTask(Long userId, Long taskId, String deviceId) {
        requireOwnedDevice(userId, deviceId);
        TransferTask task = requireOwnedTask(userId, taskId);
        List<TransferRelay> transfers = transferTransferMapper.selectList(new QueryWrapper<TransferRelay>()
                .eq("task_id", taskId));
        for (TransferRelay transfer : transfers) {
            deleteTransferFiles(transfer);
            transferTransferMapper.deleteById(transfer.getId());
        }
        transferTaskMapper.deleteById(taskId);
    }

    @Override
    public void deleteDirectAttempt(Long userId, Long taskId, String deviceId, String clientTransferId) {
        requireOwnedDevice(userId, deviceId);
        TransferTask task = requireOwnedTask(userId, taskId);
        List<TransferTaskAttemptVO> attempts = parseTaskAttempts(task.getAttemptsJson());
        attempts.removeIf(attempt -> MODE_DIRECT.equals(attempt.getTransferMode())
                && Objects.equals(attempt.getTransferId(), normalizeClientTransferId(clientTransferId)));
        saveTaskWithAttempts(task, attempts);
    }

    @Override
    public void deleteTransfer(Long userId, Long transferId, String deviceId) {
        requireOwnedDevice(userId, deviceId);
        TransferRelay transfer = requireOwnedTransfer(userId, transferId);
        TransferTask task = ensureTaskAssociatedForRelay(transfer);
        deleteTransferFiles(transfer);
        transferTransferMapper.deleteById(transferId);
        if (task != null) {
            List<TransferTaskAttemptVO> attempts = parseTaskAttempts(task.getAttemptsJson());
            attempts.removeIf(attempt -> MODE_RELAY.equals(attempt.getTransferMode())
                    && Objects.equals(attempt.getTransferId(), String.valueOf(transferId)));
            saveTaskWithAttempts(task, attempts);
        }
    }

    @Override
    public TransferPublicShareVO createPublicShare(Long uploaderUserId, TransferPublicShareCreateRequest request) {
        String fileName = normalizeFileName(request.getFileName());
        long fileSize = normalizeFileSize(request.getFileSize());
        int chunkSize = normalizeChunkSize(request.getChunkSize());
        int totalChunks = (int) Math.ceil((double) fileSize / chunkSize);

        TransferPublicShare share = new TransferPublicShare();
        share.setShareToken(UUID.randomUUID().toString().replace("-", ""));
        share.setUploaderUserId(uploaderUserId);
        share.setSenderLabel(normalizeSenderLabel(request.getSenderLabel()));
        share.setFileName(fileName);
        share.setFileSize(fileSize);
        share.setContentType(normalizeContentType(request.getContentType()));
        share.setChunkSize(chunkSize);
        share.setTotalChunks(Math.max(1, totalChunks));
        share.setUploadedChunks(0);
        share.setStatus(STATUS_PENDING_UPLOAD);
        share.setCreateTime(LocalDateTime.now());
        share.setUpdateTime(share.getCreateTime());
        share.setExpireTime(share.getCreateTime().plusHours(transferProperties.getTransferTtlHours()));
        transferPublicShareMapper.insert(share);
        return toPublicShareVO(share, true);
    }

    @Override
    public TransferPublicShareVO getPublicShare(String shareToken) {
        return toPublicShareVO(requirePublicShare(shareToken), true);
    }

    @Override
    public TransferPublicShareVO uploadPublicShareChunk(String shareToken, Integer chunkIndex, byte[] body) {
        if (body == null || body.length == 0) {
            throw new IllegalArgumentException("分片内容不能为空");
        }

        TransferPublicShare share = requirePublicShare(shareToken);
        if (isFinished(share.getStatus())) {
            return toPublicShareVO(share, true);
        }

        int normalizedChunkIndex = chunkIndex == null ? -1 : chunkIndex;
        if (normalizedChunkIndex < 0 || normalizedChunkIndex >= share.getTotalChunks()) {
            throw new IllegalArgumentException("分片索引超出范围");
        }

        try {
            Path chunkPath = getPublicShareChunkPath(share, normalizedChunkIndex);
            Files.createDirectories(chunkPath.getParent());
            Files.write(chunkPath, body, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            List<Integer> uploadedIndexes = listUploadedPublicShareChunkIndexes(share);
            share.setUploadedChunks(uploadedIndexes.size());
            share.setUpdateTime(LocalDateTime.now());
            if (uploadedIndexes.size() >= share.getTotalChunks()) {
                Path assembledPath = assemblePublicShareFile(share);
                share.setAssembledPath(assembledPath.toString());
                share.setStatus(STATUS_READY);
            } else {
                share.setStatus(STATUS_UPLOADING);
            }
            transferPublicShareMapper.updateById(share);
            return toPublicShareVO(share, true);
        } catch (IOException ex) {
            throw new IllegalStateException("写入分片失败");
        }
    }

    @Override
    public TransferPublicShare openPublicSharePreview(String shareToken) {
        TransferPublicShare share = requirePublicShare(shareToken);
        if (share.getAssembledPath() == null || share.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        Path assembledPath = Path.of(share.getAssembledPath());
        if (!Files.exists(assembledPath)) {
            throw new ResourceNotFoundException("分享文件不存在或已过期");
        }
        return share;
    }

    @Override
    public TransferPublicShare openPublicShareDownload(String shareToken) {
        TransferPublicShare share = requirePublicShare(shareToken);
        if (share.getAssembledPath() == null || share.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        Path assembledPath = Path.of(share.getAssembledPath());
        if (!Files.exists(assembledPath)) {
            throw new ResourceNotFoundException("分享文件不存在或已过期");
        }

        share.setStatus(STATUS_COMPLETED);
        share.setDownloadedAt(LocalDateTime.now());
        share.setUpdateTime(LocalDateTime.now());
        transferPublicShareMapper.updateById(share);
        return share;
    }

    @Override
    public FileInfoVO savePublicShareToNetdisk(Long userId, String shareToken, Long folderId) {
        TransferPublicShare share = requirePublicShare(shareToken);
        if (share.getAssembledPath() == null || share.getAssembledPath().isBlank()) {
            throw new IllegalArgumentException("文件仍在上传中");
        }

        FileInfoVO fileInfoVO = fileService.importLocalFile(
                Path.of(share.getAssembledPath()),
                share.getFileName(),
                share.getContentType(),
                userId,
                folderId
        );

        share.setStatus(STATUS_COMPLETED);
        share.setDownloadedAt(LocalDateTime.now());
        share.setUpdateTime(LocalDateTime.now());
        transferPublicShareMapper.updateById(share);
        return fileInfoVO;
    }

    @Override
    public int cleanupExpiredTransfers() {
        LocalDateTime now = LocalDateTime.now();
        List<TransferRelay> expiredTransfers = transferTransferMapper.selectList(new QueryWrapper<TransferRelay>()
                .lt("expire_time", now));

        int deleted = 0;
        for (TransferRelay transfer : expiredTransfers) {
            TransferTask task = null;
            if (transfer.getTaskId() != null) {
                task = transferTaskMapper.selectById(transfer.getTaskId());
            }
            deleteTransferFiles(transfer);
            deleted += transferTransferMapper.deleteById(transfer.getId());
            if (task != null) {
                List<TransferTaskAttemptVO> attempts = parseTaskAttempts(task.getAttemptsJson());
                attempts.removeIf(attempt -> MODE_RELAY.equals(attempt.getTransferMode())
                        && Objects.equals(attempt.getTransferId(), String.valueOf(transfer.getId())));
                saveTaskWithAttempts(task, attempts);
            }
        }

        List<TransferTask> expiredTasks = transferTaskMapper.selectList(new QueryWrapper<TransferTask>()
                .lt("expire_time", now));
        for (TransferTask task : expiredTasks) {
            deleted += transferTaskMapper.deleteById(task.getId());
        }

        List<TransferPublicShare> expiredShares = transferPublicShareMapper.selectList(new QueryWrapper<TransferPublicShare>()
                .lt("expire_time", now));
        for (TransferPublicShare share : expiredShares) {
            deletePublicShareFiles(share);
            deleted += transferPublicShareMapper.deleteById(share.getId());
        }
        return deleted;
    }

    private List<TransferDeviceVO> loadDevices(Long userId, String currentDeviceId, LocalDateTime now) {
        return transferDeviceMapper.selectList(new QueryWrapper<TransferDevice>()
                        .eq("user_id", userId))
                .stream()
                .map(device -> toDeviceVO(device, currentDeviceId, now))
                .sorted(Comparator
                        .comparing(TransferDeviceVO::isCurrent).reversed()
                        .thenComparing(TransferDeviceVO::isOnline).reversed()
                        .thenComparing(TransferDeviceVO::getLastSeenAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private void backfillLegacyTasks(Long userId, String deviceId) {
        List<TransferRelay> transfers = transferTransferMapper.selectList(new QueryWrapper<TransferRelay>()
                .eq("user_id", userId)
                .and(wrapper -> wrapper.eq("sender_device_id", deviceId).or().eq("receiver_device_id", deviceId))
                .orderByDesc("update_time")
                .last("LIMIT 40"));
        transfers.stream()
                .filter(transfer -> !isExpired(transfer))
                .forEach(this::ensureTaskAssociatedForRelay);
    }

    private List<TransferTaskVO> loadTasks(Long userId, String column, String deviceId, Map<String, String> deviceNameLookup) {
        int limit = transferProperties.getSyncTaskLimit();
        return transferTaskMapper.selectList(new QueryWrapper<TransferTask>()
                        .eq("user_id", userId)
                        .eq(column, deviceId)
                        .orderByDesc("update_time")
                        .last("LIMIT " + limit))
                .stream()
                .filter(task -> !isExpired(task))
                .map(task -> toTaskVO(task, deviceId, deviceNameLookup))
                .toList();
    }

    private List<TransferRelayVO> loadTransfers(Long userId,
                                                    String column,
                                                    String deviceId,
                                                    boolean includeChunkIndexes,
                                                    String direction,
                                                    Map<String, String> deviceNameLookup) {
        int limit = transferProperties.getSyncTaskLimit();
        return transferTransferMapper.selectList(new QueryWrapper<TransferRelay>()
                        .eq("user_id", userId)
                        .eq(column, deviceId)
                        .orderByDesc("update_time")
                        .last("LIMIT " + limit))
                .stream()
                .filter(transfer -> !isExpired(transfer))
                .map(transfer -> {
                    TransferTask task = ensureTaskAssociatedForRelay(transfer);
                    return toTransferVO(transfer, includeChunkIndexes, direction, deviceId, deviceNameLookup, task);
                })
                .toList();
    }

    private TransferDeviceVO toDeviceVO(TransferDevice device, String currentDeviceId, LocalDateTime now) {
        TransferDeviceVO vo = new TransferDeviceVO();
        BeanUtils.copyProperties(device, vo);
        vo.setCurrent(Objects.equals(device.getDeviceId(), currentDeviceId));

        // Check actual WebSocket presence for accurate online status
        boolean wsOnline = false;
        if (device.getUserId() != null) {
            String channelId = "user:" + device.getUserId() + ":device:" + device.getDeviceId();
            wsOnline = transferSignalingService.isConnected(channelId);
        }
        boolean httpOnline = device.getLastSeenAt() != null
                && device.getLastSeenAt().isAfter(now.minusSeconds(transferProperties.getPresenceTimeoutSeconds()));
        vo.setOnline(wsOnline || httpOnline);
        return vo;
    }

    private TransferRelayVO toTransferVO(TransferRelay transfer,
                                             boolean includeChunkIndexes,
                                             String direction,
                                             String currentDeviceId,
                                             Map<String, String> deviceNameLookup,
                                             TransferTask task) {
        TransferRelayVO vo = new TransferRelayVO();
        BeanUtils.copyProperties(transfer, vo);
        vo.setReady(STATUS_READY.equals(transfer.getStatus()) || STATUS_COMPLETED.equals(transfer.getStatus()));
        vo.setUploadedChunkIndexes(includeChunkIndexes ? listUploadedChunkIndexes(transfer) : List.of());
        vo.setDirection(direction);
        vo.setTransferMode(MODE_RELAY);
        vo.setPeerDeviceId(resolvePeerDeviceId(transfer, direction));
        vo.setPeerLabel(resolveDeviceName(deviceNameLookup, vo.getPeerDeviceId()));
        vo.setTask(task == null ? null : toTaskVO(task, currentDeviceId, deviceNameLookup));
        return vo;
    }

    private TransferRelayVO toTransferVOForDevice(TransferRelay transfer,
                                                      boolean includeChunkIndexes,
                                                      String deviceId,
                                                      TransferTask task) {
        String direction = resolveTransferDirection(transfer, deviceId);
        return toTransferVO(transfer, includeChunkIndexes, direction, normalizeDeviceId(deviceId), buildDeviceNameLookup(List.of()), task);
    }

    private TransferTaskVO toTaskVO(TransferTask task, String currentDeviceId, Map<String, String> deviceNameLookup) {
        String direction = resolveTaskDirection(task, currentDeviceId);
        String peerDeviceId = resolveTaskPeerDeviceId(task, direction);

        TransferTaskVO vo = new TransferTaskVO();
        vo.setId(task.getId());
        vo.setTaskKey(task.getTaskKey());
        vo.setDirection(direction);
        vo.setTransferMode(task.getTransferMode());
        vo.setCurrentTransferMode(task.getCurrentTransferMode());
        vo.setStage(task.getStatus());
        List<TransferTaskAttemptVO> attempts = sortTaskAttempts(parseTaskAttempts(task.getAttemptsJson()));
        TransferAttemptLifecycleHelper.AttemptSummary summary = TransferAttemptLifecycleHelper.summarize(attempts);
        vo.setAttemptStatus(summary.attemptStatus());
        vo.setStartReason(summary.startReason());
        vo.setEndReason(summary.endReason());
        vo.setFailureReason(summary.failureReason());
        vo.setFileName(task.getFileName());
        vo.setFileSize(task.getFileSize());
        vo.setContentType(task.getContentType());
        vo.setSenderDeviceId(task.getSenderDeviceId());
        vo.setReceiverDeviceId(task.getReceiverDeviceId());
        vo.setPeerDeviceId(peerDeviceId);
        vo.setPeerLabel(resolveDeviceName(deviceNameLookup, peerDeviceId));
        vo.setCompletedChunks(task.getCompletedChunks());
        vo.setTotalChunks(task.getTotalChunks());
        vo.setCreateTime(task.getCreateTime());
        vo.setUpdateTime(task.getUpdateTime());
        vo.setExpireTime(task.getExpireTime());
        vo.setStartTime(summary.startTime());
        vo.setCompletedAt(task.getCompletedAt() != null ? task.getCompletedAt() : summary.completedAt());
        vo.setFailedAt(summary.failedAt());
        vo.setFallbackAt(summary.fallbackAt());
        vo.setSavedToNetdiskAt(task.getSavedToNetdiskAt() != null ? task.getSavedToNetdiskAt() : summary.savedToNetdiskAt());
        vo.setAttempts(attempts);
        return vo;
    }

    private TransferTask ensureTaskAssociatedForRelay(TransferRelay transfer) {
        TransferTask task = null;
        if (transfer.getTaskId() != null) {
            task = transferTaskMapper.selectById(transfer.getTaskId());
        }
        if (task == null || isExpired(task)) {
            task = resolveOrCreateTask(
                    transfer.getUserId(),
                    transfer.getTaskId(),
                    transfer.getTaskKey(),
                    transfer.getSenderDeviceId(),
                    transfer.getReceiverDeviceId(),
                    transfer.getFileName(),
                    transfer.getFileSize(),
                    transfer.getContentType(),
                    transfer.getTotalChunks(),
                    MODE_RELAY,
                    transfer.getStatus(),
                    transfer.getUploadedChunks()
            );
            if (!Objects.equals(transfer.getTaskId(), task.getId()) || !Objects.equals(transfer.getTaskKey(), task.getTaskKey())) {
                transfer.setTaskId(task.getId());
                transfer.setTaskKey(task.getTaskKey());
                transferTransferMapper.updateById(transfer);
            }
        }
        return syncRelayTaskAttempt(transfer, false);
    }

    private TransferTask syncRelayTaskAttempt(TransferRelay transfer, boolean savedToNetdisk) {
        TransferTask task = null;
        if (transfer.getTaskId() != null) {
            task = transferTaskMapper.selectById(transfer.getTaskId());
        }
        if (task == null || isExpired(task)) {
            task = resolveOrCreateTask(
                    transfer.getUserId(),
                    transfer.getTaskId(),
                    transfer.getTaskKey(),
                    transfer.getSenderDeviceId(),
                    transfer.getReceiverDeviceId(),
                    transfer.getFileName(),
                    transfer.getFileSize(),
                    transfer.getContentType(),
                    transfer.getTotalChunks(),
                    MODE_RELAY,
                    transfer.getStatus(),
                    transfer.getUploadedChunks()
            );
            if (!Objects.equals(transfer.getTaskId(), task.getId()) || !Objects.equals(transfer.getTaskKey(), task.getTaskKey())) {
                transfer.setTaskId(task.getId());
                transfer.setTaskKey(task.getTaskKey());
                transferTransferMapper.updateById(transfer);
            }
        }

        List<TransferTaskAttemptVO> attempts = parseTaskAttempts(task.getAttemptsJson());
        TransferTaskAttemptVO attempt = buildRelayAttempt(transfer, savedToNetdisk);
        upsertAttempt(attempts, attempt);

        task.setFileName(transfer.getFileName());
        task.setFileSize(transfer.getFileSize());
        task.setContentType(transfer.getContentType());
        task.setTotalChunks(transfer.getTotalChunks());
        return saveTaskWithAttempts(task, attempts);
    }

    private TransferTask resolveOrCreateTask(Long userId,
                                              Long taskId,
                                              String taskKey,
                                              String senderDeviceId,
                                              String receiverDeviceId,
                                              String fileName,
                                              Long fileSize,
                                              String contentType,
                                              Integer totalChunks,
                                              String defaultTransferMode,
                                              String defaultStatus,
                                              Integer completedChunks) {
        TransferTask task = null;
        if (taskId != null) {
            task = transferTaskMapper.selectById(taskId);
            if (task != null && (!Objects.equals(task.getUserId(), userId) || isExpired(task))) {
                task = null;
            }
        }

        String normalizedTaskKey = normalizeTaskKey(taskKey);
        if (task == null && normalizedTaskKey != null) {
            task = transferTaskMapper.selectOne(new QueryWrapper<TransferTask>()
                    .eq("user_id", userId)
                    .eq("task_key", normalizedTaskKey)
                    .eq("sender_device_id", senderDeviceId)
                    .eq("receiver_device_id", receiverDeviceId)
                    .eq("file_name", fileName)
                    .eq("file_size", fileSize)
                    .orderByDesc("update_time")
                    .last("LIMIT 1"));
            if (task != null && isExpired(task)) {
                task = null;
            }
        }

        if (task == null) {
            task = new TransferTask();
            task.setUserId(userId);
            task.setTaskKey(normalizedTaskKey == null ? buildServerTaskKey() : normalizedTaskKey);
            task.setSenderDeviceId(senderDeviceId);
            task.setReceiverDeviceId(receiverDeviceId);
            task.setFileName(fileName);
            task.setFileSize(fileSize);
            task.setContentType(contentType);
            task.setTotalChunks(totalChunks);
            task.setTransferMode(defaultTransferMode);
            task.setCurrentTransferMode(defaultTransferMode);
            task.setStatus(defaultStatus);
            task.setCompletedChunks(completedChunks == null ? 0 : completedChunks);
            task.setAttemptsJson("[]");
            task.setCreateTime(LocalDateTime.now());
            task.setUpdateTime(task.getCreateTime());
            task.setExpireTime(task.getCreateTime().plusHours(transferProperties.getTransferTtlHours()));
            transferTaskMapper.insert(task);
            return task;
        }

        task.setSenderDeviceId(senderDeviceId);
        task.setReceiverDeviceId(receiverDeviceId);
        task.setFileName(fileName);
        task.setFileSize(fileSize);
        task.setContentType(contentType);
        task.setTotalChunks(totalChunks);
        task.setExpireTime(LocalDateTime.now().plusHours(transferProperties.getTransferTtlHours()));
        transferTaskMapper.updateById(task);
        return task;
    }

    private TransferTask saveTaskWithAttempts(TransferTask task, List<TransferTaskAttemptVO> attempts) {
        List<TransferTaskAttemptVO> normalizedAttempts = sortTaskAttempts(attempts);
        if (normalizedAttempts.isEmpty()) {
            if (task.getId() != null) {
                transferTaskMapper.deleteById(task.getId());
            }
            return null;
        }

        TransferTaskAttemptVO currentAttempt = normalizedAttempts.get(0);
        TransferAttemptLifecycleHelper.AttemptSummary summary = TransferAttemptLifecycleHelper.summarize(normalizedAttempts);
        Set<String> modes = normalizedAttempts.stream()
                .map(TransferTaskAttemptVO::getTransferMode)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.toSet());

        task.setTransferMode(modes.size() > 1 ? MODE_HYBRID : currentAttempt.getTransferMode());
        task.setCurrentTransferMode(currentAttempt.getTransferMode());
        task.setStatus(currentAttempt.getStage());
        task.setCompletedChunks(currentAttempt.getCompletedChunks());
        task.setTotalChunks(currentAttempt.getTotalChunks() != null && currentAttempt.getTotalChunks() > 0
                ? currentAttempt.getTotalChunks()
                : task.getTotalChunks());
        task.setUpdateTime(currentAttempt.getUpdateTime() == null ? LocalDateTime.now() : currentAttempt.getUpdateTime());
        task.setExpireTime(LocalDateTime.now().plusHours(transferProperties.getTransferTtlHours()));
        task.setCompletedAt(summary.completedAt() != null ? summary.completedAt() : task.getCompletedAt());
        task.setSavedToNetdiskAt(summary.savedToNetdiskAt() != null ? summary.savedToNetdiskAt() : task.getSavedToNetdiskAt());
        task.setAttemptsJson(writeTaskAttempts(normalizedAttempts));
        transferTaskMapper.updateById(task);
        return transferTaskMapper.selectById(task.getId());
    }

    private void upsertAttempt(List<TransferTaskAttemptVO> attempts, TransferTaskAttemptVO nextAttempt) {
        for (int index = 0; index < attempts.size(); index++) {
            TransferTaskAttemptVO existing = attempts.get(index);
            if (Objects.equals(existing.getTransferMode(), nextAttempt.getTransferMode())
                    && Objects.equals(existing.getTransferId(), nextAttempt.getTransferId())) {
                attempts.set(index, TransferAttemptLifecycleHelper.mergeAttempt(existing, nextAttempt));
                return;
            }
        }
        attempts.add(TransferAttemptLifecycleHelper.mergeAttempt(null, nextAttempt));
    }

    private List<TransferTaskAttemptVO> parseTaskAttempts(String attemptsJson) {
        if (attemptsJson == null || attemptsJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(QUICKDROP_OBJECT_MAPPER.readValue(attemptsJson, new TypeReference<List<TransferTaskAttemptVO>>() {
            }));
        } catch (IOException ex) {
            log.warn("Failed to parse Transfer task attempts", ex);
            return new ArrayList<>();
        }
    }

    private String writeTaskAttempts(List<TransferTaskAttemptVO> attempts) {
        try {
            return QUICKDROP_OBJECT_MAPPER.writeValueAsString(sortTaskAttempts(attempts));
        } catch (IOException ex) {
            throw new IllegalStateException("无法写入 Transfer 任务尝试记录");
        }
    }

    private List<TransferTaskAttemptVO> sortTaskAttempts(List<TransferTaskAttemptVO> attempts) {
        return attempts.stream()
                .filter(attempt -> attempt.getTransferMode() != null && !attempt.getTransferMode().isBlank())
                .filter(attempt -> attempt.getTransferId() != null && !attempt.getTransferId().isBlank())
                .sorted(Comparator.comparing(TransferTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private Map<String, String> buildDeviceNameLookup(List<TransferDeviceVO> devices) {
        Map<String, String> lookup = new HashMap<>();
        if (devices == null) {
            return lookup;
        }
        devices.forEach(device -> lookup.put(device.getDeviceId(), device.getDeviceName()));
        return lookup;
    }

    private String resolveTransferDirection(TransferRelay transfer, String deviceId) {
        String normalizedDeviceId = normalizeDeviceId(deviceId);
        return Objects.equals(normalizedDeviceId, transfer.getReceiverDeviceId()) ? "incoming" : "outgoing";
    }

    private String resolveTaskDirection(TransferTask task, String currentDeviceId) {
        String normalizedDeviceId = normalizeDeviceId(currentDeviceId);
        return Objects.equals(normalizedDeviceId, task.getReceiverDeviceId()) ? "incoming" : "outgoing";
    }

    private String resolvePeerDeviceId(TransferRelay transfer, String direction) {
        return "incoming".equals(direction) ? transfer.getSenderDeviceId() : transfer.getReceiverDeviceId();
    }

    private String resolveTaskPeerDeviceId(TransferTask task, String direction) {
        return "incoming".equals(direction) ? task.getSenderDeviceId() : task.getReceiverDeviceId();
    }

    private String resolveDeviceName(Map<String, String> deviceNameLookup, String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return "-";
        }
        String deviceName = deviceNameLookup == null ? null : deviceNameLookup.get(deviceId);
        if (deviceName != null && !deviceName.isBlank()) {
            return deviceName;
        }
        return resolveDeviceName(deviceId);
    }

    private String resolveDeviceName(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return "-";
        }
        TransferDevice device = transferDeviceMapper.selectById(deviceId);
        if (device == null || device.getDeviceName() == null || device.getDeviceName().isBlank()) {
            return deviceId;
        }
        return device.getDeviceName();
    }

    private TransferPublicShareVO toPublicShareVO(TransferPublicShare share, boolean includeChunkIndexes) {
        TransferPublicShareVO vo = new TransferPublicShareVO();
        BeanUtils.copyProperties(share, vo);
        vo.setReady(STATUS_READY.equals(share.getStatus()) || STATUS_COMPLETED.equals(share.getStatus()));
        vo.setUploadedChunkIndexes(includeChunkIndexes ? listUploadedPublicShareChunkIndexes(share) : List.of());
        vo.setPickupUrl("/share.html?pickup=" + share.getShareToken());
        return vo;
    }

    private TransferDevice requireOwnedDevice(Long userId, String deviceId) {
        TransferDevice device = transferDeviceMapper.selectById(normalizeDeviceId(deviceId));
        if (device == null || !Objects.equals(device.getUserId(), userId)) {
            throw new ResourceNotFoundException("目标设备不存在");
        }
        return device;
    }

    private TransferRelay requireOwnedTransfer(Long userId, Long transferId) {
        TransferRelay transfer = transferTransferMapper.selectById(transferId);
        if (transfer == null || !Objects.equals(transfer.getUserId(), userId) || isExpired(transfer)) {
            throw new ResourceNotFoundException("传输会话不存在或已过期");
        }
        return transfer;
    }

    private TransferTask requireOwnedTask(Long userId, Long taskId) {
        TransferTask task = transferTaskMapper.selectById(taskId);
        if (task == null || !Objects.equals(task.getUserId(), userId) || isExpired(task)) {
            throw new ResourceNotFoundException("任务不存在或已过期");
        }
        return task;
    }

    private TransferPublicShare requirePublicShare(String shareToken) {
        String normalizedToken = normalizeShareToken(shareToken);
        TransferPublicShare share = transferPublicShareMapper.selectOne(new QueryWrapper<TransferPublicShare>()
                .eq("share_token", normalizedToken)
                .last("LIMIT 1"));
        if (share == null || isExpired(share)) {
            throw new ResourceNotFoundException("分享会话不存在或已过期");
        }
        return share;
    }

    private boolean isExpired(TransferRelay transfer) {
        return transfer.getExpireTime() != null && transfer.getExpireTime().isBefore(LocalDateTime.now());
    }

    private boolean isExpired(TransferTask task) {
        return task.getExpireTime() != null && task.getExpireTime().isBefore(LocalDateTime.now());
    }

    private boolean isExpired(TransferPublicShare share) {
        return share.getExpireTime() != null && share.getExpireTime().isBefore(LocalDateTime.now());
    }

    private boolean isFinished(String status) {
        return STATUS_READY.equals(status) || STATUS_COMPLETED.equals(status) || STATUS_CANCELLED.equals(status);
    }

    private String normalizeDeviceId(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            throw new IllegalArgumentException("设备标识不能为空");
        }
        String normalized = deviceId.trim();
        if (normalized.length() > 64) {
            throw new IllegalArgumentException("设备标识过长");
        }
        return normalized;
    }

    private String normalizeDeviceName(String deviceName, String deviceType) {
        String fallback = normalizeDeviceType(deviceType);
        if (deviceName == null || deviceName.isBlank()) {
            return fallback == null || fallback.isBlank() ? "Transfer Device" : fallback;
        }
        String normalized = deviceName.trim();
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String normalizeDeviceType(String deviceType) {
        if (deviceType == null || deviceType.isBlank()) {
            return "Browser";
        }
        String normalized = deviceType.trim();
        return normalized.length() > 64 ? normalized.substring(0, 64) : normalized;
    }

    private String normalizeTaskKey(String taskKey) {
        if (taskKey == null || taskKey.isBlank()) {
            return null;
        }
        String normalized = taskKey.trim();
        return normalized.length() > 255 ? normalized.substring(0, 255) : normalized;
    }

    private String normalizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        String normalized = fileName.trim().replace("\\", "_").replace("/", "_");
        return normalized.length() > 255 ? normalized.substring(0, 255) : normalized;
    }

    private long normalizeFileSize(Long fileSize) {
        if (fileSize == null || fileSize <= 0) {
            throw new IllegalArgumentException("文件大小必须大于 0");
        }
        return fileSize;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "application/octet-stream";
        }
        return contentType.trim();
    }

    private int normalizeTotalChunks(Integer totalChunks) {
        if (totalChunks == null || totalChunks <= 0) {
            throw new IllegalArgumentException("分片总数必须大于 0");
        }
        return totalChunks;
    }

    private int normalizeCompletedChunks(Integer completedChunks, int totalChunks) {
        int normalized = completedChunks == null ? 0 : completedChunks;
        if (normalized < 0) {
            return 0;
        }
        return Math.min(totalChunks, normalized);
    }

    private TransferTaskAttemptVO buildDirectAttempt(TransferDirectAttemptSyncRequest request,
                                                      String status,
                                                      int totalChunks,
                                                      int completedChunks,
                                                      LocalDateTime now) {
        TransferTaskAttemptVO attempt = new TransferTaskAttemptVO();
        attempt.setTransferMode(MODE_DIRECT);
        attempt.setTransferId(normalizeClientTransferId(request.getClientTransferId()));
        attempt.setStage(status);
        attempt.setAttemptStatus(TransferAttemptLifecycleHelper.normalizeAttemptStatus(null, status));
        attempt.setStartReason(firstNonBlank(
                TransferAttemptLifecycleHelper.normalizeReason(request.getStartReason()),
                "same_account_direct"
        ));
        attempt.setEndReason(resolveDirectEndReason(status, request));
        attempt.setFailureReason(resolveDirectFailureReason(status, request));
        attempt.setCompletedChunks(completedChunks);
        attempt.setTotalChunks(totalChunks);
        attempt.setStartTime(now);
        attempt.setUpdateTime(now);
        attempt.setCompletedAt(STATUS_COMPLETED.equals(status) ? now : null);
        attempt.setFailedAt("failed".equals(status) ? now : null);
        attempt.setFallbackAt("relay_fallback".equals(status) ? now : null);
        attempt.setSavedToNetdiskAt(Boolean.TRUE.equals(request.getSavedToNetdisk()) ? now : null);
        attempt.setDownloadedAt(Boolean.TRUE.equals(request.getDownloaded()) ? now : null);
        return attempt;
    }

    private TransferTaskAttemptVO buildRelayAttempt(TransferRelay transfer, boolean savedToNetdisk) {
        TransferTaskAttemptVO attempt = new TransferTaskAttemptVO();
        attempt.setTransferMode(MODE_RELAY);
        attempt.setTransferId(String.valueOf(transfer.getId()));
        attempt.setStage(transfer.getStatus());
        attempt.setAttemptStatus(TransferAttemptLifecycleHelper.normalizeAttemptStatus(null, transfer.getStatus()));
        attempt.setStartReason("relay_transfer_created");
        attempt.setEndReason(resolveRelayEndReason(transfer.getStatus(), savedToNetdisk, transfer));
        attempt.setCompletedChunks(transfer.getUploadedChunks());
        attempt.setTotalChunks(transfer.getTotalChunks());
        attempt.setStartTime(transfer.getCreateTime());
        attempt.setUpdateTime(transfer.getUpdateTime());
        attempt.setCompletedAt(STATUS_COMPLETED.equals(transfer.getStatus())
                ? firstNonBlankTime(transfer.getDownloadedAt(), transfer.getUpdateTime())
                : null);
        attempt.setSavedToNetdiskAt(savedToNetdisk ? LocalDateTime.now() : null);
        attempt.setDownloadedAt(!savedToNetdisk ? transfer.getDownloadedAt() : null);
        return attempt;
    }

    private String resolveDirectEndReason(String status, TransferDirectAttemptSyncRequest request) {
        String explicit = TransferAttemptLifecycleHelper.normalizeReason(request.getEndReason());
        if (explicit != null) {
            return explicit;
        }
        if (Boolean.TRUE.equals(request.getSavedToNetdisk())) {
            return "saved_to_netdisk";
        }
        if (Boolean.TRUE.equals(request.getDownloaded())) {
            return "downloaded";
        }
        return switch (status) {
            case STATUS_COMPLETED -> "peer_confirmed";
            case "relay_fallback" -> "relay_fallback";
            case "failed" -> "failed";
            case STATUS_CANCELLED -> "cancelled";
            default -> null;
        };
    }

    private String resolveDirectFailureReason(String status, TransferDirectAttemptSyncRequest request) {
        String explicit = TransferAttemptLifecycleHelper.normalizeReason(request.getFailureReason());
        if (explicit != null) {
            return explicit;
        }
        return switch (status) {
            case "relay_fallback" -> "direct_transfer_interrupted";
            case "failed" -> "direct_transfer_failed";
            default -> null;
        };
    }

    private String resolveRelayEndReason(String status, boolean savedToNetdisk, TransferRelay transfer) {
        if (savedToNetdisk) {
            return "saved_to_netdisk";
        }
        if (transfer.getDownloadedAt() != null && STATUS_COMPLETED.equals(status)) {
            return "downloaded";
        }
        if (STATUS_CANCELLED.equals(status)) {
            return "cancelled";
        }
        return null;
    }

    private String normalizeAttemptStage(String status, String fallback) {
        if (status == null || status.isBlank()) {
            return fallback;
        }
        String normalized = status.trim();
        return normalized.length() > 32 ? normalized.substring(0, 32) : normalized;
    }

    private String normalizeClientTransferId(String clientTransferId) {
        if (clientTransferId == null || clientTransferId.isBlank()) {
            throw new IllegalArgumentException("直传记录标识不能为空");
        }
        String normalized = clientTransferId.trim();
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String firstNonBlank(String primary, String fallback) {
        return primary != null && !primary.isBlank() ? primary : fallback;
    }

    private LocalDateTime firstNonBlankTime(LocalDateTime primary, LocalDateTime fallback) {
        return primary != null ? primary : fallback;
    }

    private String normalizeSenderLabel(String senderLabel) {
        if (senderLabel == null || senderLabel.isBlank()) {
            return "Transfer Share";
        }
        String normalized = senderLabel.trim();
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String normalizeShareToken(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) {
            throw new IllegalArgumentException("分享标识不能为空");
        }
        String normalized = shareToken.trim();
        if (normalized.length() > 64) {
            throw new IllegalArgumentException("分享标识过长");
        }
        return normalized;
    }

    private int normalizeChunkSize(Integer requested) {
        int fallback = Math.max(MIN_CHUNK_SIZE, transferProperties.getChunkSizeBytes());
        int chunkSize = requested == null || requested <= 0 ? fallback : requested;
        return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, chunkSize));
    }

    private String buildServerTaskKey() {
        return "server:" + UUID.randomUUID().toString().replace("-", "");
    }

    private Path getTransferRootDir() {
        Path root = Path.of(fileConfig.getUploadDir(), "transfer-temp");
        try {
            Files.createDirectories(root);
        } catch (IOException ex) {
            throw new IllegalStateException("无法创建 Transfer 临时目录");
        }
        return root;
    }

    private Path getTransferDir(TransferRelay transfer) {
        return getTransferRootDir().resolve(transfer.getTransferKey());
    }

    private Path getPublicShareDir(TransferPublicShare share) {
        return getTransferRootDir().resolve("public").resolve(share.getShareToken());
    }

    private Path getChunksDir(TransferRelay transfer) {
        return getTransferDir(transfer).resolve("chunks");
    }

    private Path getPublicShareChunksDir(TransferPublicShare share) {
        return getPublicShareDir(share).resolve("chunks");
    }

    private Path getChunkPath(TransferRelay transfer, int chunkIndex) {
        return getChunksDir(transfer).resolve(chunkIndex + ".part");
    }

    private Path getPublicShareChunkPath(TransferPublicShare share, int chunkIndex) {
        return getPublicShareChunksDir(share).resolve(chunkIndex + ".part");
    }

    private Path getAssembledPath(TransferRelay transfer) {
        return getTransferDir(transfer).resolve("payload.bin");
    }

    private Path getPublicShareAssembledPath(TransferPublicShare share) {
        return getPublicShareDir(share).resolve("payload.bin");
    }

    private List<Integer> listUploadedChunkIndexes(TransferRelay transfer) {
        if (transfer.getTotalChunks() == null || transfer.getTotalChunks() <= 0) {
            return List.of();
        }
        if (STATUS_READY.equals(transfer.getStatus()) || STATUS_COMPLETED.equals(transfer.getStatus())) {
            List<Integer> indexes = new ArrayList<>(transfer.getTotalChunks());
            for (int i = 0; i < transfer.getTotalChunks(); i++) {
                indexes.add(i);
            }
            return indexes;
        }

        Path chunksDir = getChunksDir(transfer);
        if (!Files.exists(chunksDir)) {
            return List.of();
        }

        try (Stream<Path> stream = Files.list(chunksDir)) {
            return stream
                    .map(Path::getFileName)
                    .map(Path::toString)
                    .filter(name -> name.endsWith(".part"))
                    .map(name -> name.substring(0, name.length() - 5))
                    .map(name -> {
                        try {
                            return Integer.parseInt(name);
                        } catch (NumberFormatException ex) {
                            return null;
                        }
                    })
                    .filter(Objects::nonNull)
                    .sorted()
                    .toList();
        } catch (IOException ex) {
            return List.of();
        }
    }

    private List<Integer> listUploadedPublicShareChunkIndexes(TransferPublicShare share) {
        if (share.getTotalChunks() == null || share.getTotalChunks() <= 0) {
            return List.of();
        }
        if (STATUS_READY.equals(share.getStatus()) || STATUS_COMPLETED.equals(share.getStatus())) {
            List<Integer> indexes = new ArrayList<>(share.getTotalChunks());
            for (int i = 0; i < share.getTotalChunks(); i++) {
                indexes.add(i);
            }
            return indexes;
        }

        Path chunksDir = getPublicShareChunksDir(share);
        if (!Files.exists(chunksDir)) {
            return List.of();
        }

        try (Stream<Path> stream = Files.list(chunksDir)) {
            return stream
                    .map(Path::getFileName)
                    .map(Path::toString)
                    .filter(name -> name.endsWith(".part"))
                    .map(name -> name.substring(0, name.length() - 5))
                    .map(name -> {
                        try {
                            return Integer.parseInt(name);
                        } catch (NumberFormatException ex) {
                            return null;
                        }
                    })
                    .filter(Objects::nonNull)
                    .sorted()
                    .toList();
        } catch (IOException ex) {
            return List.of();
        }
    }

    private Path assembleTransferFile(TransferRelay transfer) throws IOException {
        Path assembledPath = getAssembledPath(transfer);
        Files.createDirectories(assembledPath.getParent());

        try (OutputStream outputStream = Files.newOutputStream(assembledPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING)) {
            for (int index = 0; index < transfer.getTotalChunks(); index++) {
                Path chunkPath = getChunkPath(transfer, index);
                if (!Files.exists(chunkPath)) {
                    throw new IllegalStateException("分片缺失，无法完成组装");
                }
                try (InputStream inputStream = Files.newInputStream(chunkPath)) {
                    inputStream.transferTo(outputStream);
                }
            }
        }

        if (Files.size(assembledPath) != transfer.getFileSize()) {
            throw new IllegalStateException("组装后的文件大小校验失败");
        }

        deleteDirectoryQuietly(getChunksDir(transfer));
        return assembledPath;
    }

    private Path assemblePublicShareFile(TransferPublicShare share) throws IOException {
        Path assembledPath = getPublicShareAssembledPath(share);
        Files.createDirectories(assembledPath.getParent());

        try (OutputStream outputStream = Files.newOutputStream(assembledPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING)) {
            for (int index = 0; index < share.getTotalChunks(); index++) {
                Path chunkPath = getPublicShareChunkPath(share, index);
                if (!Files.exists(chunkPath)) {
                    throw new IllegalStateException("分片缺失，无法完成组装");
                }
                try (InputStream inputStream = Files.newInputStream(chunkPath)) {
                    inputStream.transferTo(outputStream);
                }
            }
        }

        if (Files.size(assembledPath) != share.getFileSize()) {
            throw new IllegalStateException("组装后的文件大小校验失败");
        }

        deleteDirectoryQuietly(getPublicShareChunksDir(share));
        return assembledPath;
    }

    private void deleteTransferFiles(TransferRelay transfer) {
        deleteDirectoryQuietly(getTransferDir(transfer));
    }

    private void deletePublicShareFiles(TransferPublicShare share) {
        deleteDirectoryQuietly(getPublicShareDir(share));
    }

    private void deleteDirectoryQuietly(Path path) {
        if (path == null || !Files.exists(path)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(current -> {
                try {
                    Files.deleteIfExists(current);
                } catch (IOException ex) {
                    log.warn("Failed to delete Transfer path {}", current, ex);
                }
            });
        } catch (IOException ex) {
            log.warn("Failed to walk Transfer path {}", path, ex);
        }
    }
}
