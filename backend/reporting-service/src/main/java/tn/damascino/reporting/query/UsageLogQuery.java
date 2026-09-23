package tn.damascino.reporting.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.web.PageResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Journal des passages (size 0 = every row, for exports). */
public record UsageLogQuery(ReportFilter filter, int page, int size) implements Query<PageResponse<UsageLogQuery.Row>> {

    public record Row(UUID id, Instant validatedAt, UUID beneficiaryId, String beneficiaryName, UUID partnerId,
                      String partnerName, String staffName, BigDecimal dishPrice, BigDecimal discountPercent,
                      BigDecimal discountAmount) {
    }
}
