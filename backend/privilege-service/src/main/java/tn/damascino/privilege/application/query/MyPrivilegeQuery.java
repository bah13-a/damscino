package tn.damascino.privilege.application.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.security.AuthenticatedUser;
import tn.damascino.common.time.UsagePeriod;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Personal space of the beneficiary: advantage, availability and history of passages. */
public record MyPrivilegeQuery(AuthenticatedUser user) implements Query<MyPrivilegeQuery.Dashboard> {

    public enum Availability {
        /** The QR code of the period can be generated. */
        AVAILABLE,
        /** Already used for the current period. */
        USED,
        CONVENTION_NOT_STARTED,
        CONVENTION_EXPIRED,
        INACTIVE,
        /** The account was just created and is not yet propagated to this service. */
        PENDING
    }

    public record Passage(UUID id, Instant validatedAt, BigDecimal discountPercent, BigDecimal dishPrice,
                          BigDecimal discountAmount) {
    }

    public record Dashboard(
            String fullName,
            String partnerName,
            BigDecimal discountPercent,
            List<String> eligibleCategories,
            List<String> excludedCategories,
            int usagesPerPeriod,
            UsagePeriod usagePeriod,
            long usedInPeriod,
            Availability availability,
            String availabilityMessage,
            LocalDate nextAvailableOn,
            LocalDate conventionEnd,
            List<Passage> history) {
    }
}
