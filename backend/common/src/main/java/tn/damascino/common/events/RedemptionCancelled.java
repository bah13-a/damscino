package tn.damascino.common.events;

import java.time.Instant;
import java.util.UUID;

/** A validated passage was cancelled (ticket cancelled or refunded at the till): it no longer counts. */
public record RedemptionCancelled(
        UUID redemptionId,
        UUID beneficiaryId,
        String ticketId,
        String reason,
        Instant cancelledAt) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.REDEMPTION_CANCELLED;
    }
}
