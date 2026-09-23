package tn.damascino.common.events;

import java.time.Instant;
import java.util.UUID;

public record RedemptionRejected(
        UUID beneficiaryId,
        String beneficiaryName,
        UUID partnerId,
        String partnerName,
        UUID staffAccountId,
        String staffName,
        String reason,
        String stage,
        Instant occurredAt) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.REDEMPTION_REJECTED;
    }
}
