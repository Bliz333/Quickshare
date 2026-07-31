package com.finalpre.quickshare.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.finalpre.quickshare.vo.TransferTaskAttemptVO;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Slf4j
final class TransferAttemptLedger {

    private static final String MODE_HYBRID = "hybrid";
    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private final List<TransferTaskAttemptVO> attempts;
    private final boolean corrupted;

    private TransferAttemptLedger(List<TransferTaskAttemptVO> attempts, boolean corrupted) {
        this.attempts = normalizeAttempts(attempts);
        this.corrupted = corrupted;
    }

    static TransferAttemptLedger load(String attemptsJson) {
        if (attemptsJson == null || attemptsJson.isBlank()) {
            return new TransferAttemptLedger(List.of(), false);
        }
        try {
            List<TransferTaskAttemptVO> parsed = OBJECT_MAPPER.readValue(
                    attemptsJson,
                    new TypeReference<List<TransferTaskAttemptVO>>() {
                    }
            );
            if (parsed == null) {
                log.warn("Failed to parse transfer attempt ledger: JSON root is null");
                return new TransferAttemptLedger(List.of(), true);
            }
            return new TransferAttemptLedger(parsed, false);
        } catch (IOException | RuntimeException ex) {
            log.warn("Failed to parse transfer attempt ledger: {}", ex.getMessage());
            log.debug("Transfer attempt ledger parse stack", ex);
            return new TransferAttemptLedger(List.of(), true);
        }
    }

    boolean isCorrupted() {
        return corrupted;
    }

    TransferAttemptLedger upsert(TransferTaskAttemptVO nextAttempt) {
        Objects.requireNonNull(nextAttempt, "nextAttempt");
        List<TransferTaskAttemptVO> updated = new ArrayList<>(corrupted ? List.of() : attempts);
        for (int index = 0; index < updated.size(); index++) {
            TransferTaskAttemptVO existing = updated.get(index);
            if (Objects.equals(existing.getTransferMode(), nextAttempt.getTransferMode())
                    && Objects.equals(existing.getTransferId(), nextAttempt.getTransferId())) {
                updated.set(index, mergeAttempt(existing, nextAttempt));
                return new TransferAttemptLedger(updated, false);
            }
        }
        updated.add(mergeAttempt(null, nextAttempt));
        return new TransferAttemptLedger(updated, false);
    }

    TransferAttemptLedger remove(String transferMode, String transferId) {
        if (corrupted) {
            return this;
        }
        List<TransferTaskAttemptVO> updated = attempts.stream()
                .filter(attempt -> !Objects.equals(attempt.getTransferMode(), transferMode)
                        || !Objects.equals(attempt.getTransferId(), transferId))
                .toList();
        return new TransferAttemptLedger(updated, false);
    }

    TransferAttemptLedger remove(String transferId) {
        if (corrupted) {
            return this;
        }
        List<TransferTaskAttemptVO> updated = attempts.stream()
                .filter(attempt -> !Objects.equals(attempt.getTransferId(), transferId))
                .toList();
        return new TransferAttemptLedger(updated, false);
    }

    View view() {
        List<TransferTaskAttemptVO> copiedAttempts = attempts.stream()
                .map(TransferAttemptLedger::copyAttempt)
                .toList();
        AttemptSummary summary = summarize(copiedAttempts);
        TaskProjection task = project(copiedAttempts, summary);
        return new View(copiedAttempts, summary, task);
    }

    private static List<TransferTaskAttemptVO> normalizeAttempts(List<TransferTaskAttemptVO> attempts) {
        if (attempts == null || attempts.isEmpty()) {
            return List.of();
        }
        return attempts.stream()
                .filter(Objects::nonNull)
                .filter(attempt -> attempt.getTransferMode() != null && !attempt.getTransferMode().isBlank())
                .filter(attempt -> attempt.getTransferId() != null && !attempt.getTransferId().isBlank())
                .map(TransferAttemptLedger::copyAttempt)
                .sorted(Comparator.comparing(
                        TransferTaskAttemptVO::getUpdateTime,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .toList();
    }

    private static String serialize(List<TransferTaskAttemptVO> attempts) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attempts);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to serialize transfer attempt ledger", ex);
        }
    }

    private static TransferTaskAttemptVO mergeAttempt(TransferTaskAttemptVO existing,
                                                       TransferTaskAttemptVO next) {
        TransferTaskAttemptVO merged = new TransferTaskAttemptVO();
        merged.setTransferMode(firstNonBlank(next.getTransferMode(), existing == null ? null : existing.getTransferMode()));
        merged.setTransferId(firstNonBlank(next.getTransferId(), existing == null ? null : existing.getTransferId()));
        merged.setStage(firstNonBlank(next.getStage(), existing == null ? null : existing.getStage()));
        String nextAttemptStatus = next.getAttemptStatus();
        if ((nextAttemptStatus == null || nextAttemptStatus.isBlank())
                && next.getStage() != null && !next.getStage().isBlank()) {
            nextAttemptStatus = normalizeAttemptStatus(null, next.getStage());
        }
        merged.setAttemptStatus(normalizeAttemptStatus(
                firstNonBlank(nextAttemptStatus, existing == null ? null : existing.getAttemptStatus()),
                merged.getStage()
        ));
        merged.setStartReason(normalizeReason(firstNonBlank(
                next.getStartReason(),
                existing == null ? null : existing.getStartReason()
        )));
        merged.setEndReason(normalizeReason(firstNonBlank(
                next.getEndReason(),
                existing == null ? null : existing.getEndReason()
        )));
        merged.setFailureReason(normalizeReason(firstNonBlank(
                next.getFailureReason(),
                existing == null ? null : existing.getFailureReason()
        )));
        merged.setCompletedChunks(next.getCompletedChunks() != null
                ? next.getCompletedChunks()
                : existing == null ? null : existing.getCompletedChunks());
        merged.setTotalChunks(next.getTotalChunks() != null
                ? next.getTotalChunks()
                : existing == null ? null : existing.getTotalChunks());
        merged.setStartTime(firstNonNull(
                existing == null ? null : existing.getStartTime(),
                next.getStartTime(),
                next.getUpdateTime(),
                existing == null ? null : existing.getUpdateTime()
        ));
        merged.setUpdateTime(firstNonNull(
                next.getUpdateTime(),
                existing == null ? null : existing.getUpdateTime(),
                LocalDateTime.now()
        ));
        merged.setCompletedAt(firstNonNull(existing == null ? null : existing.getCompletedAt(), next.getCompletedAt()));
        merged.setFailedAt(firstNonNull(existing == null ? null : existing.getFailedAt(), next.getFailedAt()));
        merged.setFallbackAt(firstNonNull(existing == null ? null : existing.getFallbackAt(), next.getFallbackAt()));
        merged.setSavedToNetdiskAt(firstNonNull(
                existing == null ? null : existing.getSavedToNetdiskAt(),
                next.getSavedToNetdiskAt()
        ));
        merged.setDownloadedAt(firstNonNull(
                existing == null ? null : existing.getDownloadedAt(),
                next.getDownloadedAt()
        ));
        return merged;
    }

    private static TaskProjection project(List<TransferTaskAttemptVO> attempts, AttemptSummary summary) {
        if (attempts.isEmpty()) {
            return TaskProjection.empty();
        }
        TransferTaskAttemptVO current = attempts.get(0);
        long modeCount = attempts.stream()
                .map(TransferTaskAttemptVO::getTransferMode)
                .distinct()
                .count();
        Integer totalChunks = current.getTotalChunks() != null && current.getTotalChunks() > 0
                ? current.getTotalChunks()
                : null;
        return new TaskProjection(
                modeCount > 1 ? MODE_HYBRID : current.getTransferMode(),
                current.getTransferMode(),
                current.getStage(),
                current.getCompletedChunks(),
                totalChunks,
                current.getUpdateTime(),
                summary.completedAt(),
                summary.savedToNetdiskAt()
        );
    }

    private static AttemptSummary summarize(List<TransferTaskAttemptVO> attempts) {
        if (attempts.isEmpty()) {
            return AttemptSummary.empty();
        }
        TransferTaskAttemptVO current = attempts.get(0);
        return new AttemptSummary(
                normalizeAttemptStatus(current.getAttemptStatus(), current.getStage()),
                normalizeReason(current.getStartReason()),
                normalizeReason(current.getEndReason()),
                normalizeReason(firstNonBlank(current.getFailureReason(), latestFailureReason(attempts))),
                current.getStartTime() != null ? current.getStartTime() : current.getUpdateTime(),
                latestCompletedAt(attempts),
                latestFailedAt(attempts),
                latestFallbackAt(attempts),
                latestTime(attempts, TransferTaskAttemptVO::getSavedToNetdiskAt),
                latestTime(attempts, TransferTaskAttemptVO::getDownloadedAt)
        );
    }

    private static String normalizeAttemptStatus(String attemptStatus, String stage) {
        String normalized = trimToLength(attemptStatus, 32);
        if (normalized != null) {
            return normalized;
        }
        String normalizedStage = trimToLength(stage, 32);
        if (normalizedStage == null) {
            return "waiting";
        }
        return switch (normalizedStage) {
            case "waiting_accept", "pending_upload", "ready", "waiting_complete" -> "waiting";
            case "negotiating" -> "negotiating";
            case "sending", "receiving", "uploading" -> "transferring";
            case "relay_fallback" -> "relay_fallback";
            case "failed" -> "failed";
            case "completed" -> "completed";
            case "cancelled" -> "cancelled";
            default -> normalizedStage;
        };
    }

    private static String normalizeReason(String value) {
        return trimToLength(value, 64);
    }

    private static String latestFailureReason(List<TransferTaskAttemptVO> attempts) {
        return attempts.stream()
                .sorted(Comparator.comparing(
                        TransferTaskAttemptVO::getUpdateTime,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(TransferTaskAttemptVO::getFailureReason)
                .map(TransferAttemptLedger::normalizeReason)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static LocalDateTime latestCompletedAt(List<TransferTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, TransferTaskAttemptVO::getCompletedAt);
        if (explicit != null) {
            return explicit;
        }
        return latestStageTime(attempts, "completed");
    }

    private static LocalDateTime latestFailedAt(List<TransferTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, TransferTaskAttemptVO::getFailedAt);
        if (explicit != null) {
            return explicit;
        }
        return latestStageTime(attempts, "failed");
    }

    private static LocalDateTime latestFallbackAt(List<TransferTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, TransferTaskAttemptVO::getFallbackAt);
        if (explicit != null) {
            return explicit;
        }
        return latestStageTime(attempts, "relay_fallback");
    }

    private static LocalDateTime latestStageTime(List<TransferTaskAttemptVO> attempts, String expectedStatus) {
        return attempts.stream()
                .filter(attempt -> expectedStatus.equals(normalizeAttemptStatus(
                        attempt.getAttemptStatus(),
                        attempt.getStage()
                )) || expectedStatus.equals(trimToLength(attempt.getStage(), 32)))
                .map(TransferTaskAttemptVO::getUpdateTime)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private static LocalDateTime latestTime(List<TransferTaskAttemptVO> attempts,
                                            java.util.function.Function<TransferTaskAttemptVO, LocalDateTime> getter) {
        return attempts.stream()
                .map(getter)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private static TransferTaskAttemptVO copyAttempt(TransferTaskAttemptVO source) {
        TransferTaskAttemptVO copy = new TransferTaskAttemptVO();
        copy.setTransferMode(source.getTransferMode());
        copy.setTransferId(source.getTransferId());
        copy.setStage(source.getStage());
        copy.setAttemptStatus(source.getAttemptStatus());
        copy.setStartReason(source.getStartReason());
        copy.setEndReason(source.getEndReason());
        copy.setFailureReason(source.getFailureReason());
        copy.setCompletedChunks(source.getCompletedChunks());
        copy.setTotalChunks(source.getTotalChunks());
        copy.setStartTime(source.getStartTime());
        copy.setUpdateTime(source.getUpdateTime());
        copy.setCompletedAt(source.getCompletedAt());
        copy.setFailedAt(source.getFailedAt());
        copy.setFallbackAt(source.getFallbackAt());
        copy.setSavedToNetdiskAt(source.getSavedToNetdiskAt());
        copy.setDownloadedAt(source.getDownloadedAt());
        return copy;
    }

    private static String firstNonBlank(String primary, String secondary) {
        return primary != null && !primary.isBlank() ? primary : secondary;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String trimToLength(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        return normalized.length() > maxLength ? normalized.substring(0, maxLength) : normalized;
    }

    static final class View {
        private final List<TransferTaskAttemptVO> attempts;
        private final AttemptSummary summary;
        private final TaskProjection task;

        private View(List<TransferTaskAttemptVO> attempts,
                     AttemptSummary summary,
                     TaskProjection task) {
            this.attempts = attempts.stream()
                    .map(TransferAttemptLedger::copyAttempt)
                    .toList();
            this.summary = summary;
            this.task = task;
        }

        List<TransferTaskAttemptVO> attempts() {
            return attempts.stream()
                    .map(TransferAttemptLedger::copyAttempt)
                    .toList();
        }

        String serializedJson() {
            return serialize(attempts);
        }

        AttemptSummary summary() {
            return summary;
        }

        TaskProjection task() {
            return task;
        }

        boolean isEmpty() {
            return attempts.isEmpty();
        }
    }

    record TaskProjection(
            String transferMode,
            String currentTransferMode,
            String stage,
            Integer completedChunks,
            Integer totalChunks,
            LocalDateTime updateTime,
            LocalDateTime completedAt,
            LocalDateTime savedToNetdiskAt
    ) {
        static TaskProjection empty() {
            return new TaskProjection(null, null, null, null, null, null, null, null);
        }
    }

    record AttemptSummary(
            String attemptStatus,
            String startReason,
            String endReason,
            String failureReason,
            LocalDateTime startTime,
            LocalDateTime completedAt,
            LocalDateTime failedAt,
            LocalDateTime fallbackAt,
            LocalDateTime savedToNetdiskAt,
            LocalDateTime downloadedAt
    ) {
        static AttemptSummary empty() {
            return new AttemptSummary(null, null, null, null, null, null, null, null, null, null);
        }
    }
}
