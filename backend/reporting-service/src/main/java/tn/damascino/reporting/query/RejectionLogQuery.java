package tn.damascino.reporting.query;

import tn.damascino.common.cqrs.Query;
import tn.damascino.common.web.PageResponse;

import java.time.Instant;
import java.util.UUID;

/** Refused scans, with their reason (size 0 = every row). */
public record RejectionLogQuery(ReportFilter filter, int page, int size)
        implements Query<PageResponse<RejectionLogQuery.Row>> {

    public record Row(UUID id, Instant occurredAt, String beneficiaryName, String partnerName, String staffName,
                      String reason, String stage) {
    }
}
