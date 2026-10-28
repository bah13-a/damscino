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

    /**
     * Last scan of the beneficiary's QR code today: VALID (read at the till, being finalised), CONFIRMED (discount
     * applied) or REFUSED with the reason. The QR screen polls it to show the result as soon as the cashier scans.
     */
    public record LastScan(String status, String reason, String message, String staffName, BigDecimal discountPercent,
                           BigDecimal dishPrice, BigDecimal discountAmount, Instant scannedAt) {
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
            List<Passage> history,
            LastScan lastScan) {
    }
}
