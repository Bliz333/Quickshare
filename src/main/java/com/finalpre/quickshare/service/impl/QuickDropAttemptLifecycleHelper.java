package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.vo.QuickDropTaskAttemptVO;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

final class QuickDropAttemptLifecycleHelper {

    private QuickDropAttemptLifecycleHelper() {
    }

    static QuickDropTaskAttemptVO mergeAttempt(QuickDropTaskAttemptVO existing, QuickDropTaskAttemptVO next) {
        QuickDropTaskAttemptVO merged = new QuickDropTaskAttemptVO();
        merged.setTransferMode(firstNonBlank(next.getTransferMode(), existing == null ? null : existing.getTransferMode()));
        merged.setTransferId(firstNonBlank(next.getTransferId(), existing == null ? null : existing.getTransferId()));
        merged.setStage(firstNonBlank(next.getStage(), existing == null ? null : existing.getStage()));
        merged.setAttemptStatus(normalizeAttemptStatus(firstNonBlank(
                next.getAttemptStatus(),
                existing == null ? null : existing.getAttemptStatus()
        ), merged.getStage()));
        merged.setStartReason(normalizeReason(firstNonBlank(next.getStartReason(), existing == null ? null : existing.getStartReason())));
        merged.setEndReason(normalizeReason(firstNonBlank(next.getEndReason(), existing == null ? null : existing.getEndReason())));
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
        merged.setUpdateTime(firstNonNull(next.getUpdateTime(), existing == null ? null : existing.getUpdateTime(), LocalDateTime.now()));
        merged.setCompletedAt(firstNonNull(
                existing == null ? null : existing.getCompletedAt(),
                next.getCompletedAt()
        ));
        merged.setFailedAt(firstNonNull(
                existing == null ? null : existing.getFailedAt(),
                next.getFailedAt()
        ));
        merged.setFallbackAt(firstNonNull(
                existing == null ? null : existing.getFallbackAt(),
                next.getFallbackAt()
        ));
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

    static AttemptSummary summarize(List<QuickDropTaskAttemptVO> attempts) {
        if (attempts == null || attempts.isEmpty()) {
            return AttemptSummary.empty();
        }
        QuickDropTaskAttemptVO current = attempts.stream()
                .max(Comparator.comparing(QuickDropTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(attempts.get(0));
        return new AttemptSummary(
                normalizeAttemptStatus(current.getAttemptStatus(), current.getStage()),
                normalizeReason(current.getStartReason()),
                normalizeReason(current.getEndReason()),
                normalizeReason(firstNonBlank(current.getFailureReason(), latestFailureReason(attempts))),
                current.getStartTime() != null ? current.getStartTime() : current.getUpdateTime(),
                latestCompletedAt(attempts),
                latestFailedAt(attempts),
                latestFallbackAt(attempts),
                latestTime(attempts, QuickDropTaskAttemptVO::getSavedToNetdiskAt),
                latestTime(attempts, QuickDropTaskAttemptVO::getDownloadedAt)
        );
    }

    static String normalizeAttemptStatus(String attemptStatus, String stage) {
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

    static String normalizeReason(String value) {
        return trimToLength(value, 64);
    }

    private static String latestFailureReason(List<QuickDropTaskAttemptVO> attempts) {
        return attempts.stream()
                .sorted(Comparator.comparing(QuickDropTaskAttemptVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(QuickDropTaskAttemptVO::getFailureReason)
                .map(QuickDropAttemptLifecycleHelper::normalizeReason)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static LocalDateTime latestTime(List<QuickDropTaskAttemptVO> attempts,
                                            java.util.function.Function<QuickDropTaskAttemptVO, LocalDateTime> getter) {
        return attempts.stream()
                .map(getter)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private static LocalDateTime latestCompletedAt(List<QuickDropTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, QuickDropTaskAttemptVO::getCompletedAt);
        if (explicit != null) {
            return explicit;
        }
        return attempts.stream()
                .filter(attempt -> "completed".equals(normalizeAttemptStatus(attempt.getAttemptStatus(), attempt.getStage()))
                        || "completed".equals(trimToLength(attempt.getStage(), 32)))
                .map(QuickDropTaskAttemptVO::getUpdateTime)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private static LocalDateTime latestFailedAt(List<QuickDropTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, QuickDropTaskAttemptVO::getFailedAt);
        if (explicit != null) {
            return explicit;
        }
        return attempts.stream()
                .filter(attempt -> "failed".equals(normalizeAttemptStatus(attempt.getAttemptStatus(), attempt.getStage()))
                        || "failed".equals(trimToLength(attempt.getStage(), 32)))
                .map(QuickDropTaskAttemptVO::getUpdateTime)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private static LocalDateTime latestFallbackAt(List<QuickDropTaskAttemptVO> attempts) {
        LocalDateTime explicit = latestTime(attempts, QuickDropTaskAttemptVO::getFallbackAt);
        if (explicit != null) {
            return explicit;
        }
        return attempts.stream()
                .filter(attempt -> "relay_fallback".equals(normalizeAttemptStatus(attempt.getAttemptStatus(), attempt.getStage()))
                        || "relay_fallback".equals(trimToLength(attempt.getStage(), 32)))
                .map(QuickDropTaskAttemptVO::getUpdateTime)
                .filter(value -> value != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);
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
