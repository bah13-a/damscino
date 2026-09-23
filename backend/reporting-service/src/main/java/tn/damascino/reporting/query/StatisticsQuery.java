package tn.damascino.reporting.query;

import tn.damascino.common.cqrs.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Tableau de bord : autorisés, comptes activés, utilisateurs actifs, passages, remises en DT. */
public record StatisticsQuery(ReportFilter filter) implements Query<StatisticsQuery.Statistics> {

    public record Totals(long authorized, long activated, long activeUsers, long redemptions, long refusals,
                         BigDecimal dishTotal, BigDecimal discountTotal) {
    }

    public record PartnerLine(UUID partnerId, String partnerName, boolean active, long authorized, long activated,
                              long activeUsers, long redemptions, BigDecimal discountTotal) {
    }

    public record DayLine(LocalDate day, long redemptions, long activeUsers, BigDecimal discountTotal) {
    }

    public record Statistics(ReportFilter filter, Totals totals, List<PartnerLine> byPartner, List<DayLine> byDay) {
    }
}
