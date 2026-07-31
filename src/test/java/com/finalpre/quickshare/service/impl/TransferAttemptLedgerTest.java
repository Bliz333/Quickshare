package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.vo.TransferTaskAttemptVO;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class TransferAttemptLedgerTest {

    @Test
    void upsertShouldMergeLifecycleAndRoundTripThroughTheInterface() {
        LocalDateTime startedAt = LocalDateTime.of(2026, 7, 31, 10, 0);
        LocalDateTime fallbackAt = startedAt.plusMinutes(1);

        TransferTaskAttemptVO sending = attempt("direct", "direct-1", "sending", startedAt);
        sending.setStartReason("same_account_direct");
        sending.setCompletedChunks(1);
        sending.setTotalChunks(3);

        TransferTaskAttemptVO fallback = attempt("direct", "direct-1", "relay_fallback", fallbackAt);
        fallback.setFailureReason("peer_missed_offer");
        fallback.setFallbackAt(fallbackAt);

        TransferAttemptLedger.View view = TransferAttemptLedger.load("[]")
                .upsert(sending)
                .upsert(fallback)
                .view();

        assertThat(view.attempts()).hasSize(1);
        assertThat(view.attempts().get(0).getStartTime()).isEqualTo(startedAt);
        assertThat(view.attempts().get(0).getFailureReason()).isEqualTo("peer_missed_offer");
        assertThat(view.summary().attemptStatus()).isEqualTo("relay_fallback");
        assertThat(view.summary().fallbackAt()).isEqualTo(fallbackAt);
        assertThat(view.task().transferMode()).isEqualTo("direct");
        assertThat(view.task().stage()).isEqualTo("relay_fallback");

        TransferAttemptLedger.View reloaded = TransferAttemptLedger.load(view.serializedJson()).view();
        assertThat(reloaded.attempts()).usingRecursiveComparison().isEqualTo(view.attempts());
    }

    @Test
    void viewShouldSortAttemptsAndProjectHybridTaskState() {
        LocalDateTime directAt = LocalDateTime.of(2026, 7, 31, 10, 0);
        LocalDateTime relayAt = directAt.plusMinutes(2);

        TransferTaskAttemptVO direct = attempt("direct", "direct-1", "relay_fallback", directAt);
        direct.setFailureReason("direct_transfer_interrupted");
        direct.setFallbackAt(directAt);
        TransferTaskAttemptVO relay = attempt("relay", "42", "ready", relayAt);
        relay.setCompletedChunks(4);
        relay.setTotalChunks(4);

        TransferAttemptLedger.View view = TransferAttemptLedger.load("[]")
                .upsert(direct)
                .upsert(relay)
                .view();

        assertThat(view.attempts()).extracting(TransferTaskAttemptVO::getTransferMode)
                .containsExactly("relay", "direct");
        assertThat(view.task().transferMode()).isEqualTo("hybrid");
        assertThat(view.task().currentTransferMode()).isEqualTo("relay");
        assertThat(view.task().stage()).isEqualTo("ready");
        assertThat(view.task().completedChunks()).isEqualTo(4);
        assertThat(view.summary().failureReason()).isEqualTo("direct_transfer_interrupted");
        assertThat(view.summary().fallbackAt()).isEqualTo(directAt);
    }

    @Test
    void corruptedLedgerShouldRejectRemovalButHealOnUpsert() {
        TransferAttemptLedger corrupted = TransferAttemptLedger.load("{not valid json");

        assertThat(corrupted.isCorrupted()).isTrue();
        assertThat(corrupted.view().attempts()).isEmpty();
        assertThat(corrupted.remove("direct", "direct-1").isCorrupted()).isTrue();

        TransferAttemptLedger healed = corrupted.upsert(attempt(
                "direct",
                "direct-2",
                "sending",
                LocalDateTime.of(2026, 7, 31, 10, 0)
        ));

        assertThat(healed.isCorrupted()).isFalse();
        assertThat(healed.view().attempts()).extracting(TransferTaskAttemptVO::getTransferId)
                .containsExactly("direct-2");
    }

    @Test
    void removeShouldMatchBothModeAndTransferId() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 31, 10, 0);
        TransferAttemptLedger ledger = TransferAttemptLedger.load("[]")
                .upsert(attempt("direct", "shared-id", "sending", now))
                .upsert(attempt("relay", "shared-id", "ready", now.plusSeconds(1)));

        TransferAttemptLedger.View view = ledger.remove("direct", "shared-id").view();

        assertThat(view.attempts()).extracting(TransferTaskAttemptVO::getTransferMode)
                .containsExactly("relay");
    }

    @Test
    void removeByTransferIdShouldRemoveEveryMatchingMode() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 31, 10, 0);
        TransferAttemptLedger ledger = TransferAttemptLedger.load("[]")
                .upsert(attempt("direct", "shared-id", "sending", now))
                .upsert(attempt("relay", "shared-id", "ready", now.plusSeconds(1)))
                .upsert(attempt("direct", "kept-id", "sending", now.plusSeconds(2)));

        TransferAttemptLedger.View view = ledger.remove("shared-id").view();

        assertThat(view.attempts()).extracting(TransferTaskAttemptVO::getTransferId)
                .containsExactly("kept-id");
    }

    private TransferTaskAttemptVO attempt(String mode, String id, String stage, LocalDateTime updateTime) {
        TransferTaskAttemptVO attempt = new TransferTaskAttemptVO();
        attempt.setTransferMode(mode);
        attempt.setTransferId(id);
        attempt.setStage(stage);
        attempt.setUpdateTime(updateTime);
        return attempt;
    }
}
