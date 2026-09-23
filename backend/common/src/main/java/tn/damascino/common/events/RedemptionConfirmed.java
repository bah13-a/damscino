package tn.damascino.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RedemptionConfirmed(
        UUID redemptionId,
        UUID beneficiaryId,
        String beneficiaryName,
        UUID partnerId,
        String partnerName,
        UUID staffAccountId,
        String staffName,
        String periodKey,
        BigDecimal dishPrice,
        BigDecimal discountPercent,
        BigDecimal discountAmount,
        Instant validatedAt) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.REDEMPTION_CONFIRMED;
    }
}
