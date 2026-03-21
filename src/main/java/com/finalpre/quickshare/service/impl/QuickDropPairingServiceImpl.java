package com.finalpre.quickshare.service.impl;

import cn.hutool.core.util.RandomUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.finalpre.quickshare.config.QuickDropProperties;
import com.finalpre.quickshare.dto.QuickDropDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.QuickDropPairCodeClaimRequest;
import com.finalpre.quickshare.dto.QuickDropPairCodeCreateRequest;
import com.finalpre.quickshare.dto.QuickDropPairTaskSyncRequest;
import com.finalpre.quickshare.entity.QuickDropDevice;
import com.finalpre.quickshare.entity.QuickDropPairTask;
import com.finalpre.quickshare.mapper.QuickDropDeviceMapper;
import com.finalpre.quickshare.mapper.QuickDropPairTaskMapper;
import com.finalpre.quickshare.service.QuickDropPairingService;
import com.finalpre.quickshare.service.QuickDropSignalingService;
import com.finalpre.quickshare.vo.QuickDropDirectSessionVO;
import com.finalpre.quickshare.vo.QuickDropPairClaimVO;
import com.finalpre.quickshare.vo.QuickDropPairCodeVO;
import com.finalpre.quickshare.vo.QuickDropPairTaskVO;
import com.finalpre.quickshare.vo.QuickDropTaskAttemptVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class QuickDropPairingServiceImpl implements QuickDropPairingService {

    private static final ObjectMapper QUICKDROP_OBJECT_MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    @Autowired
    private QuickDropProperties quickDropProperties;

    @Autowired
    private QuickDropSignalingService quickDropSignalingService;

    @Autowired
    private QuickDropDeviceMapper quickDropDeviceMapper;

    @Autowired
    private QuickDropPairTaskMapper quickDropPairTaskMapper;

    private final Map<String, PairCodeEntry> pairCodes = new ConcurrentHashMap<>();
    private final Map<String, DirectSessionEntry> directSessions = new ConcurrentHashMap<>();

    @Override
    public QuickDropPairCodeVO createPairCode(Long userId, QuickDropPairCodeCreateRequest request) {
        purgeExpiredCodes();
        String creatorChannelId = buildChannelId(userId, request.getDeviceId(), request.getGuestId());
        String creatorLabel = normalizeLabel(request.getDeviceName(), request.getDeviceType(), userId);
        String code = nextCode();
        LocalDateTime expireTime = LocalDateTime.now().plusMinutes(quickDropProperties.getPairCodeTtlMinutes());
        pairCodes.put(code, new PairCodeEntry(code, creatorChannelId, creatorLabel, expireTime, null, null, null));

        QuickDropPairCodeVO vo = new QuickDropPairCodeVO();
        vo.setCode(code);
        vo.setCreatorChannelId(creatorChannelId);
        vo.setCreatorLabel(creatorLabel);
        vo.setExpireTime(expireTime);
        return vo;
    }

    @Override
    public QuickDropPairClaimVO claimPairCode(Long userId, String code, QuickDropPairCodeClaimRequest request) {
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
            quickDropSignalingService.bindPairSession(pairSessionId, current.creatorChannelId(), claimerChannelId);
        } catch (IOException ignored) {
            // Pair session still exists even if one side is temporarily offline.
        }

        QuickDropPairClaimVO vo = new QuickDropPairClaimVO();
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
    public QuickDropDirectSessionVO createDirectSession(Long userId, QuickDropDirectSessionCreateRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("请先登录后再发起同账号直连");
        }

        String deviceId = normalizeRequiredDeviceId(request.getDeviceId(), "当前设备缺少 deviceId");
        String targetDeviceId = normalizeRequiredDeviceId(request.getTargetDeviceId(), "目标设备缺少 deviceId");
        if (Objects.equals(deviceId, targetDeviceId)) {
            throw new IllegalArgumentException("请选择另一台设备");
        }

        QuickDropDevice selfDevice = requireOwnedDevice(userId, deviceId);
        QuickDropDevice peerDevice = requireOwnedDevice(userId, targetDeviceId);

        String selfChannelId = buildChannelId(userId, selfDevice.getDeviceId(), null);
        String peerChannelId = buildChannelId(userId, peerDevice.getDeviceId(), null);
        if (!quickDropSignalingService.isConnected(selfChannelId)) {
            throw new IllegalArgumentException("当前设备的直连信令尚未连上");
        }
        if (!quickDropSignalingService.isConnected(peerChannelId)) {
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
                    LocalDateTime.now().plusMinutes(Math.max(quickDropProperties.getPairCodeTtlMinutes(), 10))
            );
            directSessions.put(pairKey, directSession);
        }

        try {
            quickDropSignalingService.bindPairSession(directSession.pairSessionId(), selfChannelId, peerChannelId);
        } catch (IOException ex) {
            throw new IllegalStateException("建立直连会话失败");
        }

        QuickDropDirectSessionVO vo = new QuickDropDirectSessionVO();
        vo.setPairSessionId(directSession.pairSessionId());
        vo.setSelfChannelId(selfChannelId);
        vo.setSelfDeviceId(selfDevice.getDeviceId());
        vo.setPeerChannelId(peerChannelId);
        vo.setPeerDeviceId(peerDevice.getDeviceId());
        vo.setPeerLabel(peerDevice.getDeviceName());
        return vo;
    }

    @Override
    public QuickDropPairTaskVO syncPairTask(QuickDropPairTaskSyncRequest request) {
        String pairSessionId = normalizeRequiredValue(request.getPairSessionId(), "配对会话缺失");
        String selfChannelId = normalizeRequiredValue(request.getSelfChannelId(), "当前通道缺失");
        String peerChannelId = normalizeRequiredValue(request.getPeerChannelId(), "对端通道缺失");
        String taskKey = normalizeTaskKey(request.getTaskKey(), request.getClientTransferId());
        String fileName = normalizeFileName(request.getFileName());
        long fileSize = normalizeFileSize(request.getFileSize());
        int totalChunks = normalizeTotalChunks(request.getTotalChunks());
        int completedChunks = normalizeCompletedChunks(request.getCompletedChunks(), totalChunks);
        String status = normalizeStatus(request.getStatus(), "sending");

        QuickDropPairTask task = quickDropPairTaskMapper.selectOne(new QueryWrapper<QuickDropPairTask>()
                .eq("pair_session_id", pairSessionId)
                .eq("task_key", taskKey)
                .orderByDesc("update_time")
                .last("LIMIT 1"));
        if (task == null) {
            task = new QuickDropPairTask();
            task.setPairSessionId(pairSessionId);
            task.setTaskKey(taskKey);
            task.setLeftChannelId(selfChannelId);
            task.setRightChannelId(peerChannelId);
            task.setLeftLabel(normalizeOptionalLabel(request.getSelfLabel(), "QuickDrop Guest"));
            task.setRightLabel(normalizeOptionalLabel(request.getPeerLabel(), "QuickDrop Peer"));
            task.setFileName(fileName);
            task.setFileSize(fileSize);
            task.setContentType(normalizeContentType(request.getContentType()));
            task.setTotalChunks(totalChunks);
            task.setTransferMode("direct");
            task.setCurrentTransferMode("direct");
            task.setStatus(status);
            task.setCompletedChunks(completedChunks);
            task.setAttemptsJson("[]");
            task.setCreateTime(LocalDateTime.now());
            task.setUpdateTime(task.getCreateTime());
            task.setExpireTime(task.getCreateTime().plusHours(quickDropProperties.getTransferTtlHours()));
            quickDropPairTaskMapper.insert(task);
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
        task.setExpireTime(LocalDateTime.now().plusHours(quickDropProperties.getTransferTtlHours()));

        List<QuickDropTaskAttemptVO> attempts = parseAttempts(task.getAttemptsJson());
        QuickDropTaskAttemptVO attempt = new QuickDropTaskAttemptVO();
        attempt.setTransferMode("direct");
        attempt.setTransferId(normalizeClientTransferId(request.getClientTransferId()));
        attempt.setStage(status);
        attempt.setCompletedChunks(completedChunks);
        attempt.setTotalChunks(totalChunks);
        attempt.setUpdateTime(LocalDateTime.now());
        upsertAttempt(attempts, attempt);

        task.setCurrentTransferMode("direct");
        task.setTransferMode("direct");
        task.setStatus(status);
        task.setCompletedChunks(completedChunks);
        if (Boolean.TRUE.equals(request.getSavedToNetdisk())) {
            task.setSavedToNetdiskAt(LocalDateTime.now());
        }
        if (Boolean.TRUE.equals(request.getDownloaded()) || "completed".equals(status)) {
            task.setCompletedAt(LocalDateTime.now());
        }
        task.setAttemptsJson(writeAttempts(attempts));
        task.setUpdateTime(LocalDateTime.now());
        quickDropPairTaskMapper.updateById(task);
        return toPairTaskVO(task, selfChannelId);
    }

    @Override
    public List<QuickDropPairTaskVO> listPairTasks(String pairSessionId, String selfChannelId) {
        String normalizedPairSessionId = normalizeRequiredValue(pairSessionId, "配对会话缺失");
        String normalizedSelfChannelId = normalizeRequiredValue(selfChannelId, "当前通道缺失");

        return quickDropPairTaskMapper.selectList(new QueryWrapper<QuickDropPairTask>()
                        .eq("pair_session_id", normalizedPairSessionId)
                        .orderByDesc("update_time"))
                .stream()
                .filter(task -> Objects.equals(task.getPairSessionId(), normalizedPairSessionId))
                .filter(task -> Objects.equals(task.getLeftChannelId(), normalizedSelfChannelId)
                        || Objects.equals(task.getRightChannelId(), normalizedSelfChannelId))
                .sorted(Comparator.comparing(QuickDropPairTask::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(task -> toPairTaskVO(task, normalizedSelfChannelId))
                .toList();
    }

    @Override
    public void deletePairTaskAttempt(Long taskId, String pairSessionId, String selfChannelId, String clientTransferId) {
        QuickDropPairTask task = quickDropPairTaskMapper.selectById(taskId);
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
        List<QuickDropTaskAttemptVO> attempts = parseAttempts(task.getAttemptsJson());
        attempts.removeIf(attempt -> Objects.equals(attempt.getTransferId(), normalizedClientTransferId));
        if (attempts.isEmpty()) {
            quickDropPairTaskMapper.deleteById(taskId);
            return;
        }

        attempts.sort(Comparator.comparing(QuickDropTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())));
        QuickDropTaskAttemptVO current = attempts.get(0);
        task.setStatus(current.getStage());
        task.setCompletedChunks(current.getCompletedChunks());
        task.setTotalChunks(current.getTotalChunks());
        task.setAttemptsJson(writeAttempts(attempts));
        task.setUpdateTime(LocalDateTime.now());
        quickDropPairTaskMapper.updateById(task);
    }

    private void purgeExpiredCodes() {
        LocalDateTime now = LocalDateTime.now();
        pairCodes.entrySet().removeIf(entry -> entry.getValue().expireTime().isBefore(now));
    }

    private void purgeExpiredDirectSessions() {
        LocalDateTime now = LocalDateTime.now();
        directSessions.entrySet().removeIf(entry -> entry.getValue().expireTime().isBefore(now)
                || !quickDropSignalingService.isConnected(entry.getValue().leftChannelId())
                || !quickDropSignalingService.isConnected(entry.getValue().rightChannelId()));
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

    private QuickDropDevice requireOwnedDevice(Long userId, String deviceId) {
        QuickDropDevice device = quickDropDeviceMapper.selectById(deviceId);
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
        String fallback = userId != null ? "QuickDrop User Device" : "QuickDrop Guest";
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

    private QuickDropPairTaskVO toPairTaskVO(QuickDropPairTask task, String selfChannelId) {
        boolean selfIsLeft = Objects.equals(task.getLeftChannelId(), selfChannelId);
        QuickDropPairTaskVO vo = new QuickDropPairTaskVO();
        vo.setId(task.getId());
        vo.setPairSessionId(task.getPairSessionId());
        vo.setTaskKey(task.getTaskKey());
        vo.setDirection(selfIsLeft ? "outgoing" : "incoming");
        vo.setTransferMode(task.getTransferMode());
        vo.setCurrentTransferMode(task.getCurrentTransferMode());
        vo.setStage(task.getStatus());
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
        vo.setCompletedAt(task.getCompletedAt());
        vo.setSavedToNetdiskAt(task.getSavedToNetdiskAt());
        vo.setAttempts(parseAttempts(task.getAttemptsJson()).stream()
                .sorted(Comparator.comparing(QuickDropTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList());
        return vo;
    }

    private List<QuickDropTaskAttemptVO> parseAttempts(String attemptsJson) {
        if (attemptsJson == null || attemptsJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(QUICKDROP_OBJECT_MAPPER.readValue(attemptsJson, new TypeReference<List<QuickDropTaskAttemptVO>>() {
            }));
        } catch (IOException ex) {
            return new ArrayList<>();
        }
    }

    private String writeAttempts(List<QuickDropTaskAttemptVO> attempts) {
        try {
            return QUICKDROP_OBJECT_MAPPER.writeValueAsString(attempts.stream()
                    .sorted(Comparator.comparing(QuickDropTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                    .toList());
        } catch (IOException ex) {
            throw new IllegalStateException("无法写入配对任务记录");
        }
    }

    private void upsertAttempt(List<QuickDropTaskAttemptVO> attempts, QuickDropTaskAttemptVO nextAttempt) {
        for (int index = 0; index < attempts.size(); index++) {
            QuickDropTaskAttemptVO existing = attempts.get(index);
            if (Objects.equals(existing.getTransferMode(), nextAttempt.getTransferMode())
                    && Objects.equals(existing.getTransferId(), nextAttempt.getTransferId())) {
                attempts.set(index, nextAttempt);
                return;
            }
        }
        attempts.add(nextAttempt);
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
