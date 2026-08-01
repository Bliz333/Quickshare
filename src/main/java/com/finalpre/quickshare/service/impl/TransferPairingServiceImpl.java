package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.RandomUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.config.TransferProperties;
import com.finalpre.quickshare.dto.TransferDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.TransferPairCodeClaimRequest;
import com.finalpre.quickshare.dto.TransferPairCodeCreateRequest;
import com.finalpre.quickshare.dto.TransferPairTaskSyncRequest;
import com.finalpre.quickshare.entity.TransferDevice;
import com.finalpre.quickshare.entity.TransferPairTask;
import com.finalpre.quickshare.mapper.TransferDeviceMapper;
import com.finalpre.quickshare.mapper.TransferPairTaskMapper;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.service.TransferSignalingService;
import com.finalpre.quickshare.vo.TransferDirectSessionVO;
import com.finalpre.quickshare.vo.TransferPairClaimVO;
import com.finalpre.quickshare.vo.TransferPairCodeVO;
import com.finalpre.quickshare.vo.TransferPairTaskVO;
import com.finalpre.quickshare.vo.TransferTaskAttemptVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class TransferPairingServiceImpl implements TransferPairingService {

    @Autowired
    private TransferProperties transferProperties;

    @Autowired
    private TransferSignalingService transferSignalingService;

    @Autowired
    private TransferDeviceMapper transferDeviceMapper;

    @Autowired
    private TransferPairTaskMapper transferPairTaskMapper;

    private final Map<String, PairCodeEntry> pairCodes = new ConcurrentHashMap<>();
    private final Map<String, DirectSessionEntry> directSessions = new ConcurrentHashMap<>();

    @Override
    public TransferPairCodeVO createPairCode(Long userId, TransferPairCodeCreateRequest request) {
        purgeExpiredCodes();
        String creatorChannelId = buildChannelId(userId, request.getDeviceId(), request.getGuestId());
        String creatorLabel = normalizeLabel(request.getDeviceName(), request.getDeviceType(), userId);
        String code = nextCode();
        LocalDateTime expireTime = LocalDateTime.now().plusMinutes(transferProperties.getPairCodeTtlMinutes());
        pairCodes.put(code, new PairCodeEntry(code, creatorChannelId, creatorLabel, expireTime, null, null, null));

        TransferPairCodeVO vo = new TransferPairCodeVO();
        vo.setCode(code);
        vo.setCreatorChannelId(creatorChannelId);
        vo.setCreatorLabel(creatorLabel);
        vo.setExpireTime(expireTime);
        return vo;
    }

    @Override
    public TransferPairClaimVO claimPairCode(Long userId, String code, TransferPairCodeClaimRequest request) {
        purgeExpiredCodes();
        String normalizedCode = normalizeCode(code);
        PairCodeEntry current = pairCodes.get(normalizedCode);
        if (current == null || current.expireTime().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("匹配码不存在或已过期");
        }

        String claimerChannelId = buildChannelId(userId, request.getDeviceId(), request.getGuestId());
        if (Objects.equals(current.creatorChannelId(), claimerChannelId)) {
            throw new IllegalArgumentException("不能使用自己的匹配码");
        }

        String pairSessionId = current.pairSessionId() == null || current.pairSessionId().isBlank()
                ? UUID.randomUUID().toString().replace("-", "")
                : current.pairSessionId();
        String claimerLabel = normalizeLabel(request.getDeviceName(), request.getDeviceType(), userId);
        PairCodeEntry claimed = new PairCodeEntry(
                current.code(),
                current.creatorChannelId(),
                current.creatorLabel(),
                current.expireTime(),
                pairSessionId,
                claimerChannelId,
                claimerLabel
        );
        pairCodes.put(normalizedCode, claimed);

        try {
            transferSignalingService.bindPairSession(pairSessionId, current.creatorChannelId(), claimerChannelId);
        } catch (IOException ignored) {
            // Pair session still exists even if one side is temporarily offline.
        }

        TransferPairClaimVO vo = new TransferPairClaimVO();
        vo.setCode(normalizedCode);
        vo.setPairSessionId(pairSessionId);
        vo.setSelfChannelId(claimerChannelId);
        vo.setSelfDeviceId(normalizeOptionalDeviceId(request.getDeviceId()));
        vo.setPeerChannelId(current.creatorChannelId());
        vo.setPeerDeviceId(extractDeviceId(current.creatorChannelId()));
        vo.setPeerLabel(current.creatorLabel());
        vo.setExpireTime(current.expireTime());
        return vo;
    }

    @Override
    public TransferDirectSessionVO createDirectSession(Long userId, TransferDirectSessionCreateRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("请先登录后再发起同账号直连");
        }

        String deviceId = normalizeRequiredDeviceId(request.getDeviceId(), "当前设备缺少 deviceId");
        String targetDeviceId = normalizeRequiredDeviceId(request.getTargetDeviceId(), "目标设备缺少 deviceId");
        if (Objects.equals(deviceId, targetDeviceId)) {
            throw new IllegalArgumentException("请选择另一台设备");
        }

        TransferDevice selfDevice = requireOwnedDevice(userId, deviceId);
        TransferDevice peerDevice = requireOwnedDevice(userId, targetDeviceId);

        String selfChannelId = buildChannelId(userId, selfDevice.getDeviceId(), null);
        String peerChannelId = buildChannelId(userId, peerDevice.getDeviceId(), null);
        if (!transferSignalingService.isConnected(selfChannelId)) {
            throw new IllegalArgumentException("当前设备的直连信令尚未连上");
        }
        if (!transferSignalingService.isConnected(peerChannelId)) {
            throw new IllegalArgumentException("目标设备当前没有连上直连信令");
        }

        purgeExpiredDirectSessions();
        String pairKey = buildDirectPairKey(selfChannelId, peerChannelId);
        DirectSessionEntry directSession = directSessions.get(pairKey);
        if (directSession == null || directSession.expireTime().isBefore(LocalDateTime.now())) {
            directSession = new DirectSessionEntry(
                    UUID.randomUUID().toString().replace("-", ""),
                    selfChannelId,
                    peerChannelId,
                    peerDevice.getDeviceName(),
                    LocalDateTime.now().plusMinutes(Math.max(transferProperties.getPairCodeTtlMinutes(), 10))
            );
            directSessions.put(pairKey, directSession);
        }

        try {
            transferSignalingService.bindPairSession(directSession.pairSessionId(), selfChannelId, peerChannelId);
        } catch (IOException ex) {
            throw new IllegalStateException("建立直连会话失败");
        }

        TransferDirectSessionVO vo = new TransferDirectSessionVO();
        vo.setPairSessionId(directSession.pairSessionId());
        vo.setSelfChannelId(selfChannelId);
        vo.setSelfDeviceId(selfDevice.getDeviceId());
        vo.setPeerChannelId(peerChannelId);
        vo.setPeerDeviceId(peerDevice.getDeviceId());
        vo.setPeerLabel(peerDevice.getDeviceName());
        return vo;
    }

    @Override
    public TransferPairTaskVO syncPairTask(TransferPairTaskSyncRequest request) {
        String pairSessionId = normalizeRequiredValue(request.getPairSessionId(), "配对会话缺失");
        String selfChannelId = normalizeRequiredValue(request.getSelfChannelId(), "当前通道缺失");
        String peerChannelId = normalizeRequiredValue(request.getPeerChannelId(), "对端通道缺失");
        String taskKey = normalizeTaskKey(request.getTaskKey(), request.getClientTransferId());
        String fileName = normalizeFileName(request.getFileName());
        long fileSize = normalizeFileSize(request.getFileSize());
        int totalChunks = normalizeTotalChunks(request.getTotalChunks());
        int completedChunks = normalizeCompletedChunks(request.getCompletedChunks(), totalChunks);
        String status = normalizeStatus(request.getStatus(), "sending");
        LocalDateTime now = LocalDateTime.now();

        TransferPairTask task = transferPairTaskMapper.selectOne(new QueryWrapper<TransferPairTask>()
                .eq("pair_session_id", pairSessionId)
                .eq("task_key", taskKey)
                .orderByDesc("update_time")
                .last("LIMIT 1"));
        if (task == null) {
            task = new TransferPairTask();
            task.setPairSessionId(pairSessionId);
            task.setTaskKey(taskKey);
            task.setLeftChannelId(selfChannelId);
            task.setRightChannelId(peerChannelId);
            task.setLeftLabel(normalizeOptionalLabel(request.getSelfLabel(), "Transfer Guest"));
            task.setRightLabel(normalizeOptionalLabel(request.getPeerLabel(), "Transfer Peer"));
            task.setFileName(fileName);
            task.setFileSize(fileSize);
            task.setContentType(normalizeContentType(request.getContentType()));
            task.setTotalChunks(totalChunks);
            task.setTransferMode("direct");
            task.setCurrentTransferMode("direct");
            task.setStatus(status);
            task.setCompletedChunks(completedChunks);
            task.setAttemptsJson("[]");
            task.setCreateTime(now);
            task.setUpdateTime(task.getCreateTime());
            task.setExpireTime(task.getCreateTime().plusHours(transferProperties.getTransferTtlHours()));
            transferPairTaskMapper.insert(task);
        }

        if (Objects.equals(task.getLeftChannelId(), selfChannelId)) {
            task.setLeftLabel(normalizeOptionalLabel(request.getSelfLabel(), task.getLeftLabel()));
            task.setRightLabel(normalizeOptionalLabel(request.getPeerLabel(), task.getRightLabel()));
        } else if (Objects.equals(task.getRightChannelId(), selfChannelId)) {
            task.setRightLabel(normalizeOptionalLabel(request.getSelfLabel(), task.getRightLabel()));
            task.setLeftLabel(normalizeOptionalLabel(request.getPeerLabel(), task.getLeftLabel()));
        }

        task.setFileName(fileName);
        task.setFileSize(fileSize);
        task.setContentType(normalizeContentType(request.getContentType()));
        task.setTotalChunks(totalChunks);
        task.setExpireTime(now.plusHours(transferProperties.getTransferTtlHours()));

        TransferTaskAttemptVO attempt = buildPairAttempt(request, status, totalChunks, completedChunks, now);
        TransferAttemptLedger ledger = TransferAttemptLedger.load(task.getAttemptsJson()).upsert(attempt);

        TransferPairTask savedTask = savePairTaskWithAttempts(task, ledger);
        return toPairTaskVO(savedTask, selfChannelId);
    }

    @Override
    public List<TransferPairTaskVO> listPairTasks(String pairSessionId, String selfChannelId) {
        String normalizedPairSessionId = normalizeRequiredValue(pairSessionId, "配对会话缺失");
        String normalizedSelfChannelId = normalizeRequiredValue(selfChannelId, "当前通道缺失");

        return transferPairTaskMapper.selectList(new QueryWrapper<TransferPairTask>()
                        .eq("pair_session_id", normalizedPairSessionId)
                        .orderByDesc("update_time"))
                .stream()
                .filter(task -> Objects.equals(task.getPairSessionId(), normalizedPairSessionId))
                .filter(task -> Objects.equals(task.getLeftChannelId(), normalizedSelfChannelId)
                        || Objects.equals(task.getRightChannelId(), normalizedSelfChannelId))
                .sorted(Comparator.comparing(TransferPairTask::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(task -> toPairTaskVO(task, normalizedSelfChannelId))
                .toList();
    }

    @Override
    public void deletePairTaskAttempt(Long taskId, String pairSessionId, String selfChannelId, String clientTransferId) {
        TransferPairTask task = transferPairTaskMapper.selectById(taskId);
        if (task == null) {
            return;
        }
        if (!Objects.equals(task.getPairSessionId(), normalizeRequiredValue(pairSessionId, "配对会话缺失"))) {
            throw new IllegalArgumentException("配对任务不存在");
        }

        String normalizedSelfChannelId = normalizeRequiredValue(selfChannelId, "当前通道缺失");
        if (!Objects.equals(task.getLeftChannelId(), normalizedSelfChannelId) && !Objects.equals(task.getRightChannelId(), normalizedSelfChannelId)) {
            throw new IllegalArgumentException("当前通道不属于该任务");
        }

        String normalizedClientTransferId = normalizeClientTransferId(clientTransferId);
        Optional<TransferAttemptLedger> updatedLedger = TransferAttemptLedger.load(task.getAttemptsJson())
                .removeIfIntact(normalizedClientTransferId);
        if (updatedLedger.isEmpty()) {
            log.warn("Skip deleting Transfer pair task attempt because attempts JSON is corrupted. taskId={}", taskId);
            return;
        }
        savePairTaskWithAttempts(task, updatedLedger.orElseThrow());
    }

    private void purgeExpiredCodes() {
        LocalDateTime now = LocalDateTime.now();
        pairCodes.entrySet().removeIf(entry -> entry.getValue().expireTime().isBefore(now));
    }

    private void purgeExpiredDirectSessions() {
        LocalDateTime now = LocalDateTime.now();
        directSessions.entrySet().removeIf(entry -> entry.getValue().expireTime().isBefore(now)
                || !transferSignalingService.isConnected(entry.getValue().leftChannelId())
                || !transferSignalingService.isConnected(entry.getValue().rightChannelId()));
    }

    private String nextCode() {
        String code;
        do {
            code = RandomUtil.randomStringUpper(6);
        } while (pairCodes.containsKey(code));
        return code;
    }

    private String buildChannelId(Long userId, String deviceId, String guestId) {
        if (userId != null) {
            if (deviceId == null || deviceId.isBlank()) {
                throw new IllegalArgumentException("已登录设备缺少 deviceId");
            }
            return "user:" + userId + ":device:" + deviceId.trim();
        }
        if (guestId == null || guestId.isBlank()) {
            throw new IllegalArgumentException("匿名配对缺少 guestId");
        }
        return "guest:" + guestId.trim();
    }

    private TransferDevice requireOwnedDevice(Long userId, String deviceId) {
        TransferDevice device = transferDeviceMapper.selectById(deviceId);
        if (device == null || !Objects.equals(device.getUserId(), userId)) {
            throw new IllegalArgumentException("设备不存在或不属于当前账号");
        }
        return device;
    }

    private String normalizeRequiredDeviceId(String deviceId, String message) {
        if (deviceId == null || deviceId.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return deviceId.trim();
    }

    private String normalizeOptionalDeviceId(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return null;
        }
        return deviceId.trim();
    }

    private String normalizeLabel(String deviceName, String deviceType, Long userId) {
        String fallback = userId != null ? "Transfer User Device" : "Transfer Guest";
        String raw = deviceName == null || deviceName.isBlank() ? deviceType : deviceName;
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String normalized = raw.trim();
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("匹配码不能为空");
        }
        return code.trim().toUpperCase();
    }

    private String buildDirectPairKey(String leftChannelId, String rightChannelId) {
        return leftChannelId.compareTo(rightChannelId) <= 0
                ? leftChannelId + "|" + rightChannelId
                : rightChannelId + "|" + leftChannelId;
    }

    private String extractDeviceId(String channelId) {
        if (channelId == null) {
            return null;
        }
        int marker = channelId.indexOf(":device:");
        if (marker < 0) {
            return null;
        }
        String value = channelId.substring(marker + ":device:".length()).trim();
        return value.isBlank() ? null : value;
    }

    private TransferPairTaskVO toPairTaskVO(TransferPairTask task, String selfChannelId) {
        boolean selfIsLeft = Objects.equals(task.getLeftChannelId(), selfChannelId);
        TransferPairTaskVO vo = new TransferPairTaskVO();
        vo.setId(task.getId());
        vo.setPairSessionId(task.getPairSessionId());
        vo.setTaskKey(task.getTaskKey());
        vo.setDirection(selfIsLeft ? "outgoing" : "incoming");
        vo.setTransferMode(task.getTransferMode());
        vo.setCurrentTransferMode(task.getCurrentTransferMode());
        vo.setStage(task.getStatus());
        TransferAttemptLedger.View ledger = TransferAttemptLedger.load(task.getAttemptsJson()).view();
        TransferAttemptLedger.AttemptSummary summary = ledger.summary();
        vo.setAttemptStatus(summary.attemptStatus());
        vo.setStartReason(summary.startReason());
        vo.setEndReason(summary.endReason());
        vo.setFailureReason(summary.failureReason());
        vo.setSelfChannelId(selfChannelId);
        vo.setPeerChannelId(selfIsLeft ? task.getRightChannelId() : task.getLeftChannelId());
        vo.setSelfLabel(selfIsLeft ? task.getLeftLabel() : task.getRightLabel());
        vo.setPeerLabel(selfIsLeft ? task.getRightLabel() : task.getLeftLabel());
        vo.setFileName(task.getFileName());
        vo.setFileSize(task.getFileSize());
        vo.setContentType(task.getContentType());
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
        vo.setAttempts(ledger.attempts());
        return vo;
    }

    private TransferTaskAttemptVO buildPairAttempt(TransferPairTaskSyncRequest request,
                                                    String status,
                                                    int totalChunks,
                                                    int completedChunks,
                                                    LocalDateTime now) {
        TransferTaskAttemptVO attempt = new TransferTaskAttemptVO();
        attempt.setTransferMode("direct");
        attempt.setTransferId(normalizeClientTransferId(request.getClientTransferId()));
        attempt.setStage(status);
        attempt.setStartReason(firstNonBlank(
                request.getStartReason(),
                "pair_session_direct"
        ));
        attempt.setEndReason(resolvePairEndReason(status, request));
        attempt.setFailureReason(resolvePairFailureReason(status, request));
        attempt.setCompletedChunks(completedChunks);
        attempt.setTotalChunks(totalChunks);
        attempt.setStartTime(now);
        attempt.setUpdateTime(now);
        attempt.setCompletedAt("completed".equals(status) ? now : null);
        attempt.setFailedAt("failed".equals(status) ? now : null);
        attempt.setFallbackAt("relay_fallback".equals(status) ? now : null);
        attempt.setSavedToNetdiskAt(Boolean.TRUE.equals(request.getSavedToNetdisk()) ? now : null);
        attempt.setDownloadedAt(Boolean.TRUE.equals(request.getDownloaded()) ? now : null);
        return attempt;
    }

    private TransferPairTask savePairTaskWithAttempts(TransferPairTask task, TransferAttemptLedger ledger) {
        TransferAttemptLedger.View view = ledger.view();
        if (view.isEmpty()) {
            transferPairTaskMapper.deleteById(task.getId());
            return null;
        }

        TransferAttemptLedger.TaskProjection projection = view.task();
        task.setTransferMode(projection.transferMode());
        task.setCurrentTransferMode(projection.currentTransferMode());
        task.setStatus(projection.stage());
        task.setCompletedChunks(projection.completedChunks());
        task.setTotalChunks(projection.totalChunks() != null ? projection.totalChunks() : task.getTotalChunks());
        task.setUpdateTime(projection.updateTime() == null ? LocalDateTime.now() : projection.updateTime());
        task.setExpireTime(LocalDateTime.now().plusHours(transferProperties.getTransferTtlHours()));
        task.setCompletedAt(projection.completedAt() != null ? projection.completedAt() : task.getCompletedAt());
        task.setSavedToNetdiskAt(projection.savedToNetdiskAt() != null
                ? projection.savedToNetdiskAt()
                : task.getSavedToNetdiskAt());
        task.setAttemptsJson(view.serializedJson());
        transferPairTaskMapper.updateById(task);
        return transferPairTaskMapper.selectById(task.getId());
    }

    private String normalizeRequiredValue(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String normalizeClientTransferId(String value) {
        String normalized = normalizeRequiredValue(value, "直传记录标识不能为空");
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String normalizeFileName(String value) {
        String normalized = normalizeRequiredValue(value, "文件名不能为空").replace("\\", "_").replace("/", "_");
        return normalized.length() > 255 ? normalized.substring(0, 255) : normalized;
    }

    private long normalizeFileSize(Long value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("文件大小必须大于 0");
        }
        return value;
    }

    private int normalizeTotalChunks(Integer value) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException("分片总数必须大于 0");
        }
        return value;
    }

    private int normalizeCompletedChunks(Integer value, int totalChunks) {
        int normalized = value == null ? 0 : value;
        if (normalized < 0) {
            normalized = 0;
        }
        return Math.min(totalChunks, normalized);
    }

    private String normalizeStatus(String status, String fallback) {
        if (status == null || status.isBlank()) {
            return fallback;
        }
        String normalized = status.trim();
        return normalized.length() > 32 ? normalized.substring(0, 32) : normalized;
    }

    private String normalizeTaskKey(String taskKey, String clientTransferId) {
        if (taskKey == null || taskKey.isBlank()) {
            return "pair:" + normalizeClientTransferId(clientTransferId);
        }
        String normalized = taskKey.trim();
        return normalized.length() > 255 ? normalized.substring(0, 255) : normalized;
    }

    private String normalizeOptionalLabel(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String normalized = value.trim();
        return normalized.length() > 128 ? normalized.substring(0, 128) : normalized;
    }

    private String resolvePairEndReason(String status, TransferPairTaskSyncRequest request) {
        if (request.getEndReason() != null && !request.getEndReason().isBlank()) {
            return request.getEndReason();
        }
        if (Boolean.TRUE.equals(request.getSavedToNetdisk())) {
            return "saved_to_netdisk";
        }
        if (Boolean.TRUE.equals(request.getDownloaded())) {
            return "downloaded";
        }
        return switch (status) {
            case "completed" -> "peer_confirmed";
            case "relay_fallback" -> "relay_fallback";
            case "failed" -> "failed";
            case "cancelled" -> "cancelled";
            default -> null;
        };
    }

    private String resolvePairFailureReason(String status, TransferPairTaskSyncRequest request) {
        if (request.getFailureReason() != null && !request.getFailureReason().isBlank()) {
            return request.getFailureReason();
        }
        return switch (status) {
            case "relay_fallback" -> "direct_transfer_interrupted";
            case "failed" -> "direct_transfer_failed";
            default -> null;
        };
    }

    private String firstNonBlank(String primary, String fallback) {
        return primary != null && !primary.isBlank() ? primary : fallback;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "application/octet-stream";
        }
        return contentType.trim();
    }

    private record PairCodeEntry(
            String code,
            String creatorChannelId,
            String creatorLabel,
            LocalDateTime expireTime,
            String pairSessionId,
            String claimerChannelId,
            String claimerLabel
    ) {
    }

    private record DirectSessionEntry(
            String pairSessionId,
            String leftChannelId,
            String rightChannelId,
            String peerLabel,
            LocalDateTime expireTime
    ) {
    }
}
