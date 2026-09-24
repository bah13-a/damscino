package tn.damascino.privilege.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** What the scanner displays: green screen (VALID / CONFIRMED) or red screen (REFUSED) with the reason. */
public record ScanResult(
        Status status,
        String reason,
        String message,
        String beneficiaryName,
        String partnerName,
        BigDecimal discountPercent,
        List<String> eligibleCategories,
        List<String> excludedCategories,
        Integer remainingInPeriod,
        UUID redemptionId,
        BigDecimal dishPrice,
        BigDecimal discountAmount,
        Instant validatedAt,
        /* short code to write on the ticket when the till is not connected (remise assistée) */
        String validationCode) {

    public enum Status {
        VALID,
        CONFIRMED,
        REFUSED
    }
}
