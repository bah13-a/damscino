package tn.damascino.reporting.query;

import tn.damascino.common.time.Zones;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.UUID;

/** Filters shared by the statistics: global or one partner, a period, one beneficiary. */
public record ReportFilter(UUID partnerId, UUID beneficiaryId, LocalDate from, LocalDate to) {

    /** Conditions on a table having partner_id / beneficiary_id and a local date column. */
    Where onDates(String dateColumn) {
        Where where = partnerAndBeneficiary();
        if (from != null) {
            where.and(dateColumn + " >= :from", "from", from);
        }
        if (to != null) {
            where.and(dateColumn + " <= :to", "to", to);
        }
        return where;
    }

    /** Conditions on a table having an instant column, dates interpreted in Tunis time. */
    Where onInstants(String instantColumn) {
        Where where = partnerAndBeneficiary();
        if (from != null) {
            where.and(instantColumn + " >= :fromTs", "fromTs", Timestamp.from(from.atStartOfDay(Zones.TUNIS).toInstant()));
        }
        if (to != null) {
            where.and(instantColumn + " < :toTs", "toTs",
                    Timestamp.from(to.plusDays(1).atStartOfDay(Zones.TUNIS).toInstant()));
        }
        return where;
    }

    Where partnerAndBeneficiary() {
        Where where = new Where();
        if (partnerId != null) {
            where.and("partner_id = :partnerId", "partnerId", partnerId);
        }
        if (beneficiaryId != null) {
            where.and("beneficiary_id = :beneficiaryId", "beneficiaryId", beneficiaryId);
        }
        return where;
    }
}
