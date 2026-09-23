package tn.damascino.common.events;

import tn.damascino.common.time.UsagePeriod;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Full snapshot of a partner and its advantage rule (idempotent upsert for consumers). */
public record PartnerChanged(
        UUID partnerId,
        String name,
        boolean active,
        LocalDate conventionStart,
        LocalDate conventionEnd,
        BigDecimal discountPercent,
        List<String> eligibleCategories,
        List<String> excludedCategories,
        int usagesPerPeriod,
        UsagePeriod usagePeriod) implements DomainEvent {

    @Override
    public String eventType() {
        return EventTypes.PARTNER_CHANGED;
    }
}
